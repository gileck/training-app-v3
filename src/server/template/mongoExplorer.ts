import { randomUUID } from 'crypto';
import { ObjectId, type Document, type Filter } from 'mongodb';
import { appConfig } from '@/app.config';
import { getDb } from '@/server/database';
import type {
    MongoExplorerCollectionSummary,
    MongoExplorerDocumentSummary,
    MongoExplorerPagination,
    MongoSerializedObject,
    MongoSerializedValue,
} from '@/apis/template/mongo-explorer/types';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
type ExplorerDocument = Document & { _id: unknown };
type ExplorerFieldKind = 'objectId' | 'string' | 'number' | 'boolean' | 'date' | 'null' | 'json' | 'missing';

interface CollectionsForExplorerResult {
    dbName: string;
    collections: MongoExplorerCollectionSummary[];
}

interface DocumentsForExplorerResult {
    collection: string;
    documents: MongoExplorerDocumentSummary[];
    pagination: MongoExplorerPagination;
}

function clampPageSize(pageSize?: number): number {
    if (!Number.isFinite(pageSize) || !pageSize) {
        return DEFAULT_PAGE_SIZE;
    }

    return Math.min(Math.max(Math.trunc(pageSize), 1), MAX_PAGE_SIZE);
}

function clampPage(page?: number): number {
    if (!Number.isFinite(page) || !page) {
        return 1;
    }

    return Math.max(Math.trunc(page), 1);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function serializeMongoValue(value: unknown): MongoSerializedValue {
    if (value instanceof ObjectId) {
        return { $oid: value.toHexString() };
    }

    if (value instanceof Date) {
        return { $date: value.toISOString() };
    }

    if (Array.isArray(value)) {
        return value.map((item) => serializeMongoValue(item));
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, serializeMongoValue(item)])
        );
    }

    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    return String(value);
}

function deserializeMongoValue(value: MongoSerializedValue): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => deserializeMongoValue(item));
    }

    if (isPlainObject(value)) {
        const entries = Object.entries(value);

        if (entries.length === 1 && entries[0][0] === '$oid') {
            const oid = entries[0][1];
            if (typeof oid !== 'string' || !ObjectId.isValid(oid)) {
                throw new Error('Invalid ObjectId value in document');
            }
            return new ObjectId(oid);
        }

        if (entries.length === 1 && entries[0][0] === '$date') {
            const dateValue = entries[0][1];
            if (typeof dateValue !== 'string') {
                throw new Error('Invalid date value in document');
            }

            const parsedDate = new Date(dateValue);
            if (Number.isNaN(parsedDate.getTime())) {
                throw new Error('Invalid ISO date value in document');
            }
            return parsedDate;
        }

        return Object.fromEntries(
            entries.map(([key, item]) => [key, deserializeMongoValue(item)])
        );
    }

    return value;
}

function createDocumentKey(value: unknown): string {
    return JSON.stringify(serializeMongoValue(value));
}

function parseDocumentKey(documentKey: string): unknown {
    let parsed: MongoSerializedValue;

    try {
        parsed = JSON.parse(documentKey) as MongoSerializedValue;
    } catch {
        throw new Error('Invalid document key');
    }

    return deserializeMongoValue(parsed);
}

function formatDocumentIdLabel(documentKey: string): string {
    try {
        const parsed = JSON.parse(documentKey) as MongoSerializedValue;

        if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') {
            return String(parsed);
        }

        if (parsed === null) {
            return 'null';
        }

        if (Array.isArray(parsed)) {
            return JSON.stringify(parsed);
        }

        if (typeof parsed.$oid === 'string') {
            return parsed.$oid;
        }

        if (typeof parsed.$date === 'string') {
            return parsed.$date;
        }

        return JSON.stringify(parsed);
    } catch {
        return documentKey;
    }
}

function formatPreviewValue(value: unknown): string | null {
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
    ) {
        return String(value);
    }

    return null;
}

