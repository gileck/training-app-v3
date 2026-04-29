import type {
    MongoSerializedObject,
    MongoSerializedValue,
} from '@/apis/template/mongo-explorer/types';
import type {
    DocumentFieldDescriptor,
    DocumentFieldKind,
    EditableFieldState,
    RawDocumentValidationResult,
} from './types';

export const PAGE_SIZE = 25;
export const ROOT_PATH = '/admin/mongo-explorer';
export const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function formatCountLabel(count: number): string {
    return count.toLocaleString();
}

export function isPlainSerializedObject(value: MongoSerializedValue): value is MongoSerializedObject {
    return value !== null && !Array.isArray(value) && typeof value === 'object';
}

export function isObjectIdValue(
    value: MongoSerializedValue
): value is MongoSerializedObject & { $oid: string } {
    return (
        isPlainSerializedObject(value) &&
        Object.keys(value).length === 1 &&
        typeof value.$oid === 'string'
    );
}

export function isDateValue(
    value: MongoSerializedValue
): value is MongoSerializedObject & { $date: string } {
    return (
        isPlainSerializedObject(value) &&
        Object.keys(value).length === 1 &&
        typeof value.$date === 'string'
    );
}

export function getFieldKind(value: MongoSerializedValue): DocumentFieldKind {
    if (isObjectIdValue(value)) {
        return 'objectId';
    }

    if (isDateValue(value)) {
        return 'date';
    }

    if (typeof value === 'string') {
        return 'string';
    }

    if (typeof value === 'number') {
        return 'number';
    }

    if (typeof value === 'boolean') {
        return 'boolean';
    }

    if (value === null) {
        return 'null';
    }

    return 'json';
}

export function getFieldDescriptors(document: MongoSerializedObject): DocumentFieldDescriptor[] {
    return Object.entries(document).map(([key, value]) => ({
        key,
        kind: getFieldKind(value),
        value,
    }));
}

export function toDateTimeLocalValue(isoValue: string): string {
    const parsedDate = new Date(isoValue);

    if (Number.isNaN(parsedDate.getTime())) {
        return isoValue;
    }

    const localDate = new Date(
        parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60_000
    );

    return localDate.toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(localValue: string): string | null {
    if (!localValue.trim()) {
        return null;
    }

    const parsedDate = new Date(localValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    return parsedDate.toISOString();
}

export function getFieldInputValue(
    kind: DocumentFieldKind,
    value: MongoSerializedValue
): string {
    switch (kind) {
        case 'objectId':
            return isObjectIdValue(value) ? value.$oid : '';
        case 'date':
            return isDateValue(value) ? toDateTimeLocalValue(value.$date) : '';
        case 'string':
            return typeof value === 'string' ? value : '';
        case 'number':
            return typeof value === 'number' ? String(value) : '';
        case 'boolean':
            return typeof value === 'boolean' ? String(value) : 'false';
        case 'null':
            return '';
        case 'json':
            return JSON.stringify(value, null, 2);
    }
}

export function getDefaultInputValueForKind(kind: DocumentFieldKind): string {
    switch (kind) {
        case 'boolean':
            return 'false';
        case 'null':
            return '';
        default:
            return '';
    }
}

export function createEditableFieldState(
    document: MongoSerializedObject
): Record<string, EditableFieldState> {
    return Object.fromEntries(
        getFieldDescriptors(document).map((field) => [
            field.key,
            {
                kind: field.kind,
                inputValue: getFieldInputValue(field.kind, field.value),
                error: null,
                readOnly: field.key === '_id',
            },
        ])
    );
}

export function parseFieldInput(
    kind: DocumentFieldKind,
    inputValue: string
): { value: MongoSerializedValue | null; error: string | null } {
    switch (kind) {
        case 'objectId': {
            if (!OBJECT_ID_PATTERN.test(inputValue.trim())) {
                return {
                    value: null,
                    error: 'ObjectId must be a 24-character hex string',
                };
            }

            return {
                value: { $oid: inputValue.trim() },
                error: null,
            };
        }
        case 'string':
            return { value: inputValue, error: null };
        case 'number': {
            if (!inputValue.trim()) {
                return { value: null, error: 'Number is required' };
            }

            const parsedNumber = Number(inputValue);
            if (!Number.isFinite(parsedNumber)) {
                return { value: null, error: 'Invalid number' };
            }

            return { value: parsedNumber, error: null };
        }
        case 'boolean': {
            if (inputValue !== 'true' && inputValue !== 'false') {
                return { value: null, error: 'Boolean must be true or false' };
            }

            return { value: inputValue === 'true', error: null };
        }
        case 'null':
            return { value: null, error: null };
        case 'date': {
            const isoDate = fromDateTimeLocalValue(inputValue);
            if (!isoDate) {
                return { value: null, error: 'Invalid date' };
            }

            return {
                value: { $date: isoDate },
                error: null,
            };
        }
        case 'json': {
            try {
                return {
                    value: JSON.parse(inputValue) as MongoSerializedValue,
                    error: null,
                };
            } catch (error) {
                return {
                    value: null,
                    error: error instanceof Error ? error.message : 'Invalid JSON',
                };
            }
        }
    }
}

export function getFieldTypeLabel(kind: DocumentFieldKind): string {
    switch (kind) {
        case 'objectId':
            return 'ObjectId';
        case 'string':
            return 'String';
        case 'number':
            return 'Number';
        case 'boolean':
            return 'Boolean';
        case 'null':
            return 'Null';
        case 'date':
            return 'Date';
        case 'json':
            return 'JSON';
    }
}

export function isLongString(value: string): boolean {
    return value.includes('\n') || value.length > 120;
}

export function isFieldEditable(field: DocumentFieldDescriptor): boolean {
    return field.key !== '_id' && field.kind !== 'json';
}

export function canFieldChangeType(field: DocumentFieldDescriptor): boolean {
    return field.kind === 'null';
}

export function validateSerializedMongoValue(value: unknown, path: string): string | null {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return null;
    }

    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const nestedError = validateSerializedMongoValue(value[index], `${path}[${index}]`);
            if (nestedError) {
                return nestedError;
            }
        }

        return null;
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value);

        if (entries.length === 1 && entries[0][0] === '$oid') {
            const oidValue = entries[0][1];
            if (typeof oidValue !== 'string' || !OBJECT_ID_PATTERN.test(oidValue)) {
                return `${path} must use a valid {"$oid":"..."} value`;
            }

            return null;
        }

        if (entries.length === 1 && entries[0][0] === '$date') {
            const dateValue = entries[0][1];

            if (
                typeof dateValue !== 'string' ||
                fromDateTimeLocalValue(toDateTimeLocalValue(dateValue)) === null
            ) {
                const parsedDate = typeof dateValue === 'string' ? new Date(dateValue) : null;
                if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) {
                    return `${path} must use a valid {"$date":"..."} value`;
                }
            }

            return null;
        }

        for (const [key, nestedValue] of entries) {
            const nestedError = validateSerializedMongoValue(
                nestedValue,
                path === 'document' ? key : `${path}.${key}`
            );
            if (nestedError) {
                return nestedError;
            }
        }

        return null;
    }

    return `${path} contains an unsupported value`;
}

