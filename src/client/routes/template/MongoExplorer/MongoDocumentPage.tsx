import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@/client/features';
import { Alert, AlertDescription } from '@/client/components/template/ui/alert';
import { Badge } from '@/client/components/template/ui/badge';
import { Button } from '@/client/components/template/ui/button';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/client/components/template/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import type {
    MongoSerializedObject,
    MongoSerializedValue,
} from '@/apis/template/mongo-explorer/types';
import {
    useMongoDeleteDocument,
    useMongoDocument,
    useMongoDuplicateDocument,
    useMongoUpdateDocument,
} from './hooks';
import { CenteredLoading } from './components/CenteredLoading';
import { DocumentActionsMenu } from './components/DocumentActionsMenu';
import { DocumentFieldCard } from './components/DocumentFieldCard';
import { EmptyState } from './components/EmptyState';
import { PageHeader } from './components/PageHeader';
import { RawDocumentCard } from './components/RawDocumentCard';
import type {
    ConfirmDialogState,
    DocumentFieldDescriptor,
    EditableFieldState,
} from './types';
import {
    canFieldChangeType,
    createEditableFieldState,
    getCollectionPath,
    getDefaultInputValueForKind,
    getDocumentPath,
    getFieldDescriptors,
    getFieldInputValue,
    isFieldEditable,
    parseFieldInput,
    ROOT_PATH,
    validateRawDocumentSchema,
} from './utils';

