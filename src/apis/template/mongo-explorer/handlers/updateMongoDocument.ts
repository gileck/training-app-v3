import { updateDocumentForExplorer } from '@/server/template/mongoExplorer';
import type {
    UpdateMongoDocumentRequest,
    UpdateMongoDocumentResponse,
} from '../types';

export async function updateMongoDocumentHandler(
    request: UpdateMongoDocumentRequest
): Promise<UpdateMongoDocumentResponse> {
    const document = await updateDocumentForExplorer(
        request.collection,
        request.documentKey,
        request.document
    );

    return { document };
}
