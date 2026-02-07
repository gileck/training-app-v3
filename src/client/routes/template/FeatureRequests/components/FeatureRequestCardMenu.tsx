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
import { MoreVertical, Trash2, Loader2, RotateCcw } from 'lucide-react';
import type { FeatureRequestPriority } from '@/apis/template/feature-requests/types';
import type { GetGitHubStatusResponse, GetGitHubStatusesResponse } from '@/apis/template/feature-requests/types';

const allPriorities: FeatureRequestPriority[] = ['low', 'medium', 'high', 'critical'];

interface FeatureRequestCardMenuProps {
    currentPriority: FeatureRequestPriority | undefined;
    githubProjectItemId?: string;
    githubStatus: GetGitHubStatusResponse | null | undefined;
    availableStatuses: GetGitHubStatusesResponse | undefined;
    onPriorityChange: (priority: FeatureRequestPriority) => void;
    onGitHubStatusChange: (status: string) => void;
    onGitHubReviewStatusChange: (reviewStatus: string) => void;
    onClearGitHubReviewStatus: () => void;
    onDeleteClick: () => void;
    isUpdatingGitHubStatus: boolean;
    isUpdatingReviewStatus: boolean;
    isClearingReviewStatus: boolean;
}

export function FeatureRequestCardMenu({
    currentPriority,
    githubProjectItemId,
    githubStatus,
    availableStatuses,
    onPriorityChange,
    onGitHubStatusChange,
    onGitHubReviewStatusChange,
    onClearGitHubReviewStatus,
    onDeleteClick,
    isUpdatingGitHubStatus,
    isUpdatingReviewStatus,
    isClearingReviewStatus,
}: FeatureRequestCardMenuProps) {
    return (
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
                                onClick={() => onPriorityChange(priority)}
                                disabled={priority === currentPriority}
                            >
                                {priority.charAt(0).toUpperCase() + priority.slice(1)}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                {githubProjectItemId && availableStatuses?.statuses && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>GitHub Status</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {availableStatuses.statuses.map((status) => (
                                <DropdownMenuItem
                                    key={status}
                                    onClick={() => onGitHubStatusChange(status)}
                                    disabled={status === githubStatus?.status || isUpdatingGitHubStatus}
                                >
                                    {status}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}
                {githubProjectItemId && availableStatuses?.reviewStatuses && availableStatuses.reviewStatuses.length > 0 && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            {isUpdatingReviewStatus && (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            )}
                            GitHub Review Status
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {availableStatuses.reviewStatuses.map((reviewStatus) => (
                                <DropdownMenuItem
                                    key={reviewStatus}
                                    onClick={() => onGitHubReviewStatusChange(reviewStatus)}
                                    disabled={reviewStatus === githubStatus?.reviewStatus || isUpdatingReviewStatus}
                                >
                                    {reviewStatus}
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={onClearGitHubReviewStatus}
                                disabled={!githubStatus?.reviewStatus || isClearingReviewStatus}
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
                    onClick={onDeleteClick}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
