import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { ConfirmDialog } from '@/client/components/template/ui/confirm-dialog';
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { StatusIndicatorStrip } from './StatusIndicatorStrip';
import { MetadataIconRow } from './MetadataIconRow';
import { FeatureRequestCardExpanded } from './FeatureRequestCardExpanded';
import { FeatureRequestCardMenu } from './FeatureRequestCardMenu';
import type { FeatureRequestClient, FeatureRequestStatus, FeatureRequestPriority } from '@/apis/template/feature-requests/types';
import { useUpdateFeatureRequestStatus, useUpdatePriority, useDeleteFeatureRequest } from '../hooks';
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

    const updateStatusMutation = useUpdateFeatureRequestStatus();
    const updatePriorityMutation = useUpdatePriority();
    const deleteMutation = useDeleteFeatureRequest();

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
            <StatusIndicatorStrip request={request} />

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
                            <StatusBadge status={request.status} />

                            <PriorityBadge priority={request.priority} />

                            <div className="xs:hidden flex items-center gap-1.5 text-xs text-muted-foreground">
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
                            currentStatus={request.status}
                            currentPriority={request.priority}
                            onStatusChange={(status: FeatureRequestStatus) =>
                                updateStatusMutation.mutate({ requestId: request._id, status })
                            }
                            onPriorityChange={(priority: FeatureRequestPriority) =>
                                updatePriorityMutation.mutate({ requestId: request._id, priority })
                            }
                            onDeleteClick={() => setShowDeleteDialog(true)}
                        />
                    </div>
                </div>
            </CardHeader>

            {isExpanded && (
                <FeatureRequestCardExpanded request={request} />
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
