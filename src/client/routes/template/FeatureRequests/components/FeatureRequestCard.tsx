import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { ChevronDown, ChevronUp, Loader2, ExternalLink, Calendar } from 'lucide-react';
import { StatusBadge, PriorityBadge, GitHubStatusBadge } from './StatusBadge';
import { StatusIndicatorStrip } from './StatusIndicatorStrip';
import { MetadataIconRow } from './MetadataIconRow';
import { PrimaryActionButton } from './PrimaryActionButton';
import { FeatureRequestCardExpanded } from './FeatureRequestCardExpanded';
import { FeatureRequestCardMenu } from './FeatureRequestCardMenu';
import type { FeatureRequestClient, FeatureRequestPriority } from '@/apis/template/feature-requests/types';
import { useUpdatePriority, useDeleteFeatureRequest, useApproveFeatureRequest, useGitHubStatus, useGitHubStatuses, useUpdateGitHubStatus, useUpdateGitHubReviewStatus, useClearGitHubReviewStatus } from '../hooks';
import { useRouter } from '@/client/features';

interface FeatureRequestCardProps {
    request: FeatureRequestClient;
}

export function FeatureRequestCard({ request }: FeatureRequestCardProps) {
    const { navigate } = useRouter();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const updatePriorityMutation = useUpdatePriority();
    const deleteMutation = useDeleteFeatureRequest();
    const approveMutation = useApproveFeatureRequest();

    const { data: githubStatus, isLoading: isLoadingGitHubStatus } = useGitHubStatus(
        request.githubProjectItemId ? request._id : null,
        !!request.githubProjectItemId
    );

    const { data: availableStatuses } = useGitHubStatuses();
    const updateGitHubStatusMutation = useUpdateGitHubStatus();
    const updateGitHubReviewStatusMutation = useUpdateGitHubReviewStatus();
    const clearGitHubReviewStatusMutation = useClearGitHubReviewStatus();

    const canApprove = request.status === 'new' && !request.githubIssueUrl;

    const handleCardClick = () => {
        navigate(`/admin/feature-requests/${request._id}`);
    };

    const handleDelete = () => {
        deleteMutation.mutate(request._id, {
            onSuccess: () => setShowDeleteDialog(false),
        });
    };

    return (
        <Card className="relative border border-border shadow-sm transition-all duration-200 ease-out hover:shadow-md overflow-hidden">
            <StatusIndicatorStrip request={request} githubStatus={githubStatus?.status} />

            <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
                <div className="flex items-start justify-between gap-2 sm:gap-3">
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
                        <CardTitle className="text-sm font-semibold leading-tight line-clamp-2 hover:text-primary transition-colors mb-1.5 sm:text-base">
                            {request.title}
                        </CardTitle>

                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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

                            <div className="hidden xs:flex sm:flex">
                                <MetadataIconRow request={request} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-0.5 sm:gap-1 flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <PrimaryActionButton
                            canApprove={canApprove}
                            canReviewDesign={false}
                            onApprove={() => approveMutation.mutate(request._id)}
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
                        <FeatureRequestCardMenu
                            currentPriority={request.priority}
                            githubProjectItemId={request.githubProjectItemId}
                            githubStatus={githubStatus}
                            availableStatuses={availableStatuses}
                            onPriorityChange={(priority: FeatureRequestPriority) =>
                                updatePriorityMutation.mutate({ requestId: request._id, priority })
                            }
                            onGitHubStatusChange={(status: string) =>
                                updateGitHubStatusMutation.mutate({ requestId: request._id, status })
                            }
                            onGitHubReviewStatusChange={(reviewStatus: string) =>
                                updateGitHubReviewStatusMutation.mutate({ requestId: request._id, reviewStatus })
                            }
                            onClearGitHubReviewStatus={() =>
                                clearGitHubReviewStatusMutation.mutate({ requestId: request._id })
                            }
                            onDeleteClick={() => setShowDeleteDialog(true)}
                            isUpdatingGitHubStatus={updateGitHubStatusMutation.isPending}
                            isUpdatingReviewStatus={updateGitHubReviewStatusMutation.isPending}
                            isClearingReviewStatus={clearGitHubReviewStatusMutation.isPending}
                        />
                    </div>
                </div>
            </CardHeader>

            {isExpanded && (
                <FeatureRequestCardExpanded request={request} githubStatus={githubStatus} />
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