export function validateRawDocumentSchema(
    currentDocument: MongoSerializedObject,
    nextValue: unknown
): RawDocumentValidationResult {
    if (!nextValue || Array.isArray(nextValue) || typeof nextValue !== 'object') {
        return {
            document: null,
            error: 'Raw document must be a JSON object',
        };
    }

    const nextDocument = nextValue as MongoSerializedObject;
    const valueError = validateSerializedMongoValue(nextDocument, 'document');

    if (valueError) {
        return {
            document: null,
            error: valueError,
        };
    }

    if (JSON.stringify(nextDocument._id) !== JSON.stringify(currentDocument._id)) {
        return {
            document: null,
            error: '_id cannot be changed in raw edit mode',
        };
    }

    const fieldNames = new Set([...Object.keys(currentDocument), ...Object.keys(nextDocument)]);

    for (const fieldName of fieldNames) {
        if (fieldName === '_id') {
            continue;
        }

        const currentKind =
            fieldName in currentDocument
                ? getFieldKind(currentDocument[fieldName])
                : 'missing';
        const nextKind =
            fieldName in nextDocument ? getFieldKind(nextDocument[fieldName]) : 'missing';

        if (currentKind === 'null') {
            continue;
        }

        if (currentKind !== nextKind) {
            return {
                document: null,
                error: `Field "${fieldName}" must remain ${currentKind}; received ${nextKind}`,
            };
        }
    }

    return {
        document: nextDocument,
        error: null,
    };
}

export function encodeRouteSegment(value: string): string {
    return encodeURIComponent(value);
}

export function decodeRouteSegment(value?: string): string {
    if (!value) {
        return '';
    }

    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function getCollectionPath(collectionName: string): string {
    return `${ROOT_PATH}/${encodeRouteSegment(collectionName)}`;
}

export function getDocumentPath(collectionName: string, documentKey: string): string {
    return `${getCollectionPath(collectionName)}/${encodeRouteSegment(documentKey)}`;
}
