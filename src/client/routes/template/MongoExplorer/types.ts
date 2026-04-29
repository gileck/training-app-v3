import type {
    MongoSerializedObject,
    MongoSerializedValue,
} from '@/apis/template/mongo-explorer/types';

export type DocumentFieldKind =
    | 'objectId'
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'null'
    | 'json';

export type DocumentViewMode = 'fields' | 'raw';

export interface DocumentFieldDescriptor {
    key: string;
    kind: DocumentFieldKind;
    value: MongoSerializedValue;
}

export interface EditableFieldState {
    kind: DocumentFieldKind;
    inputValue: string;
    error: string | null;
    readOnly: boolean;
}

export interface ConfirmDialogState {
    open: boolean;
    title: string;
    description: string;
    confirmText: string;
    cancelText: string;
    variant: 'default' | 'destructive';
}

export interface BreadcrumbItem {
    label: string;
    path?: string;
}

export interface RawDocumentValidationResult {
    document: MongoSerializedObject | null;
    error: string | null;
}
