/**
 * Workflow Items Page
 *
 * Unified admin page with two sections:
 * - Pending Approval: new feature requests and bug reports awaiting admin approval
 * - Pipeline: active workflow items progressing through the workflow
 *
 * Clicking a card opens an inline preview dialog (fetches full item detail).
 * "View Full Details" button navigates to the full item page.
 */

import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronsUpDown, Loader2, ExternalLink, Clock, CheckCircle, Trash2, Check, Copy, RefreshCw, Github, ArrowRightLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/client/components/template/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/client/components/template/ui/select';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { toast } from '@/client/components/template/ui/toast';
import { ErrorDisplay } from '@/client/features/template/error-tracking';
import { useRouter } from '@/client/features';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkflowItems, useUpdateWorkflowStatus } from './hooks';
import { useItemDetail, useApproveItem, useDeleteItem, parseItemId } from '@/client/routes/template/ItemDetail/hooks';
import { useWorkflowPageStore } from './store';
import { WorkflowActionButtons } from './WorkflowActionButtons';
import type { TypeFilter, ViewFilter } from './store';
import type { PendingItem, WorkflowItem } from '@/apis/template/workflow/types';

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Theme-independent badge colors ──────────────────────────────────────────

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
    // Type
    feature: { bg: '#3b82f6', text: '#fff' },
    bug: { bg: '#ef4444', text: '#fff' },
    task: { bg: '#6b7280', text: '#fff' },
    // Pipeline status (matches STATUSES from server/project-management/config.ts)
    'Pending Approval': { bg: '#f59e0b', text: '#fff' },
    'Backlog': { bg: '#6b7280', text: '#fff' },
    'Product Development': { bg: '#a855f7', text: '#fff' },
    'Product Design': { bg: '#8b5cf6', text: '#fff' },
    'Bug Investigation': { bg: '#ec4899', text: '#fff' },
    'Technical Design': { bg: '#3b82f6', text: '#fff' },
    'Ready for development': { bg: '#f59e0b', text: '#fff' },
    'PR Review': { bg: '#06b6d4', text: '#fff' },
    'Final Review': { bg: '#0d9488', text: '#fff' },
    'Done': { bg: '#22c55e', text: '#fff' },
    // Review status
    'Waiting for Review': { bg: '#eab308', text: '#fff' },
    'Approved': { bg: '#22c55e', text: '#fff' },
    'Request Changes': { bg: '#f97316', text: '#fff' },
    'Rejected': { bg: '#ef4444', text: '#fff' },
    // Priority
    'critical': { bg: '#dc2626', text: '#fff' },
    'high': { bg: '#f97316', text: '#fff' },
    'medium': { bg: '#3b82f6', text: '#fff' },
    'low': { bg: '#9ca3af', text: '#fff' },
    // Source
    'source': { bg: '#6b7280', text: '#fff' },
};

const DEFAULT_BADGE_COLOR = { bg: '#9ca3af', text: '#fff' };

function StatusBadge({ label, colorKey }: { label: string; colorKey?: string }) {
    const colors = BADGE_COLORS[colorKey || label] || DEFAULT_BADGE_COLOR;
    return (
        <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: colors.bg, color: colors.text }}
        >
            {label}
        </span>
    );
}

// ── Summary Stats Bar ────────────────────────────────────────────────────────

function StatsBar({ pendingCount, statusCounts, onClickStatus }: {
    pendingCount: number;
    statusCounts: { status: string; count: number }[];
    onClickStatus: (view: ViewFilter) => void;
}) {
    const total = pendingCount + statusCounts.reduce((sum, s) => sum + s.count, 0);
    if (total === 0) return null;

    return (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
            {pendingCount > 0 && (
                <button
                    onClick={() => onClickStatus('pending')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BADGE_COLORS['Pending Approval'].bg }} />
                    <span>Pending {pendingCount}</span>
                </button>
            )}
            {statusCounts.map(({ status, count }) => (
                <button
                    key={status}
                    onClick={() => onClickStatus(status === 'Done' ? 'done' : 'active')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                    <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: (BADGE_COLORS[status] || DEFAULT_BADGE_COLOR).bg }}
                    />
                    <span>{status} {count}</span>
                </button>
            ))}
        </div>
    );
}

