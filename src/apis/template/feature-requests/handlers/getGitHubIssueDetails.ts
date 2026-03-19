import {
    GetGitHubIssueDetailsRequest,
    GetGitHubIssueDetailsResponse,
    IssueArtifacts,
    DesignDocArtifact,
    ImplementationPhaseArtifact,
} from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { getProjectManagementAdapter } from '@/server/template/project-management';
import { parseArtifactComment, type GitHubComment } from '@/agents/lib/artifacts';
import { getProjectConfig } from '@/server/template/project-management/config';

/**
 * Convert parsed artifact comment to API-friendly IssueArtifacts
 */
function convertToIssueArtifacts(
    parsedArtifact: ReturnType<typeof parseArtifactComment>,
    config: ReturnType<typeof getProjectConfig>
): IssueArtifacts {
    const designDocs: DesignDocArtifact[] = [];
    const implementationPhases: ImplementationPhaseArtifact[] = [];

    if (!parsedArtifact) {
        return { designDocs, implementationPhases };
    }

    // Convert design documents
    if (parsedArtifact.productDevelopment) {
        designDocs.push({
            type: 'product-dev',
            label: 'Product Development',
            url: parsedArtifact.productDevelopment.path,
            status: parsedArtifact.productDevelopment.status,
            lastUpdated: parsedArtifact.productDevelopment.lastUpdated,
            prNumber: parsedArtifact.productDevelopment.prNumber,
        });
    }

    if (parsedArtifact.productDesign) {
        designDocs.push({
            type: 'product-design',
            label: 'Product Design',
            url: parsedArtifact.productDesign.path,
            status: parsedArtifact.productDesign.status,
            lastUpdated: parsedArtifact.productDesign.lastUpdated,
            prNumber: parsedArtifact.productDesign.prNumber,
        });
    }

    if (parsedArtifact.techDesign) {
        designDocs.push({
            type: 'tech-design',
            label: 'Technical Design',
            url: parsedArtifact.techDesign.path,
            status: parsedArtifact.techDesign.status,
            lastUpdated: parsedArtifact.techDesign.lastUpdated,
            prNumber: parsedArtifact.techDesign.prNumber,
        });
    }

    // Convert implementation phases
    if (parsedArtifact.implementation) {
        const impl = parsedArtifact.implementation;

        if (impl.phases && impl.phases.length > 0) {
            // Multi-phase implementation
            for (const phase of impl.phases) {
                implementationPhases.push({
                    phase: phase.phase,
                    totalPhases: phase.totalPhases,
                    name: phase.name,
                    status: phase.status,
                    prNumber: phase.prNumber,
                    prUrl: phase.prNumber
                        ? `https://github.com/${config.github.owner}/${config.github.repo}/pull/${phase.prNumber}`
                        : undefined,
                });
            }
        } else if (impl.status) {
            // Single-phase implementation (legacy format)
            implementationPhases.push({
                phase: 1,
                totalPhases: 1,
                name: '',
                status: impl.status,
                prNumber: impl.prNumber,
                prUrl: impl.prNumber
                    ? `https://github.com/${config.github.owner}/${config.github.repo}/pull/${impl.prNumber}`
                    : undefined,
            });
        }
    }

    return { designDocs, implementationPhases };
}

export const getGitHubIssueDetails = async (
    request: GetGitHubIssueDetailsRequest,
    context: ApiHandlerContext
): Promise<GetGitHubIssueDetailsResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Authentication required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        // Get the feature request
        const featureRequest = await featureRequests.findFeatureRequestById(request.requestId);

        if (!featureRequest) {
            return { error: 'Feature request not found' };
        }

        // Check if user owns this request or is admin
        const isOwner = featureRequest.requestedBy.toString() === context.userId;
        if (!isOwner && !context.isAdmin) {
            return { error: 'Access denied' };
        }

        // Check if we have a GitHub issue number
        if (!featureRequest.githubIssueNumber) {
            return { error: 'No GitHub issue linked to this feature request' };
        }

        // Fetch issue details from GitHub
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        const issueDetails = await adapter.getIssueDetails(featureRequest.githubIssueNumber);

        if (!issueDetails) {
            return { error: 'Failed to fetch GitHub issue details' };
        }

        // Fetch issue comments to extract artifacts
        const comments = await adapter.getIssueComments(featureRequest.githubIssueNumber);

        // Convert to GitHubComment format expected by parseArtifactComment
        const githubComments: GitHubComment[] = comments.map(c => ({
            id: c.id,
            body: c.body,
            author: c.author,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        }));

        // Parse artifact comment
        const parsedArtifact = parseArtifactComment(githubComments);
        const config = getProjectConfig();
        const artifacts = convertToIssueArtifacts(parsedArtifact, config);

        // Return only the fields we need (excluding linkedPullRequests from adapter)
        return {
            issueDetails: {
                number: issueDetails.number,
                title: issueDetails.title,
                body: issueDetails.body,
                url: issueDetails.url,
                state: issueDetails.state,
                artifacts,
            },
        };
    } catch (error: unknown) {
        console.error('Get GitHub issue details error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get GitHub issue details' };
    }
};
