import { Button } from '@/client/components/ui/button';
import { CheckCircle, Eye } from 'lucide-react';
interface PrimaryActionButtonProps {
    canApprove: boolean;
    canReviewDesign: boolean;
    onApprove: () => void;
    onReview: () => void;
    isApproving: boolean;
}

/**
 * Context-aware primary action button that adapts based on item state
 *
 * Action logic:
 * - New (no GitHub link): "Approve" → creates GitHub issue
 * - Waiting for Review (design phase): "Review" → opens review panel
 * - All others: No primary action shown (only expand/collapse and menu)
 */
export function PrimaryActionButton({
    canApprove,
    canReviewDesign,
    onApprove,
    onReview,
    isApproving,
}: PrimaryActionButtonProps) {
    // Priority: Approve > Review
    if (canApprove) {
        return (
            <Button
                variant="default"
                size="sm"
                onClick={onApprove}
                disabled={isApproving}
                className="gap-1 h-8"
            >
                <CheckCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                    {isApproving ? 'Approving...' : 'Approve'}
                </span>
            </Button>
        );
    }

    if (canReviewDesign) {
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={onReview}
                className="gap-1 h-8"
            >
                <Eye className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Review</span>
            </Button>
        );
    }

    // No primary action for other states
    return null;
}
