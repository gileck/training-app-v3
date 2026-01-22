import { ExternalLink, GitPullRequest, Loader2 } from 'lucide-react';
import { Badge } from '@/client/components/ui/badge';
import { Button } from '@/client/components/ui/button';
import type { GitHubIssueDetails } from '@/apis/feature-requests/types';

interface GitHubIssueSectionProps {
    issueDetails: GitHubIssueDetails | null | undefined;
    isLoading: boolean;
    error: Error | null;
}

/**
 * Component to display GitHub issue description and linked PRs
 * Shows full markdown description (collapsed by default) and linked PRs as badges
 */
export function GitHubIssueSection({ issueDetails, isLoading, error }: GitHubIssueSectionProps) {
    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading issue details...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="rounded-md bg-destructive/10 px-4 py-3">
                <p className="text-sm text-destructive">
                    Failed to load issue details: {error.message}
                </p>
            </div>
        );
    }

    // No data state
    if (!issueDetails) {
        return (
            <p className="text-center text-sm text-muted-foreground py-6">
                No issue details available
            </p>
        );
    }

    const hasLinkedPRs = issueDetails.linkedPullRequests.length > 0;

    return (
        <div className="space-y-4">
            {/* GitHub Issue Description */}
            <div className="space-y-2">
                <h4 className="text-sm font-semibold">Issue Description</h4>
                <div className="rounded-md border bg-muted/30 p-4">
                    {issueDetails.body ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {issueDetails.body}
                        </div>
                    ) : (
                        <p className="text-sm italic text-muted-foreground">No description provided</p>
                    )}
                </div>
            </div>

            {/* Linked Pull Requests */}
            {hasLinkedPRs && (
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Linked Pull Requests</h4>
                    <div className="space-y-2">
                        {issueDetails.linkedPullRequests.map((pr) => (
                            <div
                                key={pr.number}
                                className="flex items-center justify-between rounded-md border bg-card p-3"
                            >
                                <div className="flex flex-1 items-center gap-3">
                                    <GitPullRequest className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{pr.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                            PR #{pr.number}
                                            {pr.mergedAt && (
                                                <span className="ml-2">
                                                    • Merged {new Date(pr.mergedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            pr.state === 'MERGED'
                                                ? 'default'
                                                : pr.state === 'OPEN'
                                                ? 'secondary'
                                                : 'outline'
                                        }
                                        className="shrink-0"
                                    >
                                        {pr.state}
                                    </Badge>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        asChild
                                        className="shrink-0"
                                    >
                                        <a
                                            href={pr.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`View PR #${pr.number} on GitHub`}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* View on GitHub Link */}
            <div className="pt-2">
                <Button variant="outline" size="sm" asChild>
                    <a
                        href={issueDetails.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2"
                    >
                        <ExternalLink className="h-4 w-4" />
                        View Full Issue on GitHub
                    </a>
                </Button>
            </div>
        </div>
    );
}
