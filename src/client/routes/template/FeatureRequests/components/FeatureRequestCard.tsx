import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
} from '@/client/components/template/ui/dropdown-menu';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { ChevronDown, ChevronUp, MoreVertical, Trash2, User, Calendar, FileText, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { StatusBadge, PriorityBadge, GitHubStatusBadge } from './StatusBadge';
import { StatusIndicatorStrip } from './StatusIndicatorStrip';
import { MetadataIconRow } from './MetadataIconRow';
import { HealthIndicator } from './HealthIndicator';
import { PrimaryActionButton } from './PrimaryActionButton';
import type { FeatureRequestClient, FeatureRequestPriority } from '@/apis/template/feature-requests/types';
import { useUpdatePriority, useDeleteFeatureRequest, useApproveFeatureRequest, useGitHubStatus, useGitHubStatuses, useUpdateGitHubStatus, useUpdateGitHubReviewStatus, useClearGitHubReviewStatus } from '../hooks';
import { useRouter } from '@/client/features';

interface FeatureRequestCardProps {
    request: FeatureRequestClient;
}

const allPriorities: FeatureRequestPriority[] = ['low', 'medium', 'high', 'critical'];

export function FeatureRequestCard({ request }: FeatureRequestCardProps) {
    const { navigate } = useRouter();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const updatePriorityMutation = useUpdatePriority();
    const deleteMutation = useDeleteFeatureRequest();
    const approveMutation = useApproveFeatureRequest();

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

    const handleCardClick = () => {
        navigate(`/admin/feature-requests/${request._id}`);
    };

    return (
        <Card className="relative border border-border shadow-sm transition-all duration-200 ease-out hover:shadow-md overflow-hidden">
            {/* Left-edge status indicator strip (4px) */}
            <StatusIndicatorStrip request={request} githubStatus={githubStatus?.status} />

            <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
                {/* 3-zone layout: Left (handled by strip), Center (main content), Right (actions) */}
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                    {/* Center Zone: Main Content */}
                    <div
                        className="flex-1 min-w-0 cursor-pointer pl-2"
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
                        {/* Title - max 2 lines, semibold, high contrast */}
                        <CardTitle className="text-sm font-semibold leading-tight line-clamp-2 hover:text-primary transition-colors mb-1.5 sm:text-base">
                            {request.title}
                        </CardTitle>

                        {/* Status Row: Inline badges and metadata icons with compact spacing */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            {/* Show GitHub status as primary when linked, fallback to DB status */}
                            {request.githubProjectItemId ? (
                                isLoadingGitHubStatus ? (
                                    <div className="flex items-center gap-1.5">
                                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Loading...</span>
                                    </div>
                                ) : githubStatus?.status ? (
                                    <GitHubStatusBadge
                                        status={githubStatus.status}
                                        reviewStatus={githubStatus.reviewStatus}
                                    />
                                ) : (
                                    <StatusBadge status={request.status} />
                                )
                            ) : (
                                <StatusBadge status={request.status} />
                            )}

                            <PriorityBadge priority={request.priority} />

                            {/* GitHub issue link and date - visible on small screens only */}
                            <div className="xs:hidden flex items-center gap-1.5 text-xs text-muted-foreground">
                                {request.githubIssueUrl && (
                                    <a
                                        href={request.githubIssueUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 hover:text-primary transition-colors"
                                        title={`GitHub Issue #${request.githubIssueNumber}`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        <span>#{request.githubIssueNumber}</span>
                                    </a>
                                )}
                                <div
                                    className="flex items-center gap-1"
                                    title={`Created: ${new Date(request.createdAt).toLocaleString()}`}
                                >
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>{new Date(request.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                </div>
                            </div>

                            {/* Metadata icon row - hidden on very small screens */}
                            <div className="hidden xs:flex sm:flex">
                                <MetadataIconRow request={request} />
                            </div>
                        </div>
                    </div>

                    {/* Right Zone: Actions - compact and aligned */}
                    <div className="flex items-start gap-0.5 sm:gap-1 flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <PrimaryActionButton
                            canApprove={canApprove}
                            canReviewDesign={false}
                            onApprove={handleApprove}
                            onReview={() => {}}
                            isApproving={approveMutation.isPending}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="h-8 w-8"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
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
                <CardContent className="space-y-3 pt-2 px-3 pb-4 sm:space-y-4 sm:px-4 transition-all duration-200 ease-out">
                    <div className="space-y-2 rounded-lg bg-muted/20 p-3">
                        <h4 className="text-sm font-medium">Description</h4>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                            {request.description}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1.5 sm:px-2.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">{request.requestedByName}</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1.5 sm:px-2.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">{new Date(request.createdAt).toLocaleDateString()}</span>
                        </div>
                        {request.page && (
                            <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1.5 sm:px-2.5">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground truncate max-w-[150px]">{request.page}</span>
                            </div>
                        )}
                    </div>

                    {/* GitHub Integration Section */}
                    {request.githubIssueUrl && (
                        <div className="space-y-2 rounded-lg border-l-2 border-l-primary/20 bg-primary/5 p-3">
                            <h4 className="text-sm font-medium">GitHub Integration</h4>
                            <div className="flex flex-wrap gap-2 text-sm">
                                <a
                                    href={request.githubIssueUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors sm:px-3 sm:text-sm"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span>Issue #{request.githubIssueNumber}</span>
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Health Indicator - shown in expanded view only when not healthy */}
                    <HealthIndicator request={request} githubStatus={githubStatus} />

                    {request.comments && request.comments.length > 0 && (
                        <div className="space-y-3 rounded-lg bg-muted/20 p-3">
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium">Comments</h4>
                                <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                    {request.comments.length}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {request.comments.slice(-3).map((comment) => (
                                    <div
                                        key={comment.id}
                                        className={`rounded-md border border-border/50 p-2.5 text-sm sm:p-3 ${
                                            comment.isAdmin ? 'bg-background' : 'bg-muted/10'
                                        }`}
                                    >
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2">
                                            <span className="font-medium text-foreground">{comment.authorName}</span>
                                            {comment.isAdmin && (
                                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary font-medium sm:px-2">
                                                    Admin
                                                </span>
                                            )}
                                            <span className="text-muted-foreground">
                                                {new Date(comment.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="mt-1.5 text-sm text-foreground leading-relaxed sm:mt-2">{comment.content}</p>
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
        </Card>
    );
}