export function MongoDocumentPage({
    collectionName,
    documentKey,
    onRefresh,
}: {
    collectionName: string;
    documentKey: string;
    onRefresh: () => void;
}) {
    const { navigate } = useRouter();
    const documentQuery = useMongoDocument(
        {
            collection: collectionName,
            documentKey,
        },
        collectionName.length > 0 && documentKey.length > 0
    );
    const updateDocumentMutation = useMongoUpdateDocument();
    const duplicateDocumentMutation = useMongoDuplicateDocument();
    const deleteDocumentMutation = useMongoDeleteDocument();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral field-level editor state for the active document
    const [editableFields, setEditableFields] = useState<Record<string, EditableFieldState>>({});
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral currently edited field key for the document inspector
    const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral document inspector mode for switching between field cards and raw JSON
    const [documentViewMode, setDocumentViewMode] = useState<'fields' | 'raw'>('fields');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral raw JSON editor state for the active document
    const [rawEditorValue, setRawEditorValue] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral raw JSON editor mode flag scoped to this document page
    const [isRawEditing, setIsRawEditing] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral raw JSON validation error state scoped to this document page
    const [rawEditorError, setRawEditorError] = useState<string | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral confirmation dialog state scoped to this document page
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
        open: false,
        title: '',
        description: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'default',
    });
    const confirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null);

    const document = documentQuery.data ?? null;
    const fieldDescriptors = useMemo(
        () => (document ? getFieldDescriptors(document.document) : []),
        [document]
    );
    const editingField = useMemo(
        () => fieldDescriptors.find((field) => field.key === editingFieldKey) ?? null,
        [editingFieldKey, fieldDescriptors]
    );
    const serializedDocument = useMemo(
        () => (document ? JSON.stringify(document.document, null, 2) : ''),
        [document]
    );
    const isRawDirty = isRawEditing && rawEditorValue !== serializedDocument;

    useEffect(() => {
        if (!document) {
            setEditableFields({});
            setEditingFieldKey(null);
            setRawEditorValue('');
            setIsRawEditing(false);
            setRawEditorError(null);
            return;
        }

        setEditableFields(createEditableFieldState(document.document));
        setEditingFieldKey(null);
        setRawEditorValue(JSON.stringify(document.document, null, 2));
        setIsRawEditing(false);
        setRawEditorError(null);
    }, [document?.documentKey, document]);

    const requestConfirmation = (config: Omit<ConfirmDialogState, 'open'>): Promise<boolean> => {
        setConfirmDialog({
            ...config,
            open: true,
        });

        return new Promise((resolve) => {
            confirmResolverRef.current = resolve;
        });
    };

    const handleConfirmDialogOpenChange = (open: boolean) => {
        setConfirmDialog((current) => ({ ...current, open }));

        if (!open && confirmResolverRef.current) {
            confirmResolverRef.current(false);
            confirmResolverRef.current = null;
        }
    };

    const handleConfirmDialogConfirm = () => {
        if (confirmResolverRef.current) {
            confirmResolverRef.current(true);
            confirmResolverRef.current = null;
        }

        setConfirmDialog((current) => ({ ...current, open: false }));
    };

    const requestDiscardFieldChangesConfirmation = async (description: string) => {
        return requestConfirmation({
            title: 'Discard field changes?',
            description,
            confirmText: 'Discard changes',
            cancelText: 'Keep editing',
            variant: 'default',
        });
    };

    const requestDiscardRawChangesConfirmation = async (description: string) => {
        return requestConfirmation({
            title: 'Discard raw changes?',
            description,
            confirmText: 'Discard raw changes',
            cancelText: 'Keep editing',
            variant: 'default',
        });
    };

    const discardCurrentFieldEdit = () => {
        if (!editingField || !document) {
            setEditingFieldKey(null);
            return;
        }

        setEditableFields((current) => ({
            ...current,
            [editingField.key]: {
                ...(current[editingField.key] ?? {
                    kind: editingField.kind,
                    inputValue: '',
                    error: null,
                    readOnly: editingField.key === '_id',
                }),
                inputValue: getFieldInputValue(editingField.kind, editingField.value),
                error: null,
            },
        }));
        setEditingFieldKey(null);
    };

    const discardRawEditorChanges = () => {
        setRawEditorValue(serializedDocument);
        setRawEditorError(null);
        setIsRawEditing(false);
    };

    const confirmDiscardActiveEdits = async (
        fieldDescription: string,
        rawDescription: string
    ): Promise<boolean> => {
        if (
            editingFieldKey &&
            !(await requestDiscardFieldChangesConfirmation(fieldDescription))
        ) {
            return false;
        }

        if (isRawDirty && !(await requestDiscardRawChangesConfirmation(rawDescription))) {
            return false;
        }

        if (editingFieldKey) {
            discardCurrentFieldEdit();
        }

        if (isRawEditing) {
            discardRawEditorChanges();
        }

        return true;
    };

    const handleBack = async () => {
        if (
            !(await confirmDiscardActiveEdits(
                'You have an unsaved field edit. Going back to the documents list will discard those changes.',
                'You have unsaved raw JSON changes. Going back to the documents list will discard those changes.'
            ))
        ) {
            return;
        }

        navigate(getCollectionPath(collectionName));
    };

    const resetFieldState = (
        field: DocumentFieldDescriptor,
        nextKind: DocumentFieldDescriptor['kind']
    ) => {
        setEditableFields((current) => ({
            ...current,
            [field.key]: {
                ...(current[field.key] ?? {
                    kind: nextKind,
                    inputValue: getDefaultInputValueForKind(nextKind),
                    error: null,
                    readOnly: field.key === '_id',
                }),
                kind: nextKind,
                inputValue: getDefaultInputValueForKind(nextKind),
                error: null,
            },
        }));
    };

    const updateFieldInputValue = (field: DocumentFieldDescriptor, nextInputValue: string) => {
        setEditableFields((current) => ({
            ...current,
            [field.key]: {
                ...(current[field.key] ?? {
                    kind: field.kind,
                    inputValue: nextInputValue,
                    error: null,
                    readOnly: field.key === '_id',
                }),
                inputValue: nextInputValue,
                error: null,
            },
        }));
    };

    const handleStartFieldEdit = async (field: DocumentFieldDescriptor) => {
        if (!document || !isFieldEditable(field)) {
            return;
        }

        if (editingFieldKey === field.key && documentViewMode === 'fields') {
            return;
        }

        if (
            !(await confirmDiscardActiveEdits(
                'Starting to edit another field will discard the current unsaved field changes.',
                'Starting field editing will discard the current unsaved raw JSON changes.'
            ))
        ) {
            return;
        }

        setEditableFields((current) => ({
            ...current,
            [field.key]: {
                ...(current[field.key] ?? {
                    kind: field.kind,
                    inputValue: getFieldInputValue(field.kind, field.value),
                    error: null,
                    readOnly: field.key === '_id',
                }),
                inputValue: getFieldInputValue(field.kind, field.value),
                error: null,
            },
        }));
        setDocumentViewMode('fields');
        setEditingFieldKey(field.key);
    };

    const handleCancelFieldEdit = async () => {
        if (!editingField) {
            setEditingFieldKey(null);
            return;
        }

        if (
            !(await requestDiscardFieldChangesConfirmation(
                'Canceling field edit will discard the current unsaved changes for this field.'
            ))
        ) {
            return;
        }

        discardCurrentFieldEdit();
    };

    const handleSaveField = async () => {
        if (!document || !editingField) {
            return;
        }

        const fieldState = editableFields[editingField.key];
        if (!fieldState) {
            return;
        }

        const parsedField = parseFieldInput(fieldState.kind, fieldState.inputValue);
        setEditableFields((current) => ({
            ...current,
            [editingField.key]: {
                ...fieldState,
                error: parsedField.error,
            },
        }));

        if (parsedField.error) {
            return;
        }

        const nextDocument: MongoSerializedObject = {
            ...document.document,
            [editingField.key]: parsedField.value as MongoSerializedValue,
        };

        const updatedDocument = await updateDocumentMutation.mutateAsync({
            collection: collectionName,
            documentKey: document.documentKey,
            document: nextDocument,
        });

        setEditableFields(createEditableFieldState(updatedDocument.document));
        setEditingFieldKey(null);
    };

    const handleSwitchToFieldsView = async () => {
        if (documentViewMode === 'fields' && !isRawEditing) {
            return;
        }

        if (
            isRawDirty &&
            !(await requestDiscardRawChangesConfirmation(
                'Switching back to field view will discard the current unsaved raw JSON changes.'
            ))
        ) {
            return;
        }

        if (isRawEditing) {
            discardRawEditorChanges();
        }

        setDocumentViewMode('fields');
    };

    const handleSwitchToRawView = async () => {
        if (!document) {
            return;
        }

        if (
            !(await confirmDiscardActiveEdits(
                'Switching to raw view will discard the current unsaved field edit.',
                'You already have unsaved raw JSON changes.'
            ))
        ) {
            return;
        }

        setDocumentViewMode('raw');
    };

    const handleStartRawEdit = async () => {
        if (!document) {
            return;
        }

        if (
            !(await confirmDiscardActiveEdits(
                'Switching to raw editing will discard the current unsaved field edit.',
                'You already have unsaved raw JSON changes.'
            ))
        ) {
            return;
        }

        setDocumentViewMode('raw');
        setRawEditorValue(JSON.stringify(document.document, null, 2));
        setRawEditorError(null);
        setIsRawEditing(true);
    };

    const handleCancelRawEdit = async () => {
        if (!isRawEditing) {
            return;
        }

        if (
            isRawDirty &&
            !(await requestDiscardRawChangesConfirmation(
                'Canceling raw edit will discard the current unsaved raw JSON changes.'
            ))
        ) {
            return;
        }

        discardRawEditorChanges();
    };

    const handleSaveRawDocument = async () => {
        if (!document) {
            return;
        }

        let parsedValue: unknown;

        try {
            parsedValue = JSON.parse(rawEditorValue);
        } catch (error) {
            setRawEditorError(error instanceof Error ? error.message : 'Invalid JSON');
            return;
        }

        const validated = validateRawDocumentSchema(document.document, parsedValue);
        setRawEditorError(validated.error);

        if (!validated.document || validated.error) {
            return;
        }

        if (
            !(await requestConfirmation({
                title: 'Save raw document?',
                description:
                    'This will replace the current document with the raw JSON shown in the editor, while enforcing the existing schema rules.',
                confirmText: 'Save raw document',
                cancelText: 'Cancel',
                variant: 'default',
            }))
        ) {
            return;
        }

        const updatedDocument = await updateDocumentMutation.mutateAsync({
            collection: collectionName,
            documentKey: document.documentKey,
            document: validated.document,
        });

        setEditableFields(createEditableFieldState(updatedDocument.document));
        setRawEditorValue(JSON.stringify(updatedDocument.document, null, 2));
        setRawEditorError(null);
        setIsRawEditing(false);
        setDocumentViewMode('raw');
    };

    const handleRefresh = async () => {
        if (
            !(await confirmDiscardActiveEdits(
                'Refreshing this document will discard the current unsaved field edit.',
                'Refreshing this document will discard the current unsaved raw JSON changes.'
            ))
        ) {
            return;
        }

        onRefresh();
        void documentQuery.refetch();
    };

    const handleDuplicateDocument = async () => {
        if (!document) {
            return;
        }

        if (
            !(await confirmDiscardActiveEdits(
                'Duplicating this document now will discard the current unsaved field edit.',
                'Duplicating this document now will discard the current unsaved raw JSON changes.'
            ))
        ) {
            return;
        }

        if (
            !(await requestConfirmation({
                title: 'Duplicate document?',
                description: `A copy of ${document.idLabel} will be created in ${collectionName}.`,
                confirmText: 'Duplicate document',
                cancelText: 'Cancel',
                variant: 'default',
            }))
        ) {
            return;
        }

        const duplicatedDocument = await duplicateDocumentMutation.mutateAsync({
            collection: collectionName,
            documentKey: document.documentKey,
        });

        setEditingFieldKey(null);
        navigate(getDocumentPath(collectionName, duplicatedDocument.documentKey));
    };

    const handleDeleteDocument = async () => {
        if (!document) {
            return;
        }

        if (
            !(await confirmDiscardActiveEdits(
                'Deleting this document now will discard the current unsaved field edit.',
                'Deleting this document now will discard the current unsaved raw JSON changes.'
            ))
        ) {
            return;
        }

        if (
            !(await requestConfirmation({
                title: 'Delete document?',
                description: `${document.idLabel} will be permanently removed from ${collectionName}. This cannot be undone.`,
                confirmText: 'Delete document',
                cancelText: 'Cancel',
                variant: 'destructive',
            }))
        ) {
            return;
        }

        await deleteDocumentMutation.mutateAsync({
            collection: collectionName,
            documentKey: document.documentKey,
        });

        setEditingFieldKey(null);
        navigate(getCollectionPath(collectionName));
    };

    const pageDescription = editingField
        ? `Editing field ${editingField.key}`
        : isRawEditing
          ? 'Editing raw document'
          : documentViewMode === 'raw'
            ? 'Viewing raw document'
            : 'View mode';

    const statusBadgeLabel = editingField
        ? `Editing ${editingField.key}`
        : isRawEditing
          ? 'Editing raw'
          : documentViewMode === 'raw'
            ? 'Viewing raw'
            : 'Viewing fields';

    return (
        <div className="mx-auto max-w-5xl px-2 py-4 pb-20 sm:px-4 sm:pb-6">
            <PageHeader
                title={document?.idLabel || 'Document'}
                description={pageDescription}
                breadcrumbs={[
                    { label: 'db', path: ROOT_PATH },
                    {
                        label: collectionName,
                        path: getCollectionPath(collectionName),
                    },
                    { label: document?.idLabel || 'document' },
                ]}
                actions={[
                    <Button key="back" variant="outline" onClick={handleBack} className="min-w-0">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Documents
                    </Button>,
                    <DocumentActionsMenu
                        key="actions"
                        disabled={
                            updateDocumentMutation.isPending ||
                            duplicateDocumentMutation.isPending ||
                            deleteDocumentMutation.isPending
                        }
                        hasDocument={Boolean(document)}
                        isDuplicating={duplicateDocumentMutation.isPending}
                        isDeleting={deleteDocumentMutation.isPending}
                        onRefresh={handleRefresh}
                        onDuplicate={handleDuplicateDocument}
                        onDelete={handleDeleteDocument}
                    />,
                ]}
            />

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <CardTitle className="break-all text-lg">Document</CardTitle>
                            <CardDescription>
                                Switch between the typed field inspector and raw JSON editing.
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge
                                variant={editingField || isRawEditing ? 'default' : 'secondary'}
                                className="max-w-full"
                            >
                                {statusBadgeLabel}
                            </Badge>
                            {editingField && documentViewMode === 'fields' && (
                                <Button
                                    variant="outline"
                                    onClick={() => void handleCancelFieldEdit()}
                                >
                                    Cancel field edit
                                </Button>
                            )}
                            {documentViewMode === 'raw' && isRawEditing && (
                                <Button
                                    variant="outline"
                                    onClick={() => void handleCancelRawEdit()}
                                >
                                    Cancel raw edit
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {documentQuery.error && (
                        <Alert variant="destructive">
                            <AlertDescription>{documentQuery.error.message}</AlertDescription>
                        </Alert>
                    )}

                    {documentQuery.isLoading && !document ? (
                        <CenteredLoading label="Loading document" />
                    ) : !document ? (
                        <EmptyState
                            title="Document not found"
                            description="The requested document could not be loaded from this collection."
                        />
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                Route:{' '}
                                <span className="break-all font-mono text-foreground">
                                    db/{collectionName}/{document.idLabel}
                                </span>
                            </div>
                            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                Schema validation is enforced per field. Non-null values keep their original type. Fields currently set to `null` can be changed to any supported value type from the app.
                            </div>
                            <Tabs
                                value={documentViewMode}
                                onValueChange={(value) => {
                                    if (value === documentViewMode) {
                                        return;
                                    }

                                    if (value === 'fields') {
                                        void handleSwitchToFieldsView();
                                        return;
                                    }

                                    void handleSwitchToRawView();
                                }}
                                className="space-y-4"
                            >
                                <TabsList className="w-full justify-start overflow-x-auto">
                                    <TabsTrigger
                                        value="fields"
                                        disabled={updateDocumentMutation.isPending}
                                    >
                                        Fields
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="raw"
                                        disabled={updateDocumentMutation.isPending}
                                    >
                                        Raw JSON
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="fields">
                                    <div className="grid gap-4">
                                        {fieldDescriptors.map((field) => (
                                            <DocumentFieldCard
                                                key={field.key}
                                                field={field}
                                                state={editableFields[field.key]}
                                                isEditing={editingFieldKey === field.key}
                                                isLocked={field.key === '_id'}
                                                isEditable={isFieldEditable(field)}
                                                canChangeType={canFieldChangeType(field)}
                                                isBusy={updateDocumentMutation.isPending}
                                                onStartEdit={() =>
                                                    void handleStartFieldEdit(field)
                                                }
                                                onCancelEdit={() =>
                                                    void handleCancelFieldEdit()
                                                }
                                                onChangeKind={(nextKind) =>
                                                    resetFieldState(field, nextKind)
                                                }
                                                onChange={(nextInputValue) =>
                                                    updateFieldInputValue(
                                                        field,
                                                        nextInputValue
                                                    )
                                                }
                                                onSave={() => void handleSaveField()}
                                            />
                                        ))}
                                    </div>
                                </TabsContent>
                                <TabsContent value="raw">
                                    <RawDocumentCard
                                        rawValue={rawEditorValue}
                                        rawError={rawEditorError}
                                        isEditing={isRawEditing}
                                        isBusy={updateDocumentMutation.isPending}
                                        onStartEdit={() => void handleStartRawEdit()}
                                        onChange={(nextValue) => {
                                            setRawEditorValue(nextValue);
                                            setRawEditorError(null);
                                        }}
                                        onCancel={() => void handleCancelRawEdit()}
                                        onSave={() => void handleSaveRawDocument()}
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </CardContent>
            </Card>
            <ConfirmDialog
                open={confirmDialog.open}
                onOpenChange={handleConfirmDialogOpenChange}
                title={confirmDialog.title}
                description={confirmDialog.description}
                confirmText={confirmDialog.confirmText}
                cancelText={confirmDialog.cancelText}
                variant={confirmDialog.variant}
                onConfirm={handleConfirmDialogConfirm}
            />
        </div>
    );
}
