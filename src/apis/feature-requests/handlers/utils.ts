import { toStringId } from '@/server/utils';
import {
    FeatureRequestDocument,
    FeatureRequestClient,
    DesignPhase,
    DesignPhaseClient,
    FeatureRequestComment,
    FeatureRequestCommentClient,
} from '@/server/database/collections/feature-requests/types';

/**
 * Convert a DesignPhase to client format
 */
function toDesignPhaseClient(phase: DesignPhase | undefined): DesignPhaseClient | undefined {
    if (!phase) return undefined;

    return {
        content: phase.content,
        reviewStatus: phase.reviewStatus,
        adminComments: phase.adminComments,
        iterations: phase.iterations,
        generatedAt: phase.generatedAt?.toISOString(),
        approvedAt: phase.approvedAt?.toISOString(),
    };
}

/**
 * Convert a FeatureRequestComment to client format
 */
function toCommentClient(comment: FeatureRequestComment): FeatureRequestCommentClient {
    return {
        id: comment.id,
        authorId: toStringId(comment.authorId),
        authorName: comment.authorName,
        isAdmin: comment.isAdmin,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
    };
}

/**
 * Convert a FeatureRequestDocument to client format
 */
export function toFeatureRequestClient(doc: FeatureRequestDocument): FeatureRequestClient {
    return {
        _id: toStringId(doc._id),
        title: doc.title,
        description: doc.description,
        page: doc.page,
        status: doc.status,
        productDesign: toDesignPhaseClient(doc.productDesign),
        techDesign: toDesignPhaseClient(doc.techDesign),
        needsUserInput: doc.needsUserInput,
        requestedBy: toStringId(doc.requestedBy),
        requestedByName: doc.requestedByName || toStringId(doc.requestedBy), // Fallback to ID for backward compatibility
        comments: (doc.comments || []).map(toCommentClient),
        adminNotes: doc.adminNotes,
        priority: doc.priority,
        // GitHub integration fields
        githubIssueUrl: doc.githubIssueUrl,
        githubIssueNumber: doc.githubIssueNumber,
        githubProjectItemId: doc.githubProjectItemId,
        githubProjectStatus: doc.githubProjectStatus,
        githubReviewStatus: doc.githubReviewStatus,
        githubPrUrl: doc.githubPrUrl,
        githubPrNumber: doc.githubPrNumber,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
    };
}

/**
 * Convert a FeatureRequestDocument to client format without admin-only fields
 * Used for user-facing endpoints
 */
export function toFeatureRequestClientForUser(doc: FeatureRequestDocument): FeatureRequestClient {
    const client = toFeatureRequestClient(doc);
    // Remove admin-only fields
    delete client.adminNotes;
    return client;
}
