import { ArrowLeft, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/client/components/template/ui/button';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { toast } from '@/client/components/template/ui/toast';
import { useRouter } from '@/client/features/template/router';
import { useItemDetail, useApproveItem, useDeleteItem, parseItemId } from './hooks';
import { ItemDetailHeader } from './components/ItemDetailHeader';
import { ItemDetailActions } from './components/ItemDetailActions';

interface ItemDetailPageProps {
    id: string;
}

export function ItemDetailPage({ id }: ItemDetailPageProps) {
    const { navigate } = useRouter();
    const { mongoId } = parseItemId(id);
    const { item, isLoading, error } = useItemDetail(id);
    const { approveFeature, approveBug, isPending: isApproving } = useApproveItem();
    const { deleteFeature, deleteBug, isPending: isDeleting } = useDeleteItem();

    const navigateBack = () => {
        navigate('/admin/workflow');
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="container mx-auto max-w-4xl px-3 py-6">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading item...</span>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="container mx-auto max-w-4xl px-3 py-6">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-destructive">Error loading item: {error.message}</p>
                        <Button variant="outline" className="mt-4" onClick={() => navigateBack()}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Not found state
    if (!item) {
        return (
            <div className="container mx-auto max-w-4xl px-3 py-6">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-muted-foreground">Item not found.</p>
                        <Button variant="outline" className="mt-4" onClick={() => navigateBack()}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { type } = item;
    const isFeature = type === 'feature';
    const title = isFeature
        ? item.feature!.title
        : item.report!.description?.split('\n')[0]?.slice(0, 100) || 'Bug Report';
    const description = isFeature
        ? item.feature!.description
        : item.report!.description || '';
    const status = isFeature ? item.feature!.status : item.report!.status;
    const createdAt = isFeature ? item.feature!.createdAt : item.report!.createdAt;
    const isNew = status === 'new';
    const isAlreadySynced = isFeature
        ? !!item.feature!.githubIssueUrl
        : !!item.report!.githubIssueUrl;

    const handleApprove = async () => {
        try {
            if (isFeature) {
                await approveFeature(mongoId);
            } else {
                await approveBug(mongoId);
            }
            toast.success('Item approved and synced to GitHub');
            navigateBack();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to approve');
        }
    };

    const handleDelete = async () => {
        try {
            if (isFeature) {
                await deleteFeature(mongoId);
            } else {
                await deleteBug(mongoId);
            }
            toast.success('Item deleted');
            navigateBack();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete');
        }
    };

    return (
        <div className="container mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
            {/* Sticky back button on mobile */}
            <div className="sticky top-0 z-10 -mx-3 mb-4 bg-background px-3 py-2 shadow-sm sm:relative sm:mx-0 sm:px-0 sm:py-0 sm:shadow-none sm:mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateBack()}
                >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                </Button>
            </div>

            <ItemDetailHeader
                isFeature={isFeature}
                title={title}
                status={status}
                createdAt={createdAt}
                priority={isFeature ? item.feature!.priority : undefined}
                source={isFeature ? item.feature!.source : item.report!.source}
                requestedByName={isFeature ? item.feature!.requestedByName : undefined}
                route={!isFeature ? item.report!.route : undefined}
            />

            {/* Description */}
            <Card className="mb-6">
                <CardContent className="pt-6">
                    <div className="markdown-body text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {description}
                        </ReactMarkdown>
                    </div>
                </CardContent>
            </Card>

            {/* Bug-specific details */}
            {!isFeature && item.report!.errorMessage && (
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-destructive mb-1">Error Message</p>
                        <code className="block text-xs bg-muted p-2 rounded overflow-auto">
                            {item.report!.errorMessage}
                        </code>
                    </CardContent>
                </Card>
            )}

            {!isFeature && item.report!.stackTrace && (
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-destructive mb-1">Stack Trace</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                            {item.report!.stackTrace}
                        </pre>
                    </CardContent>
                </Card>
            )}

            {/* GitHub link if already synced */}
            {isAlreadySynced && (
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">
                            Already synced to GitHub:{' '}
                            <a
                                href={isFeature ? item.feature!.githubIssueUrl : item.report!.githubIssueUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline"
                            >
                                View Issue
                            </a>
                        </p>
                    </CardContent>
                </Card>
            )}

            <ItemDetailActions
                isNew={isNew}
                isAlreadySynced={isAlreadySynced}
                isApproving={isApproving}
                isDeleting={isDeleting}
                onApprove={handleApprove}
                onDelete={handleDelete}
            />
        </div>
    );
}
