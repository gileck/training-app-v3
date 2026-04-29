export * from './index';

import {
    API_DELETE_DOCUMENT,
    API_DUPLICATE_DOCUMENT,
    API_GET_DOCUMENT,
    API_LIST_COLLECTIONS,
    API_LIST_DOCUMENTS,
    API_UPDATE_DOCUMENT,
} from './index';
import { deleteMongoDocumentHandler } from './handlers/deleteMongoDocument';
import { duplicateMongoDocumentHandler } from './handlers/duplicateMongoDocument';
import { getMongoDocumentHandler } from './handlers/getMongoDocument';
import { listMongoCollectionsHandler } from './handlers/listMongoCollections';
import { listMongoDocumentsHandler } from './handlers/listMongoDocuments';
import { updateMongoDocumentHandler } from './handlers/updateMongoDocument';

export const mongoExplorerApiHandlers = {
    [API_LIST_COLLECTIONS]: { process: listMongoCollectionsHandler },
    [API_LIST_DOCUMENTS]: { process: listMongoDocumentsHandler },
    [API_GET_DOCUMENT]: { process: getMongoDocumentHandler },
    [API_UPDATE_DOCUMENT]: { process: updateMongoDocumentHandler },
    [API_DUPLICATE_DOCUMENT]: { process: duplicateMongoDocumentHandler },
    [API_DELETE_DOCUMENT]: { process: deleteMongoDocumentHandler },
};
