import { ArrowLeft, Calendar, User, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/client/components/ui/button';
import { Card, CardContent } from '@/client/components/ui/card';
import { useRouter } from '@/client/router';
import { StatusBadge, PriorityBadge } from './components/StatusBadge';
import { CollapsibleSection } from './components/CollapsibleSection';
import { GitHubIssueSection } from './components/GitHubIssueSection';
import { useFeatureRequestDetail, useGitHubStatus, useGitHubIssueDetails } from './hooks';

/**
 * Feature Request Detail Page (Admin Only)
 *
 * Displays full feature request data with collapsible sections:
 * - Description (expanded by default)
 * - GitHub Issue Details (expanded if exists)
 * - Comments (collapsed by default)
 * - Admin Notes (collapsed)
 */
export function FeatureRequestDetail() {
    const { routeParams, navigate } = useRouter();
    const requestId = routeParams.requestId;

    const { data: request, isLoading, error } = useFeatureRequestDetail(requestId);

    // Fetch GitHub status if available
    const { data: githubStatus, isLoading: isLoadingGitHubStatus } = useGitHubStatus(
        request?.githubProjectItemId ? request._id : null,
        !!request?.githubProjectItemId
    );

    // Fetch GitHub issue details if available
    const { data: githubIssueDetails, isLoading: isLoadingIssueDetails, error: issueDetailsError } = useGitHubIssueDetails(
        request?.githubIssueNumber ? request._id : null,
        !!request?.githubIssueNumber
    );

    const handleBack = () => {
        navigate('/admin/feature-requests');
    };

    // Loading state
    if (isLoading || !requestId) {
        return (
            <div className="container mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading feature request...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="container mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="mb-4 text-lg font-medium text-destructive">
                            {error instanceof Error ? error.message : 'Failed to load feature request'}
                        </p>
                        <Button onClick={handleBack}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Feature Requests
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Not found state
    if (!request) {
        return (
            <div className="container mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="mb-4 text-lg font-medium">Feature request not found</p>
                        <Button onClick={handleBack}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Feature Requests
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const hasGitHubIssue = !!request.githubIssueUrl;
    const commentsCount = request.comments?.length || 0;

    return (
        <div className="container mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
            {/* Back Button - Sticky on mobile */}
            <div className="sticky top-0 z-10 -mx-3 mb-4 bg-background px-3 py-2 shadow-sm sm:relative sm:top-auto sm:z-auto sm:-mx-0 sm:mb-6 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none">
                <Button
                    variant="ghost"
                    onClick={handleBack}
                    className="gap-2 -ml-2"
                    size="sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sm:inline">Back</span>
                </Button>
            </div>

            {/* Header Section */}
            <div className="mb-4 space-y-3 sm:mb-6 sm:space-y-4">
                <h1 className="text-xl font-bold leading-tight sm:text-2xl md:text-3xl">{request.title}</h1>

                {/* Status, Priority, and Timestamps */}
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

                {/* GitHub Issue Link */}
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

                {/* Metadata */}
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

            {/* Collapsible Sections */}
            <div className="space-y-3 sm:space-y-4">
                {/* Description Section - Expanded by default */}
                <CollapsibleSection title="Description" defaultExpanded={true}>
                    <div className="space-y-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {request.description}
                        </p>
                        {request.page && (
                            <div className="rounded-md bg-muted/50 p-2.5 sm:p-3">
                                <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">Related page:</span> {request.page}
                                </p>
                            </div>
                        )}
                    </div>
                </CollapsibleSection>

                {/* GitHub Issue Details - Expanded if exists */}
                {hasGitHubIssue && (
                    <CollapsibleSection title="GitHub Issue Details" defaultExpanded={true}>
                        <div className="space-y-3">
                            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                                <div className="rounded-md bg-muted/50 p-2.5 sm:p-3">
                                    <p className="text-xs text-muted-foreground">Issue Number</p>
                                    <p className="font-medium">#{request.githubIssueNumber}</p>
                                </div>
                                {githubStatus?.issueState && (
                                    <div className="rounded-md bg-muted/50 p-2.5 sm:p-3">
                                        <p className="text-xs text-muted-foreground">Issue State</p>
                                        <p className="font-medium">{githubStatus.issueState}</p>
                                    </div>
                                )}
                            </div>

                            {isLoadingGitHubStatus && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Loading GitHub status...</span>
                                </div>
                            )}

                            {githubStatus?.status && (
                                <div className="rounded-md bg-muted/50 p-2.5 sm:p-3">
                                    <p className="text-xs text-muted-foreground">GitHub Project Status</p>
                                    <p className="font-medium">{githubStatus.status}</p>
                                </div>
                            )}

                            {githubStatus?.reviewStatus && (
                                <div className="rounded-md bg-muted/50 p-2.5 sm:p-3">
                                    <p className="text-xs text-muted-foreground">Review Status</p>
                                    <p className="font-medium">{githubStatus.reviewStatus}</p>
                                </div>
                            )}

                            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                                <a
                                    href={request.githubIssueUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    View on GitHub
                                </a>
                            </div>
                        </div>
                    </CollapsibleSection>
                )}

                {/* GitHub Issue Description & Linked PRs - Expanded by default when data exists */}
                {hasGitHubIssue && (
                    <CollapsibleSection title="GitHub Issue Description & Linked PRs" defaultExpanded={true}>
                        <GitHubIssueSection
                            issueDetails={githubIssueDetails}
                            isLoading={isLoadingIssueDetails}
                            error={issueDetailsError}
                        />
                    </CollapsibleSection>
                )}

                {/* No GitHub Issue Message */}
                {!hasGitHubIssue && request.status === 'new' && (
                    <Card>
                        <CardContent className="py-6">
                            <p className="text-sm text-muted-foreground text-center">
                                This request hasn&apos;t been synced to GitHub yet
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Comments Section - Collapsed by default */}
                <CollapsibleSection title="Comments" count={commentsCount} defaultExpanded={false}>
                    {commentsCount === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-6">
                            No comments yet
                        </p>
                    ) : (
                        <div className="space-y-2 sm:space-y-3">
                            {request.comments.map((comment) => (
                                <div
                                    key={comment.id}
                                    className={`rounded-md border p-3 sm:p-4 ${
                                        comment.isAdmin ? 'bg-background' : 'bg-muted/30'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-center gap-1.5 mb-2 text-xs text-muted-foreground sm:gap-2">
                                        <span className="font-medium text-foreground">
                                            {comment.authorName}
                                        </span>
                                        {comment.isAdmin && (
                                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary sm:px-2">
                                                Admin
                                            </span>
                                        )}
                                        <span>
                                            {new Date(comment.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </CollapsibleSection>

                {/* Admin Notes Section - Collapsed by default, always visible */}
                <CollapsibleSection title="Admin Notes" defaultExpanded={false}>
                    {request.adminNotes ? (
                        <div className="rounded-md border border-dashed border-warning/30 bg-warning/5 p-3 sm:p-4">
                            <p className="whitespace-pre-wrap text-sm">{request.adminNotes}</p>
                        </div>
                    ) : (
                        <p className="text-center text-sm text-muted-foreground py-6">
                            No admin notes
                        </p>
                    )}
                </CollapsibleSection>
            </div>
        </div>
    );
}
