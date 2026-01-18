import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Textarea } from '@/client/components/ui/textarea';
import { ChevronDown, ChevronUp, Calendar, FileText, MessageSquare, Send, Loader2 } from 'lucide-react';
import { UserStatusBadge } from './UserStatusBadge';
import type { FeatureRequestClient } from '@/apis/feature-requests/types';
import { useAddComment } from '../hooks';

interface MyRequestCardProps {
    request: FeatureRequestClient;
}

export function MyRequestCard({ request }: MyRequestCardProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [newComment, setNewComment] = useState('');

    const addCommentMutation = useAddComment();

    const handleSubmitComment = () => {
        if (!newComment.trim()) return;

        addCommentMutation.mutate(
            { requestId: request._id, content: newComment.trim() },
            {
                onSuccess: () => setNewComment(''),
            }
        );
    };

    return (
        <Card className="mb-3">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                        <CardTitle className="text-base font-medium">{request.title}</CardTitle>
                        <UserStatusBadge status={request.status} />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Description</h4>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {request.description}
                        </p>
                    </div>

                    {request.page && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span>Page: {request.page}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Submitted: {new Date(request.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Comments section */}
                    {request.comments && request.comments.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="flex items-center gap-2 text-sm font-medium">
                                <MessageSquare className="h-4 w-4" />
                                Comments ({request.comments.length})
                            </h4>
                            <div className="space-y-2">
                                {request.comments.map((comment) => (
                                    <div
                                        key={comment.id}
                                        className={`rounded-md border p-2 text-sm ${
                                            comment.isAdmin ? 'border-primary/30 bg-primary/5' : 'bg-muted/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="font-medium">
                                                {comment.isAdmin ? 'Admin' : 'You'}
                                            </span>
                                            <span>
                                                {new Date(comment.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="mt-1">{comment.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add comment form (shown when admin needs input) */}
                    {request.needsUserInput && (
                        <div className="space-y-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
                            <h4 className="text-sm font-medium text-yellow-600">
                                Admin needs more information
                            </h4>
                            <Textarea
                                placeholder="Provide additional details or answer the admin's questions..."
                                value={newComment}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                    setNewComment(e.target.value)
                                }
                                className="min-h-20"
                                disabled={addCommentMutation.isPending}
                            />
                            <Button
                                size="sm"
                                onClick={handleSubmitComment}
                                disabled={!newComment.trim() || addCommentMutation.isPending}
                            >
                                {addCommentMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="mr-2 h-4 w-4" />
                                )}
                                Send Response
                            </Button>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
