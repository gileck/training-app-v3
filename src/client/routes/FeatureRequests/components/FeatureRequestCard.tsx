import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/client/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/client/components/ui/confirm-dialog';
import { ChevronDown, ChevronUp, MoreVertical, Trash2, User, Calendar, FileText, Eye, ExternalLink, GitPullRequest, CheckCircle, Loader2, RotateCcw } from 'lucide-react';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { DesignReviewPanel } from './DesignReviewPanel';
import type { FeatureRequestClient, FeatureRequestPriority, DesignPhaseType } from '@/apis/feature-requests/types';
import { useUpdatePriority, useDeleteFeatureRequest, useApproveFeatureRequest, useGitHubStatus, useGitHubStatuses, useUpdateGitHubStatus, useUpdateGitHubReviewStatus, useClearGitHubReviewStatus } from '../hooks';
import { useRouter } from '@/client/router';

interface FeatureRequestCardProps {
    request: FeatureRequestClient;
}

const allPriorities: FeatureRequestPriority[] = ['low', 'medium', 'high', 'critical'];

// Priority color mapping for left border accent using semantic tokens
const priorityBorderColors: Record<FeatureRequestPriority, string> = {
    critical: 'border-l-destructive',
    high: 'border-l-warning',
    medium: 'border-l-info',
    low: 'border-l-muted-foreground',
};

