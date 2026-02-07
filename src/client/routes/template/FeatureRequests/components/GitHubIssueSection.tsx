import { ExternalLink, GitPullRequest, FileText, Loader2, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/client/components/template/ui/badge';
import { Button } from '@/client/components/template/ui/button';
import { ErrorDisplay } from '@/client/features/template/error-tracking';
import type { GitHubIssueDetails, DesignDocArtifact, ImplementationPhaseArtifact } from '@/apis/template/feature-requests/types';

interface GitHubIssueSectionProps {
    issueDetails: GitHubIssueDetails | null | undefined;
    isLoading: boolean;
    error: Error | null;
}

/**
 * Get status badge variant and label for implementation phase
 */
function getPhaseStatusDisplay(status: ImplementationPhaseArtifact['status']): {
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    label: string;
} {
    switch (status) {
        case 'merged':
            return { variant: 'default', label: 'Merged' };
        case 'approved':
            return { variant: 'default', label: 'Approved' };
        case 'in-review':
            return { variant: 'secondary', label: 'In Review' };
        case 'changes-requested':
            return { variant: 'destructive', label: 'Changes Requested' };
        case 'pending':
        default:
            return { variant: 'outline', label: 'Pending' };
    }
}

/**
 * Component to display a design document artifact
 */
function DesignDocItem({ doc }: { doc: DesignDocArtifact }) {
    return (
        <div className="flex items-center justify-between rounded-md border bg-card p-3">
            <div className="flex flex-1 items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{doc.label}</p>
                    <p className="text-xs text-muted-foreground">
                        Updated {doc.lastUpdated}
                        {doc.prNumber && <span className="ml-2">• PR #{doc.prNumber}</span>}
                    </p>
                </div>
                {doc.status === 'approved' ? (
                    <Badge variant="default" className="shrink-0 gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Approved
                    </Badge>
                ) : (
                    <Badge variant="outline" className="shrink-0 gap-1">
                        <Clock className="h-3 w-3" />
                        Pending
                    </Badge>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="shrink-0"
                >
                    <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${doc.label}`}
                    >
                        <ExternalLink className="h-4 w-4" />
                    </a>
                </Button>
            </div>
        </div>
    );
}

/**
 * Component to display an implementation phase artifact
 */
function ImplementationPhaseItem({ phase }: { phase: ImplementationPhaseArtifact }) {
    const { variant, label } = getPhaseStatusDisplay(phase.status);
    const phaseLabel = phase.totalPhases > 1
        ? `Phase ${phase.phase}/${phase.totalPhases}${phase.name ? `: ${phase.name}` : ''}`
        : phase.name || 'Implementation';

    return (
        <div className="flex items-center justify-between rounded-md border bg-card p-3">
            <div className="flex flex-1 items-center gap-3">
                <GitPullRequest className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{phaseLabel}</p>
                    {phase.prNumber && (
                        <p className="text-xs text-muted-foreground">
                            PR #{phase.prNumber}
                        </p>
                    )}
                </div>
                <Badge variant={variant} className="shrink-0">
                    {label}
                </Badge>
                {phase.prUrl && (
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="shrink-0"
                    >
                        <a
                            href={phase.prUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View PR #${phase.prNumber}`}
                        >
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    </Button>
                )}
            </div>
        </div>
    );
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
        return <ErrorDisplay error={error} title="Failed to load issue details" variant="inline" />;
    }

    // No data state
    if (!issueDetails) {
        return (
            <p className="text-center text-sm text-muted-foreground py-6">
                No issue details available
            </p>
        );
    }

    const hasDesignDocs = issueDetails.artifacts?.designDocs && issueDetails.artifacts.designDocs.length > 0;
    const hasImplementationPhases = issueDetails.artifacts?.implementationPhases && issueDetails.artifacts.implementationPhases.length > 0;
    const hasArtifacts = hasDesignDocs || hasImplementationPhases;

    return (
        <div className="space-y-4">
            {/* Artifacts Section - Design Docs and Implementation PRs from artifact comment */}
            {hasArtifacts && (
                <>
                    {/* Design Documents */}
                    {hasDesignDocs && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold">Design Documents</h4>
                            <div className="space-y-2">
                                {issueDetails.artifacts!.designDocs.map((doc) => (
                                    <DesignDocItem key={doc.type} doc={doc} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Implementation Phases */}
                    {hasImplementationPhases && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold">Implementation Progress</h4>
                            <div className="space-y-2">
                                {issueDetails.artifacts!.implementationPhases.map((phase) => (
                                    <ImplementationPhaseItem
                                        key={`phase-${phase.phase}`}
                                        phase={phase}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

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