// ── Cards ───────────────────────────────────────────────────────────────────

function SelectCheckbox({ selected }: { selected: boolean }) {
    return (
        <div className="flex items-center pt-0.5 shrink-0">
            <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selected ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                }`}
            >
                {selected && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
        </div>
    );
}

function PendingCard({ item, onSelect, selectMode, selected, onToggleSelect }: {
    item: PendingItem;
    onSelect: (id: string) => void;
    selectMode?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}) {
    return (
        <Card
            className={`cursor-pointer hover:bg-accent/50 transition-colors ${selected ? 'ring-2 ring-primary' : ''}`}
            onClick={() => selectMode ? onToggleSelect?.() : onSelect(item.id)}
        >
            <CardContent className="p-4">
                <div className="flex gap-3">
                    {selectMode && <SelectCheckbox selected={!!selected} />}
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium leading-tight line-clamp-2">
                                {item.title}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                                {formatDate(item.createdAt)}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge label={item.type === 'bug' ? 'Bug' : 'Feature'} colorKey={item.type} />
                            <StatusBadge label="Pending Approval" />
                            {item.priority && (
                                <StatusBadge label={item.priority} colorKey={item.priority} />
                            )}
                            {item.source && (
                                <StatusBadge label={`via ${item.source}`} colorKey="source" />
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function WorkflowCard({ item, onSelect, selectMode, selected, onToggleSelect }: {
    item: WorkflowItem;
    onSelect: (id: string) => void;
    selectMode?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}) {
    const navId = item.sourceId || item.id;
    const typeLabel = item.type === 'bug' ? 'Bug' : item.type === 'task' ? 'Task' : 'Feature';
    const ghUrl = item.content?.url;
    return (
        <Card
            className={`cursor-pointer hover:bg-accent/50 transition-colors ${selected ? 'ring-2 ring-primary' : ''}`}
            onClick={() => selectMode ? onToggleSelect?.() : onSelect(navId)}
        >
            <CardContent className="p-4">
                <div className="flex gap-3">
                    {selectMode && <SelectCheckbox selected={!!selected} />}
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium leading-tight line-clamp-2">
                                {item.content?.title || 'Untitled'}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {item.implementationPhase && (
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Phase {item.implementationPhase}
                                    </span>
                                )}
                                {item.createdAt && (
                                    <span className="text-xs text-muted-foreground">
                                        {formatDate(item.createdAt)}
                                    </span>
                                )}
                                {item.content?.number && (
                                    <span className="text-xs text-muted-foreground">
                                        #{item.content.number}
                                    </span>
                                )}
                                {ghUrl && (
                                    <a
                                        href={ghUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                        title="Open GitHub issue"
                                    >
                                        <Github className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge label={typeLabel} colorKey={item.type} />
                            <StatusBadge label={item.status || 'No status'} />
                            {item.reviewStatus && (
                                <StatusBadge label={item.reviewStatus} />
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Item preview dialog ─────────────────────────────────────────────────────

const ALL_STATUSES = [
    'Backlog',
    'Product Development',
    'Product Design',
    'Bug Investigation',
    'Technical Design',
    'Ready for development',
    'PR Review',
    'Final Review',
    'Done',
] as const;

function ItemPreviewDialog({ itemId, onClose, workflowItems }: { itemId: string | null; onClose: () => void; workflowItems?: WorkflowItem[] }) {
    const { navigate } = useRouter();
    const queryClient = useQueryClient();
    const { item, isLoading } = useItemDetail(itemId || undefined);
    const { approveFeature, approveBug, isPending: isApproving } = useApproveItem();
    const { deleteFeature, deleteBug, isPending: isDeleting } = useDeleteItem();
    const updateStatusMutation = useUpdateWorkflowStatus();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral confirm dialog state
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral confirm dialog state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const isFeature = item?.type === 'feature';
    const title = item
        ? (isFeature
            ? item.feature!.title
            : item.report!.description?.split('\n')[0]?.slice(0, 100) || 'Bug Report')
        : '';
    const description = item
        ? (isFeature ? item.feature!.description : item.report!.description || '')
        : '';
    const status = item ? (isFeature ? item.feature!.status : item.report!.status) : '';
    const createdAt = item ? (isFeature ? item.feature!.createdAt : item.report!.createdAt) : '';
    const isNew = status === 'new';
    const isAlreadySynced = item
        ? (isFeature ? !!item.feature!.githubIssueUrl : !!item.report!.githubIssueUrl)
        : false;
    const canApprove = isNew && !isAlreadySynced;
    const canDelete = !isAlreadySynced;

    // Determine if this is a workflow item (has a non-composite ID = plain ObjectId)
    const isWorkflowItem = itemId ? !itemId.includes(':') : false;
    // For workflow items, the itemId IS the workflow item's _id
    const workflowItemId = isWorkflowItem ? itemId : null;

    // Look up the WorkflowItem for action buttons
    const matchedWorkflowItem = useMemo(() => {
        if (!workflowItems || !itemId) return null;
        // If itemId is a workflow item ID (plain ObjectId), match by id
        if (isWorkflowItem) {
            return workflowItems.find((wi) => wi.id === itemId) || null;
        }
        // If itemId is a composite sourceId, match by sourceId
        return workflowItems.find((wi) => wi.sourceId === itemId) || null;
    }, [workflowItems, itemId, isWorkflowItem]);

    const { mongoId } = itemId ? parseItemId(itemId) : { mongoId: '' };

    const handleCopyDetails = async () => {
        if (!item) return;
        const lines: string[] = [];
        lines.push(`[${isFeature ? 'Feature' : 'Bug'}] ${title}`);
        lines.push(`Status: ${status}`);
        if (isFeature && item.feature!.priority) lines.push(`Priority: ${item.feature!.priority}`);
        if (createdAt) lines.push(`Created: ${new Date(createdAt).toLocaleDateString()}`);
        if (isFeature && item.feature!.requestedByName) lines.push(`Requested by: ${item.feature!.requestedByName}`);
        if (!isFeature && item.report!.route) lines.push(`Route: ${item.report!.route}`);
        if (description) {
            lines.push('');
            lines.push(description);
        }
        if (!isFeature && item.report!.errorMessage) {
            lines.push('');
            lines.push(`Error: ${item.report!.errorMessage}`);
        }
        const ghUrl = isFeature ? item.feature!.githubIssueUrl : item.report!.githubIssueUrl;
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
            if (isFeature) {
                await approveFeature(mongoId);
            } else {
                await approveBug(mongoId);
            }
            toast.success('Item approved and synced to GitHub');
            setShowApproveConfirm(false);
            onClose();
            queryClient.invalidateQueries({ queryKey: ['workflow-items'] });
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

    return (
        <Dialog open={!!itemId} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : !item ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        Item not found.
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                <StatusBadge label={isFeature ? 'Feature' : 'Bug'} colorKey={item.type} />
                                <StatusBadge label={status} />
                                {isFeature && item.feature!.priority && (
                                    <StatusBadge label={item.feature!.priority} colorKey={item.feature!.priority} />
                                )}
                                {isFeature && item.feature!.source && (
                                    <StatusBadge label={`via ${item.feature!.source}`} colorKey="source" />
                                )}
                                {!isFeature && item.report!.source && (
                                    <StatusBadge label={`via ${item.report!.source}`} colorKey="source" />
                                )}
                            </div>
                            <DialogTitle className="text-base leading-snug pr-6">{title}</DialogTitle>
                            {createdAt && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    <span>{new Date(createdAt).toLocaleDateString()}</span>
                                    {isFeature && item.feature!.requestedByName && (
                                        <span>by {item.feature!.requestedByName}</span>
                                    )}
                                    {!isFeature && item.report!.route && (
                                        <span>on {item.report!.route}</span>
                                    )}
                                </div>
                            )}
                        </DialogHeader>

                        <div className="overflow-y-auto flex-1 min-h-0 -mx-6 px-6 py-2">
                            {description && (
                                <div className="markdown-body text-sm mb-4">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {description}
                                    </ReactMarkdown>
                                </div>
                            )}

                            {!isFeature && item.report!.errorMessage && (
                                <div className="mb-4">
                                    <p className="text-xs font-medium text-destructive mb-1">Error Message</p>
                                    <code className="block text-xs bg-muted p-2 rounded overflow-auto">
                                        {item.report!.errorMessage}
                                    </code>
                                </div>
                            )}

                            {!isFeature && item.report!.stackTrace && (
                                <div className="mb-4">
                                    <p className="text-xs font-medium text-destructive mb-1">Stack Trace</p>
                                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                                        {item.report!.stackTrace}
                                    </pre>
                                </div>
                            )}

                            {(() => {
                                const ghUrl = isFeature
                                    ? item.feature!.githubIssueUrl
                                    : item.report!.githubIssueUrl;
                                if (!ghUrl) return null;
                                return (
                                    <p className="text-xs text-muted-foreground mb-4">
                                        GitHub:{' '}
                                        <a
                                            href={ghUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary underline"
                                        >
                                            View Issue
                                        </a>
                                    </p>
                                );
                            })()}
                        </div>

                        <div className="pt-3 border-t -mx-6 px-6 flex flex-col gap-2">
                            {workflowItemId && (
                                <div className="flex items-center gap-2">
                                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <Select
                                        value=""
                                        onValueChange={handleStatusChange}
                                    >
                                        <SelectTrigger className="h-8 text-xs flex-1">
                                            <SelectValue placeholder="Move to..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ALL_STATUSES.map((s) => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {matchedWorkflowItem && matchedWorkflowItem.content?.number && (
                                <WorkflowActionButtons
                                    item={matchedWorkflowItem}
                                    onActionComplete={onClose}
                                />
                            )}
                            {(canApprove || canDelete) && (
                                <div className="flex gap-2">
                                    {canApprove && (
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
                                    )}
                                    {canDelete && (
                                        <Button
                                            className="flex-1"
                                            variant="destructive"
                                            onClick={() => setShowDeleteConfirm(true)}
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
                            )}
                            <div className="flex gap-2">
                                <Button
                                    className="flex-1"
                                    variant="outline"
                                    onClick={() => {
                                        onClose();
                                        navigate(`/admin/item/${itemId}`);
                                    }}
                                >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    View Full Details
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleCopyDetails}
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy
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

// ── View tab bar ────────────────────────────────────────────────────────────

const VIEW_OPTIONS: { value: ViewFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
    { value: 'done', label: 'Done' },
];

function ViewTabs({ active, onChange }: { active: ViewFilter; onChange: (v: ViewFilter) => void }) {
    return (
        <div className="flex rounded-lg bg-muted p-0.5">
            {VIEW_OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        active === opt.value
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

// ── Type dropdown labels ────────────────────────────────────────────────────

const TYPE_LABELS: Record<TypeFilter, string> = {
    all: 'All types',
    feature: 'Features',
    bug: 'Bugs',
};

// ── Collapsible section ─────────────────────────────────────────────────────

function CollapsibleSection({ title, count, collapsed, onToggle, children }: {
    title: string;
    count: number;
    collapsed: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        <div className="mb-6">
            <button
                onClick={onToggle}
                className="flex items-center gap-1.5 mb-3 group"
            >
                {collapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
                    {title} ({count})
                </h2>
            </button>
            {!collapsed && (
                <div className="flex flex-col gap-2">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── Pipeline status order (matches STATUSES from config.ts, excluding Done) ─

const PIPELINE_STATUSES = [
    'Backlog',
    'Product Development',
    'Product Design',
    'Bug Investigation',
    'Technical Design',
    'Ready for development',
    'PR Review',
    'Final Review',
] as const;

const ALL_SECTION_KEYS = ['pending', ...PIPELINE_STATUSES, 'Done'] as const;

// ── Main component ──────────────────────────────────────────────────────────

export function WorkflowItems() {
    const { data, isLoading, error, isFetching } = useWorkflowItems();

    const typeFilter = useWorkflowPageStore((s) => s.typeFilter);
    const viewFilter = useWorkflowPageStore((s) => s.viewFilter);
    const collapsedSections = useWorkflowPageStore((s) => s.collapsedSections);
    const selectedItemId = useWorkflowPageStore((s) => s.selectedItemId);
    const selectMode = useWorkflowPageStore((s) => s.selectMode);
    const selectedItems = useWorkflowPageStore((s) => s.selectedItems);
    const showBulkDeleteConfirm = useWorkflowPageStore((s) => s.showBulkDeleteConfirm);
    const isBulkDeleting = useWorkflowPageStore((s) => s.isBulkDeleting);
    const isBulkApproving = useWorkflowPageStore((s) => s.isBulkApproving);

    const setTypeFilter = useWorkflowPageStore((s) => s.setTypeFilter);
    const setViewFilter = useWorkflowPageStore((s) => s.setViewFilter);
    const toggleSection = useWorkflowPageStore((s) => s.toggleSection);
    const toggleAllSections = useWorkflowPageStore((s) => s.toggleAllSections);
    const setSelectedItemId = useWorkflowPageStore((s) => s.setSelectedItemId);
    const toggleSelectMode = useWorkflowPageStore((s) => s.toggleSelectMode);
    const toggleItemSelect = useWorkflowPageStore((s) => s.toggleItemSelect);
    const setShowBulkDeleteConfirm = useWorkflowPageStore((s) => s.setShowBulkDeleteConfirm);
    const resetBulkDelete = useWorkflowPageStore((s) => s.resetBulkDelete);
    const setIsBulkDeleting = useWorkflowPageStore((s) => s.setIsBulkDeleting);
    const setIsBulkApproving = useWorkflowPageStore((s) => s.setIsBulkApproving);

    const queryClient = useQueryClient();
    const { deleteFeature, deleteBug } = useDeleteItem();
    const { approveFeature, approveBug } = useApproveItem();

    const isBulkBusy = isBulkDeleting || isBulkApproving;

    // Check if all selected items are pending (for bulk approve)
    const allSelectedArePending = useMemo(() => {
        const keys = Object.keys(selectedItems);
        return keys.length > 0 && keys.every((k) => k.startsWith('pending:'));
    }, [selectedItems]);

    const handleBulkDelete = async () => {
        setIsBulkDeleting(true);
        let successCount = 0;
        let failCount = 0;
        let lastError = '';

        for (const key of Object.keys(selectedItems)) {
            const { type, mongoId } = selectedItems[key];
            try {
                if (type === 'feature') {
                    await deleteFeature(mongoId);
                } else {
                    await deleteBug(mongoId);
                }
                successCount++;
            } catch (err) {
                failCount++;
                lastError = err instanceof Error ? err.message : 'Unknown error';
            }
        }

        resetBulkDelete();
        queryClient.invalidateQueries({ queryKey: ['workflow-items'] });

        if (failCount > 0 && successCount === 0) {
            toast.error(`Failed to delete ${failCount} item${failCount !== 1 ? 's' : ''}: ${lastError}`);
        } else if (failCount > 0) {
            toast.error(`Deleted ${successCount}, failed ${failCount}: ${lastError}`);
        } else {
            toast.success(`Deleted ${successCount} item${successCount !== 1 ? 's' : ''}`);
        }
    };

    const handleBulkApprove = async () => {
        setIsBulkApproving(true);
        let successCount = 0;
        let failCount = 0;
        let lastError = '';

        for (const key of Object.keys(selectedItems)) {
            const { type, mongoId } = selectedItems[key];
            try {
                if (type === 'feature') {
                    await approveFeature(mongoId);
                } else {
                    await approveBug(mongoId);
                }
                successCount++;
            } catch (err) {
                failCount++;
                lastError = err instanceof Error ? err.message : 'Unknown error';
            }
        }

        resetBulkDelete();
        queryClient.invalidateQueries({ queryKey: ['workflow-items'] });

        if (failCount > 0 && successCount === 0) {
            toast.error(`Failed to approve ${failCount} item${failCount !== 1 ? 's' : ''}: ${lastError}`);
        } else if (failCount > 0) {
            toast.error(`Approved ${successCount}, failed ${failCount}: ${lastError}`);
        } else {
            toast.success(`Approved ${successCount} item${successCount !== 1 ? 's' : ''}`);
        }
    };

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['workflow-items'] });
    };

    const toggleAll = () => toggleAllSections(ALL_SECTION_KEYS);

    const filteredPending = useMemo(() => {
        if (!data?.pendingItems) return [];
        if (viewFilter !== 'all' && viewFilter !== 'pending') return [];
        const items = [...data.pendingItems].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        if (typeFilter === 'all') return items;
        return items.filter((item) => item.type === typeFilter);
    }, [data?.pendingItems, typeFilter, viewFilter]);

    const pipelineGroups = useMemo(() => {
        if (!data?.workflowItems) return [];
        if (viewFilter === 'pending' || viewFilter === 'done') return [];

        let items = [...data.workflowItems].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
        if (typeFilter !== 'all') {
            items = items.filter((item) => item.type === typeFilter);
        }
        // Exclude Done items (they get their own section)
        items = items.filter((item) => item.status !== 'Done');

        // Group by status, maintaining PIPELINE_STATUSES order
        const byStatus = new Map<string, WorkflowItem[]>();
        for (const item of items) {
            const status = item.status || 'Unknown';
            const existing = byStatus.get(status);
            if (existing) existing.push(item);
            else byStatus.set(status, [item]);
        }

        const groups: { status: string; items: WorkflowItem[] }[] = [];
        for (const status of PIPELINE_STATUSES) {
            const statusItems = byStatus.get(status);
            if (statusItems && statusItems.length > 0) {
                groups.push({ status, items: statusItems });
                byStatus.delete(status);
            }
        }
        // Append any unknown statuses at the end
        for (const [status, statusItems] of byStatus) {
            groups.push({ status, items: statusItems });
        }

        return groups;
    }, [data?.workflowItems, typeFilter, viewFilter]);

    const doneItems = useMemo(() => {
        if (!data?.workflowItems) return [];
        if (viewFilter === 'pending' || viewFilter === 'active') return [];

        let items = data.workflowItems
            .filter((item) => item.status === 'Done')
            .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            });
        if (typeFilter !== 'all') {
            items = items.filter((item) => item.type === typeFilter);
        }
        return items;
    }, [data?.workflowItems, typeFilter, viewFilter]);

    // Stats for the summary bar (computed from unfiltered data)
    const statusCounts = useMemo(() => {
        if (!data?.workflowItems) return [];
        const counts = new Map<string, number>();
        for (const item of data.workflowItems) {
            const status = item.status || 'Unknown';
            counts.set(status, (counts.get(status) || 0) + 1);
        }
        // Return in pipeline order
        const result: { status: string; count: number }[] = [];
        for (const status of [...PIPELINE_STATUSES, 'Done']) {
            const count = counts.get(status);
            if (count) {
                result.push({ status, count });
                counts.delete(status);
            }
        }
        for (const [status, count] of counts) {
            result.push({ status, count });
        }
        return result;
    }, [data?.workflowItems]);

    if (isLoading || data === undefined) {
        return (
            <div className="p-4">
                <h1 className="text-lg font-semibold mb-4">Workflow</h1>
                <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <h1 className="text-lg font-semibold mb-4">Workflow</h1>
                <ErrorDisplay error={error} title="Failed to load workflow items" variant="inline" />
            </div>
        );
    }

    const hasPending = filteredPending.length > 0;
    const hasPipelineGroups = pipelineGroups.length > 0;
    const hasDone = doneItems.length > 0;
    const isEmpty = !hasPending && !hasPipelineGroups && !hasDone;
    const selectedCount = Object.keys(selectedItems).length;
    const allCollapsed = collapsedSections.length > 0;

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-3">
                <h1 className="text-lg font-semibold">Workflow</h1>
                <div className="flex items-center gap-1.5">
                    <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                        <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs px-3">
                            <SelectValue>{TYPE_LABELS[typeFilter]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All types</SelectItem>
                            <SelectItem value="feature">Features</SelectItem>
                            <SelectItem value="bug">Bugs</SelectItem>
                        </SelectContent>
                    </Select>
                    <button
                        onClick={toggleSelectMode}
                        disabled={isBulkBusy}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            selectMode
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        } ${isBulkBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {selectMode ? 'Cancel' : 'Select'}
                    </button>
                    <button
                        onClick={handleRefresh}
                        title="Refresh"
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={toggleAll}
                        title={allCollapsed ? 'Expand all' : 'Collapse all'}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                        <ChevronsUpDown className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <StatsBar
                pendingCount={data.pendingItems.length}
                statusCounts={statusCounts}
                onClickStatus={setViewFilter}
            />

            <div className="mb-4">
                <ViewTabs active={viewFilter} onChange={setViewFilter} />
            </div>

            {isEmpty && (
                <div className="text-sm text-muted-foreground">No workflow items found.</div>
            )}

            {hasPending && (
                <CollapsibleSection
                    title="Pending Approval"
                    count={filteredPending.length}
                    collapsed={collapsedSections.includes('pending')}
                    onToggle={() => toggleSection('pending')}
                >
                    {filteredPending.map((item) => (
                        <PendingCard
                            key={item.id}
                            item={item}
                            onSelect={setSelectedItemId}
                            selectMode={selectMode}
                            selected={`pending:${item.id}` in selectedItems}
                            onToggleSelect={() => toggleItemSelect(`pending:${item.id}`, { type: item.type, mongoId: parseItemId(item.id).mongoId })}
                        />
                    ))}
                </CollapsibleSection>
            )}

            {pipelineGroups.map((group) => (
                <CollapsibleSection
                    key={group.status}
                    title={group.status}
                    count={group.items.length}
                    collapsed={collapsedSections.includes(group.status)}
                    onToggle={() => toggleSection(group.status)}
                >
                    {group.items.map((item) => {
                        const sourceId = item.sourceId;
                        const canSelect = sourceId && (item.type === 'feature' || item.type === 'bug');
                        const { mongoId } = sourceId ? parseItemId(sourceId) : { mongoId: '' };
                        return (
                            <WorkflowCard
                                key={item.id}
                                item={item}
                                onSelect={setSelectedItemId}
                                selectMode={selectMode && !!canSelect}
                                selected={`workflow:${item.id}` in selectedItems}
                                onToggleSelect={canSelect ? () => toggleItemSelect(`workflow:${item.id}`, { type: item.type as 'feature' | 'bug', mongoId }) : undefined}
                            />
                        );
                    })}
                </CollapsibleSection>
            ))}

            {hasDone && (
                <CollapsibleSection
                    title="Done"
                    count={doneItems.length}
                    collapsed={collapsedSections.includes('Done')}
                    onToggle={() => toggleSection('Done')}
                >
                    {doneItems.map((item) => {
                        const sourceId = item.sourceId;
                        const canSelect = sourceId && (item.type === 'feature' || item.type === 'bug');
                        const { mongoId } = sourceId ? parseItemId(sourceId) : { mongoId: '' };
                        return (
                            <WorkflowCard
                                key={item.id}
                                item={item}
                                onSelect={setSelectedItemId}
                                selectMode={selectMode && !!canSelect}
                                selected={`workflow:${item.id}` in selectedItems}
                                onToggleSelect={canSelect ? () => toggleItemSelect(`workflow:${item.id}`, { type: item.type as 'feature' | 'bug', mongoId }) : undefined}
                            />
                        );
                    })}
                </CollapsibleSection>
            )}

            {/* Spacer for fixed bottom bar */}
            {selectedCount > 0 && <div className="h-16" />}

            {/* Bulk action bottom bar */}
            {selectedCount > 0 && (
                <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-3 z-50">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                            {selectedCount} selected
                        </span>
                        <div className="flex items-center gap-2">
                            {allSelectedArePending && (
                                <Button
                                    size="sm"
                                    onClick={handleBulkApprove}
                                    disabled={isBulkBusy}
                                >
                                    {isBulkApproving ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                    )}
                                    {isBulkApproving ? 'Approving...' : 'Approve Selected'}
                                </Button>
                            )}
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setShowBulkDeleteConfirm(true)}
                                disabled={isBulkBusy}
                            >
                                {isBulkDeleting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Trash2 className="mr-2 h-4 w-4" />
                                )}
                                {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <ItemPreviewDialog
                itemId={selectedItemId}
                onClose={() => setSelectedItemId(null)}
                workflowItems={data?.workflowItems}
            />

            <ConfirmDialog
                open={showBulkDeleteConfirm}
                onOpenChange={setShowBulkDeleteConfirm}
                title="Delete Selected Items"
                description={`This will permanently delete ${selectedCount} item${selectedCount !== 1 ? 's' : ''}. This action cannot be undone.`}
                confirmText={isBulkDeleting ? 'Deleting...' : `Delete ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`}
                onConfirm={handleBulkDelete}
                variant="destructive"
            />
        </div>
    );
}
