import { useRouter } from '@/client/features';
import { useMongoCollections } from './hooks';
import { MongoCollectionsPage } from './MongoCollectionsPage';
import { MongoDocumentPage } from './MongoDocumentPage';
import { MongoDocumentsPage } from './MongoDocumentsPage';
import { decodeRouteSegment } from './utils';

export function MongoExplorer() {
    const { routeParams } = useRouter();
    const collectionName = decodeRouteSegment(routeParams.collectionName);
    const documentKey = decodeRouteSegment(routeParams.documentKey);
    const isCollectionPage = collectionName.length > 0;
    const isDocumentPage = collectionName.length > 0 && documentKey.length > 0;

    const collectionsQuery = useMongoCollections();
    const dbName = collectionsQuery.data?.dbName ?? 'db';

    if (isDocumentPage) {
        return (
            <MongoDocumentPage
                collectionName={collectionName}
                documentKey={documentKey}
                onRefresh={() => {
                    void collectionsQuery.refetch();
                }}
            />
        );
    }

    if (isCollectionPage) {
        return (
            <MongoDocumentsPage
                collectionName={collectionName}
                onRefresh={() => {
                    void collectionsQuery.refetch();
                }}
            />
        );
    }

    return <MongoCollectionsPage dbName={dbName} collectionsQuery={collectionsQuery} />;
}
