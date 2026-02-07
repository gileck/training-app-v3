import { useState } from 'react';
import { ArrowLeft, CheckCircle, Trash2, Bug, Lightbulb, Clock, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/client/components/template/ui/button';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Badge } from '@/client/components/template/ui/badge';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { toast } from '@/client/components/template/ui/toast';
import { useRouter } from '@/client/features/template/router';
import { useItemDetail, useApproveItem, useDeleteItem, parseItemId } from './hooks';

interface ItemDetailPageProps {
    id: string;
}

export function ItemDetailPage({ id }: ItemDetailPageProps) {
    const { navigate } = useRouter();
    const { mongoId } = parseItemId(id);
    const { item, isLoading, error } = useItemDetail(id);
    const { approveFeature, approveBug, isPending: isApproving } = useApproveItem();
    const { deleteFeature, deleteBug, isPending: isDeleting } = useDeleteItem();

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral modal open state
    const [showApproveDialog, setShowApproveDialog] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral modal open state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
        setShowApproveDialog(false);
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
        setShowDeleteDialog(false);
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

            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant={isFeature ? 'default' : 'destructive'}>
                        {isFeature ? (
                            <><Lightbulb className="mr-1 h-3 w-3" /> Feature</>
                        ) : (
                            <><Bug className="mr-1 h-3 w-3" /> Bug</>
                        )}
                    </Badge>
                    <Badge variant="outline">{status}</Badge>
                    {isFeature && item.feature!.priority && (
                        <Badge variant="secondary">{item.feature!.priority}</Badge>
                    )}
                    {isFeature && item.feature!.source && (
                        <Badge variant="secondary">via {item.feature!.source}</Badge>
                    )}
                    {!isFeature && item.report!.source && (
                        <Badge variant="secondary">via {item.report!.source}</Badge>
                    )}
                </div>
                <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{new Date(createdAt).toLocaleDateString()}</span>
                    {isFeature && item.feature!.requestedByName && (
                        <span>by {item.feature!.requestedByName}</span>
                    )}
                    {!isFeature && item.report!.route && (
                        <span>on {item.report!.route}</span>
                    )}
                </div>
            </div>

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

            {/* Action buttons - fixed bottom bar on mobile */}
            <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-3 sm:relative sm:border-0 sm:p-0 sm:mt-6">
                <div className="flex gap-3 sm:justify-start">
                    {isNew && !isAlreadySynced && (
                        <Button
                            className="flex-1 sm:flex-initial"
                            onClick={() => setShowApproveDialog(true)}
                            disabled={isApproving || isDeleting}
                        >
                            {isApproving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle className="mr-2 h-4 w-4" />
                            )}
                            Approve
                        </Button>
                    )}
                    {!isAlreadySynced && (
                        <Button
                            variant="destructive"
                            className="flex-1 sm:flex-initial"
                            onClick={() => setShowDeleteDialog(true)}
                            disabled={isApproving || isDeleting}
                        >
                            {isDeleting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Delete
                        </Button>
                    )}
                </div>
            </div>

            {/* Bottom spacer to prevent content from being hidden behind fixed bar on mobile */}
            <div className="h-16 sm:hidden" />

            {/* Confirmation dialogs */}
            <ConfirmDialog
                open={showApproveDialog}
                onOpenChange={setShowApproveDialog}
                title="Approve Item"
                description="This will create a GitHub issue and sync the item. Continue?"
                confirmText={isApproving ? 'Approving...' : 'Approve'}
                onConfirm={handleApprove}
            />
            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Delete Item"
                description="This will permanently delete this item from the database. This action cannot be undone."
                confirmText={isDeleting ? 'Deleting...' : 'Delete'}
                onConfirm={handleDelete}
                variant="destructive"
            />
        </div>
    );
}
