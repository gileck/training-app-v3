/**
 * ItemPreviewDialog
 *
 * Full modal dialog for previewing and acting on a workflow item.
 * Organized into three zones: header (fixed top), scrollable content, actions panel (fixed bottom).
 */

import { useState, useMemo } from 'react';
import { Loader2, ExternalLink, Clock, CheckCircle, Trash2, Copy, Archive } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/client/components/template/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/client/components/template/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/client/components/template/ui/select';
import { Separator } from '@/client/components/template/ui/separator';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { toast } from '@/client/components/template/ui/toast';
import { useRouter } from '@/client/features';
import { useQueryClient } from '@tanstack/react-query';
import { useItemDetail, useApproveItem, useDeleteItem, useRouteItem, parseItemId } from '@/client/routes/template/ItemDetail/hooks';
import { useUpdateWorkflowStatus, useUpdateWorkflowFields } from './hooks';
import { WorkflowActionButtons } from './WorkflowActionButtons';
import { WorkflowHistory } from './WorkflowHistory';
import { StatusBadge } from './StatusBadge';
import { ALL_STATUSES } from './constants';
import type { WorkflowItem } from '@/apis/template/workflow/types';

export function ItemPreviewDialog({ itemId, onClose, workflowItems }: { itemId: string | null; onClose: () => void; workflowItems?: WorkflowItem[] }) {
    const { navigate } = useRouter();
    const queryClient = useQueryClient();

    // Workflow-only items (no ':' in ID) don't have source docs — skip source doc fetch
    const isWorkflowItem = itemId ? !itemId.includes(':') : false;
    const sourceDetailId = isWorkflowItem ? undefined : (itemId || undefined);
    const { item, isLoading } = useItemDetail(sourceDetailId);

    const { approveFeature, approveBug, isPending: isApproving } = useApproveItem();
    const { deleteFeature, deleteBug, isPending: isDeleting } = useDeleteItem();
    const { routeItem, isPending: isRouting } = useRouteItem();
    const updateStatusMutation = useUpdateWorkflowStatus();
    const updateFieldsMutation = useUpdateWorkflowFields();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral confirm dialog state
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral confirm dialog state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral post-approval routing state
    const [showRouting, setShowRouting] = useState(false);

    const matchedWorkflowItem = useMemo(() => {
        if (!workflowItems || !itemId) return null;
        if (isWorkflowItem) {
            return workflowItems.find((wi) => wi.id === itemId) || null;
        }
        return workflowItems.find((wi) => wi.sourceId === itemId) || null;
    }, [workflowItems, itemId, isWorkflowItem]);

    // Derive display data from source doc (when available) or workflow item
    const isFeature = item ? item.type === 'feature' : (matchedWorkflowItem?.type === 'feature' || matchedWorkflowItem?.type === 'task');
    const title = item
        ? (item.type === 'feature'
            ? item.feature!.title
            : item.report!.description?.split('\n')[0]?.slice(0, 100) || 'Bug Report')
        : (matchedWorkflowItem?.content?.title || 'Untitled');
    const description = item
        ? (item.type === 'feature' ? item.feature!.description : item.report!.description || '')
        : (matchedWorkflowItem?.description || '');
    const status = item
        ? (item.type === 'feature' ? item.feature!.status : item.report!.status)
        : (matchedWorkflowItem?.status || '');
    const createdAt = item
        ? (item.type === 'feature' ? item.feature!.createdAt : item.report!.createdAt)
        : (matchedWorkflowItem?.createdAt || '');
    const isNew = status === 'new';
    const isAlreadySynced = item
        ? (item.type === 'feature' ? !!item.feature!.githubIssueUrl : !!item.report!.githubIssueUrl)
        : !!matchedWorkflowItem?.content?.url;
    const canApprove = isNew && !isAlreadySynced;

    // For workflow-only items, the item is "found" if matchedWorkflowItem exists
    const hasData = !!item || !!matchedWorkflowItem;

    const workflowItemId = isWorkflowItem ? itemId : (matchedWorkflowItem?.id || null);
    const { mongoId } = itemId ? parseItemId(itemId) : { mongoId: '' };

    const handleCopyDetails = async () => {
        if (!hasData) return;
        const lines: string[] = [];
        lines.push(`[${isFeature ? 'Feature' : 'Bug'}] ${title}`);
        lines.push(`Status: ${matchedWorkflowItem?.status || status}`);
        if (matchedWorkflowItem?.priority) lines.push(`Priority: ${matchedWorkflowItem.priority}`);
        else if (item?.feature?.priority) lines.push(`Priority: ${item.feature.priority}`);
        if (createdAt) lines.push(`Created: ${new Date(createdAt).toLocaleDateString()}`);
        if (item?.feature?.requestedByName) lines.push(`Requested by: ${item.feature.requestedByName}`);
        if (item?.report?.route) lines.push(`Route: ${item.report.route}`);
        if (matchedWorkflowItem?.domain) lines.push(`Domain: ${matchedWorkflowItem.domain}`);
        if (description) {
            lines.push('');
            lines.push(description);
        }
        if (item?.report?.errorMessage) {
            lines.push('');
            lines.push(`Error: ${item.report.errorMessage}`);
        }
        if (ghUrl) {
            lines.push('');
            lines.push(`GitHub: ${ghUrl}`);
        }
        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            toast.success('Details copied to clipboard');
        } catch {
            toast.error('Failed to copy');
        }
    };

    const handleApprove = async () => {
        try {
            let result;
            if (isFeature) {
                result = await approveFeature(mongoId);
            } else {
                result = await approveBug(mongoId);
            }
            setShowApproveConfirm(false);
            queryClient.invalidateQueries({ queryKey: ['workflow-items'] });

            if (isFeature && result?.needsRouting) {
                toast.success('Approved — choose where to route');
                setShowRouting(true);
                return;
            }

            toast.success('Item approved and synced to GitHub');
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to approve');
        }
    };

    const handleApproveToBacklog = async () => {
        try {
            if (isFeature) {
                await approveFeature(mongoId, true);
            } else {
                await approveBug(mongoId, true);
            }
            toast.success('Approved and moved to Backlog');
            onClose();
            queryClient.invalidateQueries({ queryKey: ['workflow-items'] });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to approve');
        }
    };

    const handleRoute = async (routeStatus: string) => {
        try {
            const sourceType = isFeature ? 'feature' : 'bug';
            const sourceId = itemId!;
            await routeItem({ sourceId, sourceType, status: routeStatus });
            toast.success(`Routed to ${routeStatus}`);
            onClose();
            setShowRouting(false);
            queryClient.invalidateQueries({ queryKey: ['workflow-items'] });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to route');
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
            setShowDeleteConfirm(false);
            onClose();
            queryClient.invalidateQueries({ queryKey: ['workflow-items'] });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete');
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!workflowItemId) return;
        try {
            await updateStatusMutation.mutateAsync({ itemId: workflowItemId, status: newStatus });
            toast.success(`Moved to ${newStatus}`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to update status');
        }
    };

    const handleFieldChange = async (field: 'priority' | 'size' | 'complexity', value: string) => {
        if (!workflowItemId) return;
        try {
            await updateFieldsMutation.mutateAsync({
                itemId: workflowItemId,
                fields: { [field]: value === 'none' ? null : value },
            });
            toast.success(`${field} updated`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : `Failed to update ${field}`);
        }
    };

    const ghUrl = item
        ? (item.type === 'feature' ? item.feature!.githubIssueUrl : item.report!.githubIssueUrl)
        : (matchedWorkflowItem?.content?.url || null);
    const source = item
        ? (item.type === 'feature' ? item.feature!.source : item.report!.source)
        : null;

    return (
        <Dialog open={!!itemId} onOpenChange={(open) => { if (!open) { setShowRouting(false); onClose(); } }}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col !p-0">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : !hasData ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        Item not found.
                    </div>
                ) : (
                    <>
                        {/* Zone 1 — Header */}
                        <DialogHeader className="px-6 pt-6 pb-3">
                            <DialogTitle className="text-base leading-snug text-left pr-6">{title}</DialogTitle>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <StatusBadge label={isFeature ? 'Feature' : 'Bug'} colorKey={matchedWorkflowItem?.type || item?.type || 'feature'} />
                                <StatusBadge label={matchedWorkflowItem?.status || status} />
                                {matchedWorkflowItem?.reviewStatus && (
                                    <StatusBadge label={matchedWorkflowItem.reviewStatus} colorKey={matchedWorkflowItem.reviewStatus} />
                                )}
                                {createdAt && (
                                    <>
                                        <span className="text-muted-foreground text-xs">·</span>
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3 shrink-0" />
                                            {new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </>
                                )}
                                {item?.feature?.requestedByName && (
                                    <>
                                        <span className="text-muted-foreground text-xs">·</span>
                                        <span className="text-xs text-muted-foreground">by {item.feature.requestedByName}</span>
                                    </>
                                )}
                                {item?.report?.route && (
                                    <>
                                        <span className="text-muted-foreground text-xs">·</span>
                                        <span className="text-xs text-muted-foreground">on {item.report.route}</span>
                                    </>
                                )}
                                {matchedWorkflowItem?.createdBy && (
                                    <>
                                        <span className="text-muted-foreground text-xs">·</span>
                                        <span className="text-xs text-muted-foreground">by {matchedWorkflowItem.createdBy}</span>
                                    </>
                                )}
                            </div>
                        </DialogHeader>

                        <Separator />

                        {/* Zone 2 — Scrollable Content */}
                        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-3">
                            {/* Properties grid with inline editing */}
                            {matchedWorkflowItem && (
                                <div className="bg-muted/50 rounded-lg p-3 mb-4 flex flex-col gap-2.5">
                                    {/* Status */}
                                    {workflowItemId && matchedWorkflowItem.status && (
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-muted-foreground shrink-0 w-20">Status</span>
                                            <Select value={matchedWorkflowItem.status} onValueChange={handleStatusChange}>
                                                <SelectTrigger className="h-7 text-xs flex-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="z-[70]">
                                                    {ALL_STATUSES.map((s) => (
                                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {/* Editable fields */}
                                    {workflowItemId && (
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-muted-foreground px-1">Priority</span>
                                                <Select
                                                    value={matchedWorkflowItem.priority || 'none'}
                                                    onValueChange={(v) => handleFieldChange('priority', v)}
                                                >
                                                    <SelectTrigger className="h-7 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="z-[70]">
                                                        <SelectItem value="none">—</SelectItem>
                                                        <SelectItem value="critical">Critical</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="low">Low</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-muted-foreground px-1">Size</span>
                                                <Select
                                                    value={matchedWorkflowItem.size || 'none'}
                                                    onValueChange={(v) => handleFieldChange('size', v)}
                                                >
                                                    <SelectTrigger className="h-7 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="z-[70]">
                                                        <SelectItem value="none">—</SelectItem>
                                                        <SelectItem value="XS">XS</SelectItem>
                                                        <SelectItem value="S">S</SelectItem>
                                                        <SelectItem value="M">M</SelectItem>
                                                        <SelectItem value="L">L</SelectItem>
                                                        <SelectItem value="XL">XL</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-muted-foreground px-1">Complexity</span>
                                                <Select
                                                    value={matchedWorkflowItem.complexity || 'none'}
                                                    onValueChange={(v) => handleFieldChange('complexity', v)}
                                                >
                                                    <SelectTrigger className="h-7 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="z-[70]">
                                                        <SelectItem value="none">—</SelectItem>
                                                        <SelectItem value="High">High</SelectItem>
                                                        <SelectItem value="Medium">Medium</SelectItem>
                                                        <SelectItem value="Low">Low</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                    {/* Read-only metadata rows */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                        {matchedWorkflowItem.domain && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Domain</span>
                                                <StatusBadge label={matchedWorkflowItem.domain} colorKey="domain" />
                                            </div>
                                        )}
                                        {source && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Source</span>
                                                <span className="text-foreground">via {source}</span>
                                            </div>
                                        )}
                                        {ghUrl && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">GitHub</span>
                                                <a href={ghUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                                    View Issue →
                                                </a>
                                            </div>
                                        )}
                                        {matchedWorkflowItem.prData?.currentPrNumber && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">PR</span>
                                                <span className="text-foreground">#{matchedWorkflowItem.prData.currentPrNumber}</span>
                                            </div>
                                        )}
                                        {matchedWorkflowItem.prData?.finalPrNumber && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Final PR</span>
                                                <span className="text-foreground">#{matchedWorkflowItem.prData.finalPrNumber}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Non-workflow item: show source/priority/github */}
                            {!matchedWorkflowItem && (source || ghUrl || item?.feature?.priority) && (
                                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                        {item?.feature?.priority && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Priority</span>
                                                <StatusBadge label={item.feature.priority} colorKey={item.feature.priority} />
                                            </div>
                                        )}
                                        {source && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Source</span>
                                                <span className="text-foreground">via {source}</span>
                                            </div>
                                        )}
                                        {ghUrl && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">GitHub</span>
                                                <a href={ghUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                                    View Issue →
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {description && (
                                <>
                                    <div className="markdown-body text-sm mb-4">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {description}
                                        </ReactMarkdown>
                                    </div>
                                </>
                            )}

                            {item?.report?.errorMessage && (
                                <div className="mb-4">
                                    <p className="text-xs font-medium text-destructive mb-1">Error Message</p>
                                    <code className="block text-xs bg-muted p-2 rounded overflow-auto">
                                        {item.report.errorMessage}
                                    </code>
                                </div>
                            )}

                            {item?.report?.stackTrace && (
                                <div className="mb-4">
                                    <p className="text-xs font-medium text-destructive mb-1">Stack Trace</p>
                                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                                        {item.report.stackTrace}
                                    </pre>
                                </div>
                            )}

                            {matchedWorkflowItem?.history?.length ? (
                                <>
                                    <Separator className="my-3" />
                                    <WorkflowHistory entries={matchedWorkflowItem.history} />
                                </>
                            ) : null}
                        </div>

                        {/* Zone 3 — Actions Panel */}
                        <div className="border-t px-6 py-3 flex flex-col gap-2">
                            {/* Workflow action buttons (approve/reject/merge/etc) */}
                            {matchedWorkflowItem && matchedWorkflowItem.content?.number && (
                                <WorkflowActionButtons
                                    item={matchedWorkflowItem}
                                    onActionComplete={onClose}
                                    excludeActions={workflowItemId ? ['mark-done'] : undefined}
                                />
                            )}

                            {/* Routing buttons (post-approval) */}
                            {showRouting && (
                                <div className="flex flex-col gap-2">
                                    <p className="text-xs text-muted-foreground">Choose where to route:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {['Product Development', 'Product Design', 'Technical Design', 'Ready for development'].map((dest) => (
                                            <Button
                                                key={dest}
                                                variant="outline"
                                                size="sm"
                                                disabled={isRouting}
                                                onClick={() => handleRoute(dest)}
                                            >
                                                {isRouting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                                                {dest}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Approve + Backlog (for new pending items) */}
                            {!showRouting && canApprove && (
                                <div className="flex gap-2">
                                    <Button
                                        className="flex-1"
                                        onClick={() => setShowApproveConfirm(true)}
                                        disabled={isApproving || isDeleting}
                                    >
                                        {isApproving ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                        )}
                                        Approve
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleApproveToBacklog}
                                        disabled={isApproving || isDeleting}
                                    >
                                        <Archive className="mr-2 h-4 w-4" />
                                        Backlog
                                    </Button>
                                </div>
                            )}

                            {/* Bottom row: open detail + copy + delete */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-muted-foreground"
                                        onClick={() => {
                                            onClose();
                                            navigate(`/admin/item/${itemId}`);
                                        }}
                                    >
                                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                        Open
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-muted-foreground"
                                        onClick={handleCopyDetails}
                                    >
                                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                                        Copy
                                    </Button>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={isApproving || isDeleting}
                                >
                                    {isDeleting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>

            <ConfirmDialog
                open={showApproveConfirm}
                onOpenChange={setShowApproveConfirm}
                title="Approve Item"
                description="This will create a GitHub issue and sync the item. Continue?"
                confirmText={isApproving ? 'Approving...' : 'Approve'}
                onConfirm={handleApprove}
            />
            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                title="Delete Item"
                description="This will permanently delete this item from the database. This action cannot be undone."
                confirmText={isDeleting ? 'Deleting...' : 'Delete'}
                onConfirm={handleDelete}
                variant="destructive"
            />
        </Dialog>
    );
}
