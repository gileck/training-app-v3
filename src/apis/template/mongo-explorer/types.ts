type MongoSerializedPrimitive = string | number | boolean | null;

export interface MongoSerializedObject {
    [key: string]: MongoSerializedValue;
}

export type MongoSerializedValue =
    | MongoSerializedPrimitive
    | MongoSerializedObject
    | MongoSerializedValue[];

export interface MongoExplorerCollectionSummary {
    name: string;
    documentCount: number;
}

export interface MongoExplorerDocumentSummary {
    documentKey: string;
    idLabel: string;
    preview: string;
    document: MongoSerializedObject;
}

export interface MongoExplorerPagination {
    page: number;
    pageSize: number;
    totalDocuments: number;
    totalPages: number;
}

export interface ListMongoCollectionsResponse {
    error?: string;
    dbName?: string;
    collections?: MongoExplorerCollectionSummary[];
}

export interface ListMongoDocumentsRequest {
    collection: string;
    page?: number;
    pageSize?: number;
}

export interface ListMongoDocumentsResponse {
    error?: string;
    collection?: string;
    documents?: MongoExplorerDocumentSummary[];
    pagination?: MongoExplorerPagination;
}

export interface GetMongoDocumentRequest {
    collection: string;
    documentKey: string;
}

export interface GetMongoDocumentResponse {
    error?: string;
    collection?: string;
    document?: MongoExplorerDocumentSummary;
}

export interface UpdateMongoDocumentRequest {
    collection: string;
    documentKey: string;
    document: MongoSerializedObject;
}

export interface UpdateMongoDocumentResponse {
    error?: string;
    document?: MongoExplorerDocumentSummary;
}

export interface DuplicateMongoDocumentRequest {
    collection: string;
    documentKey: string;
}

export interface DuplicateMongoDocumentResponse {
    error?: string;
    document?: MongoExplorerDocumentSummary;
}

export interface DeleteMongoDocumentRequest {
    collection: string;
    documentKey: string;
}

export interface DeleteMongoDocumentResponse {
    error?: string;
    deletedDocumentKey?: string;
}
