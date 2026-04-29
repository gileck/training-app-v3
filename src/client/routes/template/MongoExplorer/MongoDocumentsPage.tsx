import { useEffect, useState } from 'react';
import { useRouter } from '@/client/features';
import { Alert, AlertDescription } from '@/client/components/template/ui/alert';
import { Badge } from '@/client/components/template/ui/badge';
import { Button } from '@/client/components/template/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/client/components/template/ui/card';
import { ArrowLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useMongoDocuments } from './hooks';
import { CenteredLoading } from './components/CenteredLoading';
import { EmptyState } from './components/EmptyState';
import { PageHeader } from './components/PageHeader';
import {
    PAGE_SIZE,
    ROOT_PATH,
    formatCountLabel,
    getDocumentPath,
} from './utils';

export function MongoDocumentsPage({
    collectionName,
    onRefresh,
}: {
    collectionName: string;
    onRefresh: () => void;
}) {
    const { navigate } = useRouter();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral pagination state for the collection document list
    const [page, setPage] = useState(1);

    useEffect(() => {
        setPage(1);
    }, [collectionName]);

    const documentsQuery = useMongoDocuments(
        {
            collection: collectionName,
            page,
            pageSize: PAGE_SIZE,
        },
        collectionName.length > 0
    );
    const documents = documentsQuery.data?.documents ?? [];
    const pagination = documentsQuery.data?.pagination;
    const isLoadingDocuments = documentsQuery.isLoading && !documentsQuery.data;

    return (
        <div className="mx-auto max-w-5xl px-2 py-4 pb-20 sm:px-4 sm:pb-6">
            <PageHeader
                title={collectionName}
                description="Documents in this collection."
                breadcrumbs={[
                    { label: 'db', path: ROOT_PATH },
                    { label: collectionName },
                ]}
                actions={[
                    <Button key="back" variant="outline" onClick={() => navigate(ROOT_PATH)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Collections
                    </Button>,
                    <Button
                        key="refresh"
                        variant="outline"
                        onClick={() => {
                            onRefresh();
                            void documentsQuery.refetch();
                        }}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>,
                ]}
            />

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-lg">Documents</CardTitle>
                            <CardDescription>
                                Select a document to open view/edit mode.
                            </CardDescription>
                        </div>
                        {pagination && (
                            <Badge variant="secondary">
                                {formatCountLabel(pagination.totalDocuments)} total
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {documentsQuery.error && (
                        <Alert variant="destructive">
                            <AlertDescription>{documentsQuery.error.message}</AlertDescription>
                        </Alert>
                    )}

                    {isLoadingDocuments ? (
                        <CenteredLoading label="Loading documents" />
                    ) : documents.length === 0 ? (
                        <EmptyState
                            title="No documents in this collection"
                            description="This collection exists, but it does not have any documents yet."
                        />
                    ) : (
                        <div className="space-y-3">
                            {documents.map((document) => (
                                <button
                                    key={document.documentKey}
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            getDocumentPath(
                                                collectionName,
                                                document.documentKey
                                            )
                                        )
                                    }
                                    className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">
                                                {document.idLabel}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {document.preview}
                                            </p>
                                        </div>
                                        <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-muted-foreground">
                                Page {pagination.page} of {pagination.totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPage((current) => current - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => setPage((current) => current + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
