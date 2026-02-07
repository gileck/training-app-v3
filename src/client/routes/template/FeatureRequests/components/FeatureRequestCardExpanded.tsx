import { CardContent } from '@/client/components/template/ui/card';
import { User, Calendar, FileText, ExternalLink } from 'lucide-react';
import { HealthIndicator } from './HealthIndicator';
import type { FeatureRequestClient } from '@/apis/template/feature-requests/types';
import type { GetGitHubStatusResponse } from '@/apis/template/feature-requests/types';

interface FeatureRequestCardExpandedProps {
    request: FeatureRequestClient;
    githubStatus: GetGitHubStatusResponse | null | undefined;
}

export function FeatureRequestCardExpanded({ request, githubStatus }: FeatureRequestCardExpandedProps) {
    return (
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
    );
}
