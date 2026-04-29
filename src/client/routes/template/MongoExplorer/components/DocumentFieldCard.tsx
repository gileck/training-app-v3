import type { MongoSerializedValue } from '@/apis/template/mongo-explorer/types';
import { Badge } from '@/client/components/template/ui/badge';
import { Button } from '@/client/components/template/ui/button';
import { Input } from '@/client/components/template/ui/input';
import { Label } from '@/client/components/template/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/client/components/template/ui/select';
import { Textarea } from '@/client/components/template/ui/textarea';
import { Loader2, Pencil, Save } from 'lucide-react';
import type {
    DocumentFieldDescriptor,
    DocumentFieldKind,
    EditableFieldState,
} from '../types';
import {
    fromDateTimeLocalValue,
    getFieldInputValue,
    getFieldTypeLabel,
    isDateValue,
    isLongString,
    isObjectIdValue,
} from '../utils';

export function DocumentFieldCard({
    field,
    state,
    isEditing,
    isLocked,
    isEditable,
    canChangeType,
    isBusy,
    onStartEdit,
    onCancelEdit,
    onChangeKind,
    onChange,
    onSave,
}: {
    field: DocumentFieldDescriptor;
    state?: EditableFieldState;
    isEditing: boolean;
    isLocked: boolean;
    isEditable: boolean;
    canChangeType: boolean;
    isBusy: boolean;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onChangeKind: (nextKind: DocumentFieldKind) => void;
    onChange: (nextInputValue: string) => void;
    onSave: () => void;
}) {
    const effectiveState = state ?? {
        kind: field.kind,
        inputValue: getFieldInputValue(field.kind, field.value),
        error: null,
        readOnly: field.key === '_id',
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="break-all text-sm font-semibold">{field.key}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="max-w-full self-start">
                        {getFieldTypeLabel(field.kind)}
                    </Badge>
                    {isLocked ? (
                        <Badge variant="outline" className="max-w-full self-start">
                            locked
                        </Badge>
                    ) : !isEditable ? (
                        <Badge variant="outline" className="max-w-full self-start">
                            view only
                        </Badge>
                    ) : null}
                </div>
            </div>
            {isEditing ? (
                <div className="space-y-3">
                    <FieldEditorInput
                        state={effectiveState}
                        canChangeType={canChangeType}
                        onChangeKind={onChangeKind}
                        onChange={onChange}
                    />
                    {effectiveState.error && (
                        <p className="text-xs text-destructive">{effectiveState.error}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={onSave} disabled={isBusy}>
                            {isBusy ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Save field
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onCancelEdit}
                            disabled={isBusy}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <FieldValueDisplay kind={field.kind} value={field.value} />
                    {isEditable && (
                        <Button size="sm" variant="outline" onClick={onStartEdit}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit field
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

function FieldValueDisplay({
    kind,
    value,
}: {
    kind: DocumentFieldKind;
    value: MongoSerializedValue;
}) {
    switch (kind) {
        case 'objectId':
            return (
                <div className="break-all rounded-xl border border-border bg-muted/20 px-3 py-2 font-mono text-sm">
                    {isObjectIdValue(value) ? value.$oid : ''}
                </div>
            );
        case 'string':
            return typeof value === 'string' && isLongString(value) ? (
                <div className="break-words whitespace-pre-wrap rounded-xl border border-border bg-muted/20 px-3 py-3 text-sm leading-6">
                    {value}
                </div>
            ) : (
                <div className="break-words rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm">
                    {typeof value === 'string' ? value : ''}
                </div>
            );
        case 'number':
            return (
                <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 font-mono text-sm">
                    {typeof value === 'number' ? value.toLocaleString() : ''}
                </div>
            );
        case 'boolean':
            return (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-3">
                    <div
                        className={`h-2.5 w-2.5 rounded-full ${
                            value === true ? 'bg-success' : 'bg-muted-foreground'
                        }`}
                    />
                    <span className="font-mono text-sm">{String(value === true)}</span>
                </div>
            );
        case 'null':
            return (
                <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-3 font-mono text-sm text-muted-foreground">
                    null
                </div>
            );
        case 'date': {
            const isoValue = isDateValue(value) ? value.$date : '';
            const parsedDate = new Date(isoValue);

            return (
                <div className="space-y-2 rounded-xl border border-border bg-muted/20 px-3 py-3">
                    <p className="break-words text-sm">
                        {Number.isNaN(parsedDate.getTime())
                            ? isoValue
                            : parsedDate.toLocaleString()}
                    </p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                        {isoValue}
                    </p>
                </div>
            );
        }
        case 'json':
            return (
                <pre className="overflow-x-auto rounded-xl border border-border bg-muted/20 p-3 text-xs leading-6">
                    {JSON.stringify(value, null, 2)}
                </pre>
            );
    }
}

function FieldEditorInput({
    state,
    canChangeType,
    onChangeKind,
    onChange,
}: {
    state: EditableFieldState;
    canChangeType: boolean;
    onChangeKind: (nextKind: DocumentFieldKind) => void;
    onChange: (nextInputValue: string) => void;
}) {
    const typeSelector = canChangeType ? (
        <div className="space-y-2">
            <Label className="break-all text-sm font-semibold">Value type</Label>
            <Select
                value={state.kind}
                onValueChange={(value) => onChangeKind(value as DocumentFieldKind)}
                disabled={state.readOnly}
            >
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="null">Null</SelectItem>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="objectId">ObjectId</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
            </Select>
        </div>
    ) : null;

    if (state.kind === 'null') {
        return (
            <div className="space-y-3">
                {typeSelector}
                <div className="rounded-xl border border-dashed border-border bg-muted/10 px-3 py-3 font-mono text-sm text-muted-foreground">
                    null
                </div>
            </div>
        );
    }

    if (state.kind === 'string' && isLongString(state.inputValue)) {
        return (
            <div className="space-y-3">
                {typeSelector}
                <Textarea
                    value={state.inputValue}
                    onChange={(event) => onChange(event.target.value)}
                    className="min-h-[8rem]"
                    disabled={state.readOnly}
                />
            </div>
        );
    }

    if (state.kind === 'date') {
        return (
            <div className="space-y-2">
                {typeSelector}
                <Input
                    type="datetime-local"
                    value={state.inputValue}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={state.readOnly}
                />
                {state.inputValue && (
                    <p className="font-mono text-xs text-muted-foreground">
                        {fromDateTimeLocalValue(state.inputValue) ?? 'Invalid date'}
                    </p>
                )}
            </div>
        );
    }

    if (state.kind === 'boolean') {
        return (
            <div className="space-y-2">
                {typeSelector}
                <Label className="break-all text-sm font-semibold">Boolean value</Label>
                <Select
                    value={state.inputValue}
                    onValueChange={onChange}
                    disabled={state.readOnly}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {typeSelector}
            <Label className="break-all text-sm font-semibold">
                {state.kind === 'objectId' ? 'ObjectId value' : 'Value'}
            </Label>
            {state.kind === 'json' ? (
                <Textarea
                    value={state.inputValue}
                    onChange={(event) => onChange(event.target.value)}
                    className="min-h-[12rem] font-mono text-xs"
                    spellCheck={false}
                    disabled={state.readOnly}
                />
            ) : (
                <Input
                    type={state.kind === 'number' ? 'number' : 'text'}
                    value={state.inputValue}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={state.readOnly}
                    className={state.kind === 'objectId' ? 'font-mono text-xs sm:text-sm' : undefined}
                    step={state.kind === 'number' ? 'any' : undefined}
                />
            )}
        </div>
    );
}
