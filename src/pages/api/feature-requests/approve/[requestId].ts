/* eslint-disable restrict-api-routes/no-direct-api-routes */
// This endpoint must be a direct API route because it returns HTML for Telegram approval links
import type { NextApiRequest, NextApiResponse } from 'next';
import { featureRequests } from '@/server/database';
import { approveWorkflowItem } from '@/server/template/workflow-service';

/**
 * Public API endpoint for approving feature requests via Telegram link.
 *
 * This endpoint:
 * 1. Atomically claims the approval token (prevents race conditions)
 * 2. Verifies the claimed token matches the provided token
 * 3. Approves the feature request (updates status + creates GitHub issue)
 * 4. Returns a simple HTML response (since this is clicked from Telegram)
 *
 * GET /api/feature-requests/approve/[requestId]?token=[approvalToken]
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Only allow GET requests (for clickable links)
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { requestId, token } = req.query;

    // Validate parameters
    if (!requestId || typeof requestId !== 'string') {
        return sendHtmlResponse(res, 400, 'Error', 'Invalid request ID');
    }

    if (!token || typeof token !== 'string') {
        return sendHtmlResponse(res, 400, 'Error', 'Missing approval token');
    }

    try {
        // Atomically claim the approval token to prevent race conditions (TOCTOU vulnerability)
        // This is the key fix: claimApprovalToken uses findOneAndUpdate to atomically
        // find a document with a token and unset it in a single operation.
        // Only the first concurrent request will succeed; subsequent requests get null.
        const request = await featureRequests.claimApprovalToken(requestId);

        if (!request) {
            // Token was already claimed or doesn't exist - check if already approved
            const existingRequest = await featureRequests.findFeatureRequestById(requestId);
            if (existingRequest?.githubIssueUrl) {
                return sendHtmlResponse(
                    res,
                    200,
                    'Already Approved',
                    `This feature request has already been approved.\n\nGitHub Issue: ${existingRequest.githubIssueUrl}`,
                    existingRequest.githubIssueUrl
                );
            }
            // Either request doesn't exist or token was invalid/expired
            return sendHtmlResponse(res, 403, 'Invalid Token', 'The approval link is invalid or has expired');
        }

        // Verify the claimed token matches the one provided in the URL
        // (claimApprovalToken returns the document with the token BEFORE it was cleared)
        if (request.approvalToken !== token) {
            // Token mismatch - restore the original token since we incorrectly claimed it
            // We know approvalToken exists because claimApprovalToken only succeeds for docs with a token
            if (request.approvalToken) {
                await featureRequests.updateApprovalToken(requestId, request.approvalToken);
            }
            return sendHtmlResponse(res, 403, 'Invalid Token', 'The approval link is invalid or has expired');
        }

        // Approve the request using workflow service (handles GitHub sync, logging, routing, notifications)
        const result = await approveWorkflowItem({ id: requestId, type: 'feature' });

        if (!result.success) {
            // Restore the approval token so the user can retry
            if (request.approvalToken) {
                await featureRequests.updateApprovalToken(requestId, request.approvalToken);
            }
            return sendHtmlResponse(res, 500, 'Error', result.error || 'Failed to approve feature request');
        }

        // Success response (token was already cleared by claimApprovalToken)
        return sendHtmlResponse(
            res,
            200,
            'Approved!',
            `Feature request "${request.title}" has been approved and a GitHub issue has been created.`,
            result.issueUrl
        );
    } catch (error) {
        console.error('Approval endpoint error:', error);
        return sendHtmlResponse(res, 500, 'Error', 'An unexpected error occurred');
    }
}

/**
 * Send a simple HTML response (for display in browser after clicking Telegram link)
 */
function sendHtmlResponse(
    res: NextApiResponse,
    status: number,
    title: string,
    message: string,
    issueUrl?: string
) {
    const isSuccess = status === 200;
    const emoji = isSuccess ? '✅' : '❌';
    const color = isSuccess ? '#10b981' : '#ef4444';

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        .card {
            background: white;
            border-radius: 12px;
            padding: 32px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .emoji {
            font-size: 48px;
            margin-bottom: 16px;
        }
        h1 {
            color: ${color};
            margin: 0 0 16px;
            font-size: 24px;
        }
        p {
            color: #666;
            line-height: 1.6;
            margin: 0;
        }
        .link {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
        }
        .link:hover {
            background: #1d4ed8;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="emoji">${emoji}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        ${issueUrl ? `<a class="link" href="${issueUrl}" target="_blank">View GitHub Issue</a>` : ''}
    </div>
</body>
</html>
    `.trim();

    res.status(status).setHeader('Content-Type', 'text/html').send(html);
}