function truncateText(value: string, maxLength = 120): string {
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength - 1)}…`;
}

function createDocumentPreview(document: Document): string {
    const preferredKeys = ['title', 'name', 'username', 'email', 'status', 'slug'];

    for (const key of preferredKeys) {
        const previewValue = formatPreviewValue(document[key]);
        if (previewValue) {
            return truncateText(`${key}: ${previewValue}`);
        }
    }

    const primitiveEntries = Object.entries(document)
        .filter(([key]) => key !== '_id')
        .map(([key, value]) => [key, formatPreviewValue(value)] as const)
        .filter((entry): entry is readonly [string, string] => entry[1] !== null)
        .slice(0, 2);

    if (primitiveEntries.length > 0) {
        return truncateText(
            primitiveEntries.map(([key, value]) => `${key}: ${value}`).join(' • ')
        );
    }

    return `${Object.keys(document).length} field${Object.keys(document).length === 1 ? '' : 's'}`;
}

async function assertCollectionExists(collectionName: string): Promise<void> {
    if (!collectionName.trim()) {
        throw new Error('Collection name is required');
    }

    const db = await getDb();
    const matchingCollections = await db
        .listCollections({ name: collectionName }, { nameOnly: true })
        .toArray();

    if (matchingCollections.length === 0) {
        throw new Error(`Collection "${collectionName}" was not found`);
    }
}

function assertSerializedDocument(
    value: MongoSerializedValue
): MongoSerializedObject {
    if (!isPlainObject(value) || Array.isArray(value)) {
        throw new Error('Document payload must be a JSON object');
    }

    return value as MongoSerializedObject;
}

function valuesMatch(left: unknown, right: unknown): boolean {
    if (left instanceof ObjectId && right instanceof ObjectId) {
        return left.equals(right);
    }

    if (left instanceof Date && right instanceof Date) {
        return left.getTime() === right.getTime();
    }

    return left === right;
}

function cloneExplorerValue<T>(value: T): T {
    if (value instanceof ObjectId) {
        return new ObjectId(value.toHexString()) as T;
    }

    if (value instanceof Date) {
        return new Date(value.getTime()) as T;
    }

    if (Array.isArray(value)) {
        return value.map((item) => cloneExplorerValue(item)) as T;
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, cloneExplorerValue(item)])
        ) as T;
    }

    return value;
}

function createDuplicateId(value: unknown): unknown {
    if (value instanceof ObjectId) {
        return new ObjectId();
    }

    if (typeof value === 'string') {
        return randomUUID();
    }

    if (typeof value === 'number') {
        return Date.now();
    }

    if (value instanceof Date) {
        return new Date();
    }

    throw new Error('Duplicate is only supported for documents with ObjectId, string, number, or Date _id values');
}

function getExplorerFieldKind(value: unknown): ExplorerFieldKind {
    if (value === undefined) {
        return 'missing';
    }

    if (value instanceof ObjectId) {
        return 'objectId';
    }

    if (value instanceof Date) {
        return 'date';
    }

    if (value === null) {
        return 'null';
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

    return 'json';
}

function assertCompatibleFieldTypes(
    currentDocument: ExplorerDocument,
    nextDocument: ExplorerDocument
): void {
    const fieldNames = new Set([
        ...Object.keys(currentDocument),
        ...Object.keys(nextDocument),
    ]);

    for (const fieldName of fieldNames) {
        if (fieldName === '_id') {
            continue;
        }

        const currentValue = currentDocument[fieldName];
        const nextValue = nextDocument[fieldName];
        const currentKind = getExplorerFieldKind(currentValue);
        const nextKind = getExplorerFieldKind(nextValue);

        if (currentKind === 'null') {
            continue;
        }

        if (currentKind !== nextKind) {
            throw new Error(
                `Field "${fieldName}" must remain ${currentKind}; received ${nextKind}`
            );
        }
    }
}

function toDocumentSummary(document: Document): MongoExplorerDocumentSummary {
    const documentKey = createDocumentKey(document._id);

    return {
        documentKey,
        idLabel: formatDocumentIdLabel(documentKey),
        preview: createDocumentPreview(document),
        document: assertSerializedDocument(serializeMongoValue(document)),
    };
}

export async function listCollectionsForExplorer(): Promise<CollectionsForExplorerResult> {
    const db = await getDb();
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();

    const summaries = await Promise.all(
        collections
            .map((collection) => collection.name)
            .sort((left, right) => left.localeCompare(right))
            .map(async (collectionName) => {
                const documentCount = await db.collection(collectionName).countDocuments({});
                return {
                    name: collectionName,
                    documentCount,
                };
            })
    );

    return {
        dbName: appConfig.dbName,
        collections: summaries,
    };
}

export async function listDocumentsForExplorer(
    collectionName: string,
    page?: number,
    pageSize?: number
): Promise<DocumentsForExplorerResult> {
    await assertCollectionExists(collectionName);

    const db = await getDb();
    const normalizedPageSize = clampPageSize(pageSize);
    const normalizedPage = clampPage(page);
    const collection = db.collection<ExplorerDocument>(collectionName);
    const totalDocuments = await collection.countDocuments({});
    const totalPages = Math.max(Math.ceil(totalDocuments / normalizedPageSize), 1);
    const safePage = Math.min(normalizedPage, totalPages);
    const skip = (safePage - 1) * normalizedPageSize;

    const documents = await collection
        .find({})
        .sort({ _id: -1 })
        .skip(skip)
        .limit(normalizedPageSize)
        .toArray();

    return {
        collection: collectionName,
        documents: documents.map((document) => toDocumentSummary(document)),
        pagination: {
            page: safePage,
            pageSize: normalizedPageSize,
            totalDocuments,
            totalPages,
        },
    };
}

export async function getDocumentForExplorer(
    collectionName: string,
    documentKey: string
): Promise<MongoExplorerDocumentSummary> {
    await assertCollectionExists(collectionName);

    const db = await getDb();
    const collection = db.collection<ExplorerDocument>(collectionName);
    const originalId = parseDocumentKey(documentKey) as ExplorerDocument['_id'];
    const idFilter = { _id: originalId } as Filter<ExplorerDocument>;
    const document = await collection.findOne(idFilter);

    if (!document) {
        throw new Error('Document was not found');
    }

    return toDocumentSummary(document);
}

export async function updateDocumentForExplorer(
    collectionName: string,
    documentKey: string,
    serializedDocument: MongoSerializedObject
): Promise<MongoExplorerDocumentSummary> {
    await assertCollectionExists(collectionName);

    const db = await getDb();
    const collection = db.collection<ExplorerDocument>(collectionName);
    const originalId = parseDocumentKey(documentKey) as ExplorerDocument['_id'];
    const parsedDocument = deserializeMongoValue(serializedDocument);

    if (!isPlainObject(parsedDocument)) {
        throw new Error('Document payload must be a JSON object');
    }

    if ('_id' in parsedDocument && !valuesMatch(parsedDocument._id, originalId)) {
        throw new Error('Changing _id is not supported');
    }

    const nextDocument: ExplorerDocument = {
        ...parsedDocument,
        _id: originalId,
    };
    const idFilter = { _id: originalId } as Filter<ExplorerDocument>;
    const currentDocument = await collection.findOne(idFilter);

    if (!currentDocument) {
        throw new Error('Document was not found');
    }

    assertCompatibleFieldTypes(currentDocument, nextDocument);

    const result = await collection.replaceOne(idFilter, nextDocument);

    if (result.matchedCount === 0) {
        throw new Error('Document was not found');
    }

    const updatedDocument = await collection.findOne(idFilter);

    if (!updatedDocument) {
        throw new Error('Updated document could not be loaded');
    }

    return toDocumentSummary(updatedDocument);
}

export async function duplicateDocumentForExplorer(
    collectionName: string,
    documentKey: string
): Promise<MongoExplorerDocumentSummary> {
    await assertCollectionExists(collectionName);

    const db = await getDb();
    const collection = db.collection<ExplorerDocument>(collectionName);
    const originalId = parseDocumentKey(documentKey) as ExplorerDocument['_id'];
    const idFilter = { _id: originalId } as Filter<ExplorerDocument>;
    const currentDocument = await collection.findOne(idFilter);

    if (!currentDocument) {
        throw new Error('Document was not found');
    }

    const duplicatedDocument: ExplorerDocument = {
        ...cloneExplorerValue(currentDocument),
        _id: createDuplicateId(currentDocument._id) as ExplorerDocument['_id'],
    };

    await collection.insertOne(duplicatedDocument);

    return toDocumentSummary(duplicatedDocument);
}

export async function deleteDocumentForExplorer(
    collectionName: string,
    documentKey: string
): Promise<void> {
    await assertCollectionExists(collectionName);

    const db = await getDb();
    const collection = db.collection<ExplorerDocument>(collectionName);
    const originalId = parseDocumentKey(documentKey) as ExplorerDocument['_id'];
    const idFilter = { _id: originalId } as Filter<ExplorerDocument>;
    const result = await collection.deleteOne(idFilter);

    if (result.deletedCount === 0) {
        throw new Error('Document was not found');
    }
}