export function FeatureRequestCard({ request }: FeatureRequestCardProps) {
    const { navigate } = useRouter();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [showDesignReview, setShowDesignReview] = useState(false);

    const updatePriorityMutation = useUpdatePriority();
    const deleteMutation = useDeleteFeatureRequest();
    const approveMutation = useApproveFeatureRequest();

    // Get priority border color with fallback
    const priorityBorderColor = request.priority ? priorityBorderColors[request.priority] : 'border-l-muted-foreground';

    // Fetch GitHub Project status only if there's a GitHub project item
    const { data: githubStatus, isLoading: isLoadingGitHubStatus } = useGitHubStatus(
        request.githubProjectItemId ? request._id : null,
        !!request.githubProjectItemId
    );

    // Fetch available GitHub statuses and mutation for updating
    const { data: availableStatuses } = useGitHubStatuses();
    const updateGitHubStatusMutation = useUpdateGitHubStatus();
    const updateGitHubReviewStatusMutation = useUpdateGitHubReviewStatus();
    const clearGitHubReviewStatusMutation = useClearGitHubReviewStatus();

    const handlePriorityChange = (priority: FeatureRequestPriority) => {
        updatePriorityMutation.mutate({ requestId: request._id, priority });
    };

    const handleGitHubStatusChange = (status: string) => {
        updateGitHubStatusMutation.mutate({ requestId: request._id, status });
    };

    const handleGitHubReviewStatusChange = (reviewStatus: string) => {
        updateGitHubReviewStatusMutation.mutate({ requestId: request._id, reviewStatus });
    };

    const handleClearGitHubReviewStatus = () => {
        clearGitHubReviewStatusMutation.mutate({ requestId: request._id });
    };

    const handleDelete = () => {
        deleteMutation.mutate(request._id, {
            onSuccess: () => setShowDeleteDialog(false),
        });
    };

    const handleApprove = () => {
        approveMutation.mutate(request._id);
    };

    // Show approve button for new requests that don't have a GitHub issue yet
    const canApprove = request.status === 'new' && !request.githubIssueUrl;

    // Design phase info is kept for requests that have it, but won't be used for new ones
    // This is for backwards compatibility with existing data
    const currentDesignPhase = request.productDesign || request.techDesign || null;

    const currentPhaseType: DesignPhaseType | null = request.productDesign
        ? 'product'
        : request.techDesign
          ? 'tech'
          : null;

    const canReviewDesign = currentDesignPhase && currentDesignPhase.content && currentPhaseType;

    const handleCardClick = () => {
        navigate(`/admin/feature-requests/${request._id}`);
    };

    return (
        <Card className={`border-l-4 ${priorityBorderColor} transition-shadow hover:shadow-md`}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div
                        className="flex-1 space-y-2 cursor-pointer"
                        onClick={handleCardClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleCardClick();
                            }
                        }}
                    >
                        <CardTitle className="text-base font-semibold leading-tight hover:text-primary transition-colors">
                            {request.title}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Show GitHub status as primary when linked, fallback to DB status */}
                            {request.githubProjectItemId ? (
                                isLoadingGitHubStatus ? (
                                    <span className="text-sm text-muted-foreground">Loading status...</span>
                                ) : githubStatus?.status ? (
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-md bg-primary px-2.5 py-0.5 text-sm font-medium text-primary-foreground">
                                            {githubStatus.status}
                                        </span>
                                        {githubStatus.reviewStatus && (
                                            <span className="text-xs text-muted-foreground">
                                                ({githubStatus.reviewStatus})
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <StatusBadge
                                        status={request.status}
                                    />
                                )
                            ) : (
                                <StatusBadge
                                    status={request.status}
                                />
                            )}
                            <PriorityBadge priority={request.priority} />
                        </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {canApprove && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleApprove}
                                disabled={approveMutation.isPending}
                                className="gap-1"
                            >
                                <CheckCircle className="h-4 w-4" />
                                {approveMutation.isPending ? 'Approving...' : 'Approve'}
                            </Button>
                        )}
                        {canReviewDesign && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowDesignReview(true)}
                                className="gap-1"
                            >
                                <Eye className="h-4 w-4" />
                                Review
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>Set Priority</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        {allPriorities.map((priority) => (
                                            <DropdownMenuItem
                                                key={priority}
                                                onClick={() => handlePriorityChange(priority)}
                                                disabled={priority === request.priority}
                                            >
                                                {priority.charAt(0).toUpperCase() + priority.slice(1)}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                {request.githubProjectItemId && availableStatuses?.statuses && (
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>GitHub Status</DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            {availableStatuses.statuses.map((status) => (
                                                <DropdownMenuItem
                                                    key={status}
                                                    onClick={() => handleGitHubStatusChange(status)}
                                                    disabled={status === githubStatus?.status || updateGitHubStatusMutation.isPending}
                                                >
                                                    {status}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                )}
                                {request.githubProjectItemId && availableStatuses?.reviewStatuses && availableStatuses.reviewStatuses.length > 0 && (
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            {updateGitHubReviewStatusMutation.isPending && (
                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                            )}
                                            GitHub Review Status
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            {availableStatuses.reviewStatuses.map((reviewStatus) => (
                                                <DropdownMenuItem
                                                    key={reviewStatus}
                                                    onClick={() => handleGitHubReviewStatusChange(reviewStatus)}
                                                    disabled={reviewStatus === githubStatus?.reviewStatus || updateGitHubReviewStatusMutation.isPending}
                                                >
                                                    {reviewStatus}
                                                </DropdownMenuItem>
                                            ))}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={handleClearGitHubReviewStatus}
                                                disabled={!githubStatus?.reviewStatus || clearGitHubReviewStatusMutation.isPending}
                                            >
                                                <RotateCcw className="mr-2 h-4 w-4" />
                                                Clear (Ready for Agent)
                                            </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setShowDeleteDialog(true)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-5 pt-3 transition-all duration-200 ease-in-out">
                    <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                        <h4 className="text-sm font-medium">Description</h4>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {request.description}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">{request.requestedByName}</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">{new Date(request.createdAt).toLocaleDateString()}</span>
                        </div>
                        {request.page && (
                            <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">{request.page}</span>
                            </div>
                        )}
                    </div>

                    {/* GitHub Links */}
                    {(request.githubIssueUrl || request.githubPrUrl) && (
                        <div className="flex flex-wrap gap-3 text-sm">
                            {request.githubIssueUrl && (
                                <a
                                    href={request.githubIssueUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 font-medium text-primary hover:bg-primary/20 transition-colors"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>Issue #{request.githubIssueNumber}</span>
                                </a>
                            )}
                            {request.githubPrUrl && (
                                <a
                                    href={request.githubPrUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 font-medium text-primary hover:bg-primary/20 transition-colors"
                                >
                                    <GitPullRequest className="h-3.5 w-3.5" />
                                    <span>PR #{request.githubPrNumber}</span>
                                </a>
                            )}
                        </div>
                    )}

                    {currentDesignPhase?.content && (
                        <div className="space-y-2 rounded-lg border border-info/30 bg-info/5 p-3">
                            <h4 className="text-sm font-medium">
                                {currentPhaseType === 'product' ? 'Product Design' : 'Technical Design'}
                            </h4>
                            <div className="prose prose-sm max-w-none text-muted-foreground">
                                <pre className="whitespace-pre-wrap text-sm">
                                    {currentDesignPhase.content.slice(0, 500)}
                                    {currentDesignPhase.content.length > 500 && '...'}
                                </pre>
                            </div>
                            {currentDesignPhase.iterations > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Iteration: {currentDesignPhase.iterations}
                                </p>
                            )}
                        </div>
                    )}

                    {request.comments && request.comments.length > 0 && (
                        <div className="space-y-3 rounded-lg bg-muted/30 p-3">
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium">Comments</h4>
                                <span className="inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                                    {request.comments.length}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {request.comments.slice(-3).map((comment) => (
                                    <div
                                        key={comment.id}
                                        className={`rounded-md border p-3 text-sm shadow-sm ${
                                            comment.isAdmin ? 'bg-background' : 'bg-background/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground">{comment.authorName}</span>
                                            {comment.isAdmin && (
                                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                                                    Admin
                                                </span>
                                            )}
                                            <span>
                                                {new Date(comment.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-foreground">{comment.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {request.adminNotes && (
                        <div className="space-y-2 rounded-lg border border-dashed border-warning/30 bg-warning/5 p-3">
                            <h4 className="text-sm font-medium text-muted-foreground">
                                Admin Notes (private)
                            </h4>
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                {request.adminNotes}
                            </p>
                        </div>
                    )}
                </CardContent>
            )}

            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Delete Feature Request"
                description={`Are you sure you want to delete "${request.title}"? This action cannot be undone.`}
                confirmText={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                variant="destructive"
                onConfirm={handleDelete}
            />

            {canReviewDesign && currentPhaseType && (
                <DesignReviewPanel
                    request={request}
                    phase={currentPhaseType}
                    design={currentDesignPhase}
                    open={showDesignReview}
                    onOpenChange={setShowDesignReview}
                />
            )}
        </Card>
    );
}
