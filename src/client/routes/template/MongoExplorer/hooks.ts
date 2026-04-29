import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteMongoDocument,
    duplicateMongoDocument,
    getMongoDocument,
    listMongoCollections,
    listMongoDocuments,
    updateMongoDocument,
} from '@/apis/template/mongo-explorer/client';
import type {
    DeleteMongoDocumentRequest,
    DuplicateMongoDocumentRequest,
    GetMongoDocumentRequest,
    ListMongoDocumentsRequest,
    MongoExplorerCollectionSummary,
    MongoExplorerDocumentSummary,
    MongoExplorerPagination,
    MongoSerializedObject,
} from '@/apis/template/mongo-explorer/types';
import { useQueryDefaults } from '@/client/query';
import { toast } from '@/client/components/template/ui/toast';

interface MongoCollectionsData {
    dbName: string;
    collections: MongoExplorerCollectionSummary[];
}

interface MongoDocumentsData {
    collection: string;
    documents: MongoExplorerDocumentSummary[];
    pagination: MongoExplorerPagination;
}

export const mongoExplorerQueryKeys = {
    collections: ['mongo-explorer', 'collections'] as const,
    documents: (collection: string, page: number, pageSize: number) =>
        ['mongo-explorer', 'documents', collection, page, pageSize] as const,
    document: (collection: string, documentKey: string) =>
        ['mongo-explorer', 'document', collection, documentKey] as const,
};

export function useMongoCollections() {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: mongoExplorerQueryKeys.collections,
        queryFn: async (): Promise<MongoCollectionsData> => {
            const result = await listMongoCollections();
            if (result.data?.error) {
                throw new Error(result.data.error);
            }

            return {
                dbName: result.data?.dbName ?? '',
                collections: result.data?.collections ?? [],
            };
        },
        ...queryDefaults,
    });
}

export function useMongoDocuments(request: ListMongoDocumentsRequest, enabled: boolean) {
    const queryDefaults = useQueryDefaults();
    const page = request.page ?? 1;
    const pageSize = request.pageSize ?? 25;

    return useQuery({
        queryKey: mongoExplorerQueryKeys.documents(request.collection, page, pageSize),
        queryFn: async (): Promise<MongoDocumentsData> => {
            const result = await listMongoDocuments(request);
            if (result.data?.error) {
                throw new Error(result.data.error);
            }

            return {
                collection: result.data?.collection ?? request.collection,
                documents: result.data?.documents ?? [],
                pagination: result.data?.pagination ?? {
                    page,
                    pageSize,
                    totalDocuments: 0,
                    totalPages: 1,
                },
            };
        },
        enabled,
        ...queryDefaults,
    });
}

export function useMongoDocument(request: GetMongoDocumentRequest, enabled: boolean) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: mongoExplorerQueryKeys.document(request.collection, request.documentKey),
        queryFn: async (): Promise<MongoExplorerDocumentSummary> => {
            const result = await getMongoDocument(request);
            if (result.data?.error) {
                throw new Error(result.data.error);
            }

            if (!result.data?.document) {
                throw new Error('Document was not returned');
            }

            return result.data.document;
        },
        enabled,
        ...queryDefaults,
    });
}

interface UpdateDocumentVariables {
    collection: string;
    documentKey: string;
    document: MongoSerializedObject;
}

export function useMongoUpdateDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (variables: UpdateDocumentVariables) => {
            const result = await updateMongoDocument(variables);
            if (result.data?.error) {
                throw new Error(result.data.error);
            }

            if (!result.data?.document) {
                throw new Error('Updated document was not returned');
            }

            return result.data.document;
        },
        onSuccess: async (_document, variables) => {
            await queryClient.invalidateQueries({
                queryKey: ['mongo-explorer', 'documents', variables.collection],
            });
            await queryClient.invalidateQueries({
                queryKey: ['mongo-explorer', 'document', variables.collection, variables.documentKey],
            });
            toast.success('Document updated');
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to update document');
        },
    });
}

export function useMongoDuplicateDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (variables: DuplicateMongoDocumentRequest) => {
            const result = await duplicateMongoDocument(variables);
            if (result.data?.error) {
                throw new Error(result.data.error);
            }

            if (!result.data?.document) {
                throw new Error('Duplicated document was not returned');
            }

            return result.data.document;
        },
        onSuccess: async (document, variables) => {
            await queryClient.invalidateQueries({
                queryKey: ['mongo-explorer', 'documents', variables.collection],
            });
            await queryClient.invalidateQueries({
                queryKey: ['mongo-explorer', 'collections'],
            });
            await queryClient.setQueryData(
                mongoExplorerQueryKeys.document(variables.collection, document.documentKey),
                document
            );
            toast.success('Document duplicated');
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to duplicate document');
        },
    });
}

export function useMongoDeleteDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (variables: DeleteMongoDocumentRequest) => {
            const result = await deleteMongoDocument(variables);
            if (result.data?.error) {
                throw new Error(result.data.error);
            }

            return result.data;
        },
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({
                queryKey: ['mongo-explorer', 'documents', variables.collection],
            });
            await queryClient.invalidateQueries({
                queryKey: ['mongo-explorer', 'collections'],
            });
            await queryClient.removeQueries({
                queryKey: mongoExplorerQueryKeys.document(variables.collection, variables.documentKey),
            });
            toast.success('Document deleted');
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to delete document');
        },
    });
}
