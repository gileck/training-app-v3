import { listDocumentsForExplorer } from '@/server/template/mongoExplorer';
import type {
    ListMongoDocumentsRequest,
    ListMongoDocumentsResponse,
} from '../types';

export async function listMongoDocumentsHandler(
    request: ListMongoDocumentsRequest
): Promise<ListMongoDocumentsResponse> {
    const result = await listDocumentsForExplorer(
        request.collection,
        request.page,
        request.pageSize
    );

    return {
        collection: result.collection,
        documents: result.documents,
        pagination: result.pagination,
    };
}
