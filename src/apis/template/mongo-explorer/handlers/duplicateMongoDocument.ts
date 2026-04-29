import { duplicateDocumentForExplorer } from '@/server/template/mongoExplorer';
import type {
    DuplicateMongoDocumentRequest,
    DuplicateMongoDocumentResponse,
} from '../types';

export async function duplicateMongoDocumentHandler(
    request: DuplicateMongoDocumentRequest
): Promise<DuplicateMongoDocumentResponse> {
    const document = await duplicateDocumentForExplorer(
        request.collection,
        request.documentKey
    );

    return { document };
}
