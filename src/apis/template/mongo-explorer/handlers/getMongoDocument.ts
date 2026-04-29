import { getDocumentForExplorer } from '@/server/template/mongoExplorer';
import type {
    GetMongoDocumentRequest,
    GetMongoDocumentResponse,
} from '../types';

export async function getMongoDocumentHandler(
    request: GetMongoDocumentRequest
): Promise<GetMongoDocumentResponse> {
    const document = await getDocumentForExplorer(
        request.collection,
        request.documentKey
    );

    return {
        collection: request.collection,
        document,
    };
}
