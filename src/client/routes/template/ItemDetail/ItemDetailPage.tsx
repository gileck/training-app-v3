import { useState, useMemo } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/client/components/template/ui/button';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { toast } from '@/client/components/template/ui/toast';
import { useRouter } from '@/client/features/template/router';
import { ErrorDisplay } from '@/client/features/template/error-tracking';
import { updateWorkflowStatus } from '@/apis/template/workflow/client';
import { useItemDetail, useApproveItem, useDeleteItem, useRouteItem, parseItemId } from './hooks';
import type { ItemType } from './hooks';
import { ItemDetailActions } from './components/ItemDetailActions';
import { ItemDetailHeader } from './components/ItemDetailHeader';
import { useWorkflowItems } from '@/client/routes/template/Workflow/hooks';
import { WorkflowHistory } from '@/client/routes/template/Workflow/WorkflowHistory';
import type { WorkflowHistoryEntry } from '@/apis/template/workflow/types';

const EMPTY_HISTORY: WorkflowHistoryEntry[] = [];

interface ItemDetailPageProps {
    id: string;
}

export function ItemDetailPage({ id }: ItemDetailPageProps) {
    const { navigate } = useRouter();
    const { mongoId } = parseItemId(id);

    // Workflow-only items (no ':' in ID) don't have source docs
    const isWorkflowItem = !id.includes(':');
    const sourceDetailId = isWorkflowItem ? undefined : id;
    const { item, isLoading, error } = useItemDetail(sourceDetailId);

    const { approveFeature, approveBug, isPending: isApproving } = useApproveItem();
    const { deleteFeature, deleteBug, isPending: isDeleting } = useDeleteItem();
    const { routeItem, isPending: isRouting } = useRouteItem();
    const queryClient = useQueryClient();

    const updateStatusMutation = useMutation({
        mutationFn: async ({ sourceId, sourceType, status }: { sourceId: string; sourceType: 'feature' | 'bug'; status: string }) => {
            const result = await updateWorkflowStatus({ sourceId, sourceType, status });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['workflow-items'] });
        },
    });

    const { data: workflowData } = useWorkflowItems();

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral routing dialog state after approve
    const [showRoutingDialog, setShowRoutingDialog] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral item type for routing
    const [routingItemType, setRoutingItemType] = useState<ItemType>('feature');

    // Match workflow item by ID or sourceId
    const matchedWorkflowItem = useMemo(() => {
        if (!workflowData?.workflowItems) return null;
        if (isWorkflowItem) {
            return workflowData.workflowItems.find((wi) => wi.id === id) || null;
        }
        return workflowData.workflowItems.find((wi) => wi.sourceId === id) || null;
    }, [workflowData?.workflowItems, id, isWorkflowItem]);

    const historyEntries = matchedWorkflowItem?.history || EMPTY_HISTORY;

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
                <ErrorDisplay
                    error={error}
                    title="Failed to load item"
                    onBack={navigateBack}
                    backLabel="Go Back"
                />
            </div>
        );
    }

    // Not found state — need either source doc or workflow item
    const hasData = !!item || !!matchedWorkflowItem;
    if (!hasData) {
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

    const type = item?.type ?? (matchedWorkflowItem?.type === 'bug' ? 'bug' : 'feature');
    const isFeature = type === 'feature';
    const title = item
        ? (isFeature ? item.feature!.title : item.report!.description?.split('\n')[0]?.slice(0, 100) || 'Bug Report')
        : (matchedWorkflowItem?.content?.title || 'Untitled');
    const description = item
        ? (isFeature ? item.feature!.description : item.report!.description || '')
        : (matchedWorkflowItem?.description || '');
    const status = item
        ? (isFeature ? item.feature!.status : item.report!.status)
        : (matchedWorkflowItem?.status || '');
    const createdAt = item
        ? (isFeature ? item.feature!.createdAt : item.report!.createdAt)
        : (matchedWorkflowItem?.createdAt || '');
    const isNew = status === 'new';
    const isAlreadySynced = item
        ? (isFeature ? !!item.feature!.githubIssueUrl : !!item.report!.githubIssueUrl)
        : !!matchedWorkflowItem?.content?.url;

    const handleApprove = async () => {
        try {
            let needsRouting = false;
            if (isFeature) {
                const result = await approveFeature(mongoId);
                needsRouting = !!result?.needsRouting;
            } else {
                const result = await approveBug(mongoId);
                needsRouting = !!result?.needsRouting;
            }

            if (needsRouting) {
                toast.success('Item approved! Choose where to route it.');
                setRoutingItemType(type);
                setShowRoutingDialog(true);
            } else {
                toast.success('Item approved and synced to GitHub');
                navigateBack();
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to approve');
        }
    };

    const handleRoute = async (routeStatus: string) => {
        try {
            await routeItem({
                sourceId: mongoId,
                sourceType: routingItemType,
                status: routeStatus,
            });
            toast.success(`Routed to ${routeStatus}`);
            setShowRoutingDialog(false);
            navigateBack();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to route');
        }
    };

    const handleSkipRouting = () => {
        setShowRoutingDialog(false);
        navigateBack();
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

    const handleStatusChange = async (newStatus: string) => {
        try {
            const sourceType = isFeature ? 'feature' as const : 'bug' as const;
            await updateStatusMutation.mutateAsync({ sourceId: mongoId, sourceType, status: newStatus });
            toast.success(`Moved to ${newStatus}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update status');
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
                priority={matchedWorkflowItem?.priority || item?.feature?.priority}
                source={item ? (isFeature ? item.feature!.source : item.report!.source) : undefined}
                requestedByName={item?.feature?.requestedByName}
                route={item?.report?.route}
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

            {/* History */}
            {historyEntries.length > 0 && (
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <WorkflowHistory entries={historyEntries} />
                    </CardContent>
                </Card>
            )}

            {/* Bug-specific details */}
            {item?.report?.errorMessage && (
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-destructive mb-1">Error Message</p>
                        <code className="block text-xs bg-muted p-2 rounded overflow-auto">
                            {item.report.errorMessage}
                        </code>
                    </CardContent>
                </Card>
            )}

            {item?.report?.stackTrace && (
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium text-destructive mb-1">Stack Trace</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                            {item.report.stackTrace}
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
                                href={item ? (isFeature ? item.feature!.githubIssueUrl : item.report!.githubIssueUrl) : matchedWorkflowItem?.content?.url}
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
                isRouting={isRouting}
                showRoutingDialog={showRoutingDialog}
                routingItemType={routingItemType}
                onApprove={handleApprove}
                onDelete={handleDelete}
                onRoute={handleRoute}
                onSkipRouting={handleSkipRouting}
                onStatusChange={handleStatusChange}
            />
        </div>
    );
}
