import { useState } from 'react';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { Card, CardContent } from '@/client/components/template/ui/card';
import { Textarea } from '@/client/components/template/ui/textarea';
import { ErrorDisplay } from '@/client/features/template/error-tracking';
import { useRouter } from '@/client/features';
import { generateId } from '@/client/utils/id';
import { CollapsibleSection } from './components/CollapsibleSection';
import { FeatureRequestDetailHeader } from './FeatureRequestDetailHeader';
import { useFeatureRequestDetail, useAddAdminComment } from './hooks';

export function FeatureRequestDetail() {
    const { routeParams, navigate } = useRouter();
    const requestId = routeParams.requestId;

    const { data: request, isLoading, error } = useFeatureRequestDetail(requestId);
    const addCommentMutation = useAddAdminComment();

    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [commentText, setCommentText] = useState('');

    const handleBack = () => {
        navigate('/admin/feature-requests');
    };

    const handleAddComment = () => {
        if (!requestId || !commentText.trim()) return;
        addCommentMutation.mutate({
            requestId,
            content: commentText.trim(),
            commentId: generateId(),
        });
        setCommentText('');
    };

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

    if (error) {
        return (
            <div className="container mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
                <ErrorDisplay
                    error={error}
                    title="Failed to load feature request"
                    onBack={handleBack}
                    backLabel="Back to Feature Requests"
                />
            </div>
        );
    }

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

    const commentsCount = request.comments?.length || 0;

    return (
        <div className="container mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8">
            <div className="sticky top-0 z-10 -mx-3 mb-4 bg-background px-3 py-2 shadow-sm sm:relative sm:top-auto sm:z-auto sm:-mx-0 sm:mb-6 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none">
                <Button variant="ghost" onClick={handleBack} className="gap-2 -ml-2" size="sm">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sm:inline">Back</span>
                </Button>
            </div>

            <FeatureRequestDetailHeader request={request} />

            <div className="space-y-3 sm:space-y-4">
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

                <CollapsibleSection title="Comments" count={commentsCount} defaultExpanded={false}>
                    <div className="space-y-3 sm:space-y-4">
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
                                            <span className="font-medium text-foreground">{comment.authorName}</span>
                                            {comment.isAdmin && (
                                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary sm:px-2">
                                                    Admin
                                                </span>
                                            )}
                                            <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                        </div>
                                        <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Textarea
                                className="min-h-[80px] resize-none"
                                placeholder="Add an admin comment..."
                                value={commentText}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommentText(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <Button
                                    size="sm"
                                    onClick={handleAddComment}
                                    disabled={!commentText.trim()}
                                >
                                    <Send className="mr-2 h-4 w-4" />
                                    Add Comment
                                </Button>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

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
