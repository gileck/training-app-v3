import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Textarea } from '@/client/components/ui/textarea';
import { Label } from '@/client/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/client/components/ui/dialog';
import {
    CheckCircle,
    XCircle,
    Clock,
    Hammer,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import type {
    FeatureRequestClient,
    DesignPhaseType,
    DesignReviewStatus,
    DesignPhaseClient,
} from '@/apis/feature-requests/types';
import { useUpdateDesignReviewStatus } from '../hooks';

interface DesignReviewPanelProps {
    request: FeatureRequestClient;
    phase: DesignPhaseType;
    design: DesignPhaseClient;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const reviewStatusConfig: Record<
    DesignReviewStatus,
    { label: string; icon: React.ReactNode; className: string }
> = {
    not_started: {
        label: 'Not Started',
        icon: <Clock className="h-4 w-4" />,
        className: 'text-muted-foreground',
    },
    in_progress: {
        label: 'Agent Working',
        icon: <Hammer className="h-4 w-4" />,
        className: 'text-info',
    },
    pending_review: {
        label: 'Pending Your Review',
        icon: <AlertCircle className="h-4 w-4" />,
        className: 'text-warning',
    },
    approved: {
        label: 'Approved',
        icon: <CheckCircle className="h-4 w-4" />,
        className: 'text-success',
    },
    rejected: {
        label: 'Rejected - Needs Rework',
        icon: <XCircle className="h-4 w-4" />,
        className: 'text-destructive',
    },
};

export function DesignReviewPanel({
    request,
    phase,
    design,
    open,
    onOpenChange,
}: DesignReviewPanelProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form state
    const [feedback, setFeedback] = useState(design.adminComments || '');

    const updateMutation = useUpdateDesignReviewStatus();

    const phaseLabel = phase === 'product' ? 'Product Design' : 'Technical Design';
    const statusConfig = reviewStatusConfig[design.reviewStatus];

    const handleApprove = () => {
        updateMutation.mutate(
            {
                requestId: request._id,
                phase,
                reviewStatus: 'approved',
            },
            {
                onSuccess: () => onOpenChange(false),
            }
        );
    };

    const handleReject = () => {
        if (!feedback.trim()) {
            return;
        }

        updateMutation.mutate(
            {
                requestId: request._id,
                phase,
                reviewStatus: 'rejected',
                adminComments: feedback.trim(),
            },
            {
                onSuccess: () => onOpenChange(false),
            }
        );
    };

    const canReview = design.reviewStatus === 'pending_review';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{phaseLabel} Review</DialogTitle>
                    <DialogDescription>
                        Review the design document for &ldquo;{request.title}&rdquo;
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Status */}
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                        <span className="text-sm font-medium">Status:</span>
                        <span className={`flex items-center gap-1 font-medium ${statusConfig.className}`}>
                            {statusConfig.icon}
                            {statusConfig.label}
                        </span>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-2 text-sm">
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
                            <span className="font-medium">Iteration:</span>
                            <span className="text-muted-foreground">{design.iterations}</span>
                        </div>
                        {design.generatedAt && (
                            <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1">
                                <span className="font-medium">Generated:</span>
                                <span className="text-muted-foreground">{new Date(design.generatedAt).toLocaleString()}</span>
                            </div>
                        )}
                        {design.approvedAt && (
                            <div className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1">
                                <span className="font-medium text-success">Approved:</span>
                                <span className="text-success">{new Date(design.approvedAt).toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    {/* Design Content */}
                    <Card className="border-2">
                        <CardHeader className="bg-muted/30 pb-3">
                            <CardTitle className="text-base">Design Document</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {design.content ? (
                                <div className="prose prose-sm max-h-96 max-w-none overflow-y-auto">
                                    <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm">
                                        {design.content}
                                    </pre>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No design content yet. The agent will generate this.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Previous Feedback (if rejected before) */}
                    {design.adminComments && design.reviewStatus !== 'pending_review' && (
                        <Card className="border-2 border-dashed border-warning/30 bg-warning/5">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-warning-foreground">
                                    Previous Feedback
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap text-sm text-warning-foreground">
                                    {design.adminComments}
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Review Actions */}
                    {canReview && (
                        <div className="space-y-4 border-t pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="feedback">
                                    Feedback (required for rejection)
                                </Label>
                                <Textarea
                                    id="feedback"
                                    placeholder="Provide feedback for the agent to improve the design..."
                                    value={feedback}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
                                    className="min-h-24"
                                    disabled={updateMutation.isPending}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={handleReject}
                                    disabled={
                                        updateMutation.isPending || !feedback.trim()
                                    }
                                >
                                    {updateMutation.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <XCircle className="mr-2 h-4 w-4" />
                                    )}
                                    Reject with Feedback
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleApprove}
                                    disabled={updateMutation.isPending}
                                >
                                    {updateMutation.isPending ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                    )}
                                    Approve
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
