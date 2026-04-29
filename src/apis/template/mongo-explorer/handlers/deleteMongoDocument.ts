import { deleteDocumentForExplorer } from '@/server/template/mongoExplorer';
import type {
    DeleteMongoDocumentRequest,
    DeleteMongoDocumentResponse,
} from '../types';

export async function deleteMongoDocumentHandler(
    request: DeleteMongoDocumentRequest
): Promise<DeleteMongoDocumentResponse> {
    await deleteDocumentForExplorer(
        request.collection,
        request.documentKey
    );

    return { deletedDocumentKey: request.documentKey };
}
