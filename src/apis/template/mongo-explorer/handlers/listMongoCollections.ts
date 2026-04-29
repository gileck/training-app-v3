import { listCollectionsForExplorer } from '@/server/template/mongoExplorer';
import type { ListMongoCollectionsResponse } from '../types';

export async function listMongoCollectionsHandler(): Promise<ListMongoCollectionsResponse> {
    const result = await listCollectionsForExplorer();

    return {
        dbName: result.dbName,
        collections: result.collections,
    };
}
