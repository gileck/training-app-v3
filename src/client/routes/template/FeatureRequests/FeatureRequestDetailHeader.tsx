import { Calendar, User, FileText, ExternalLink } from 'lucide-react';
import { StatusBadge, PriorityBadge } from './components/StatusBadge';
import type { FeatureRequestClient } from '@/apis/template/feature-requests/types';
import type { GetGitHubStatusResponse } from '@/apis/template/feature-requests/types';

interface FeatureRequestDetailHeaderProps {
    request: FeatureRequestClient;
    githubStatus: GetGitHubStatusResponse | null | undefined;
    isLoadingGitHubStatus: boolean;
}

export function FeatureRequestDetailHeader({
    request,
    githubStatus,
    isLoadingGitHubStatus,
}: FeatureRequestDetailHeaderProps) {
    const hasGitHubIssue = !!request.githubIssueUrl;

    return (
        <div className="mb-4 space-y-3 sm:mb-6 sm:space-y-4">
            <h1 className="text-xl font-bold leading-tight sm:text-2xl md:text-3xl">{request.title}</h1>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {request.githubProjectItemId ? (
                    isLoadingGitHubStatus ? (
                        <span className="text-sm text-muted-foreground">Loading status...</span>
                    ) : githubStatus?.status ? (
                        <div className="flex items-center gap-2">
                            <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground sm:px-2.5 sm:text-sm">
                                {githubStatus.status}
                            </span>
                            {githubStatus.reviewStatus && (
                                <span className="text-xs text-muted-foreground">
                                    ({githubStatus.reviewStatus})
                                </span>
                            )}
                        </div>
                    ) : (
                        <StatusBadge status={request.status} />
                    )
                ) : (
                    <StatusBadge status={request.status} />
                )}
                <PriorityBadge priority={request.priority} />
            </div>

            {hasGitHubIssue && (
                <div className="flex flex-wrap gap-2 sm:gap-3">
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
            )}

            <div className="flex flex-wrap gap-1.5 text-xs sm:gap-2 sm:text-sm">
                <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 sm:px-2.5">
                    <User className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" />
                    <span className="text-muted-foreground">{request.requestedByName}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 sm:px-2.5">
                    <Calendar className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" />
                    <span className="text-muted-foreground">
                        {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 sm:px-2.5">
                    <Calendar className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" />
                    <span className="text-muted-foreground">
                        Updated {new Date(request.updatedAt).toLocaleDateString()}
                    </span>
                </div>
                {request.page && (
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 sm:px-2.5">
                        <FileText className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5" />
                        <span className="text-muted-foreground truncate max-w-[120px] sm:max-w-none">{request.page}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
