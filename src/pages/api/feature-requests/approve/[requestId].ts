/* eslint-disable restrict-api-routes/no-direct-api-routes */
// This endpoint must be a direct API route because it returns HTML for Telegram approval links
import type { NextApiRequest, NextApiResponse } from 'next';
import { featureRequests } from '@/server/database';
import { approveFeatureRequest } from '@/server/github-sync';

/**
 * Public API endpoint for approving feature requests via Telegram link.
 *
 * This endpoint:
 * 1. Verifies the approval token matches the stored token
 * 2. Approves the feature request (updates status + creates GitHub issue)
 * 3. Returns a simple HTML response (since this is clicked from Telegram)
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
        // Fetch the feature request
        const request = await featureRequests.findFeatureRequestById(requestId);

        if (!request) {
            return sendHtmlResponse(res, 404, 'Not Found', 'Feature request not found');
        }

        // Verify the token
        if (!request.approvalToken || request.approvalToken !== token) {
            return sendHtmlResponse(res, 403, 'Invalid Token', 'The approval link is invalid or has expired');
        }

        // Check if already approved
        if (request.githubIssueUrl) {
            return sendHtmlResponse(
                res,
                200,
                'Already Approved',
                `This feature request has already been approved.\n\nGitHub Issue: ${request.githubIssueUrl}`,
                request.githubIssueUrl
            );
        }

        // Approve the request
        const result = await approveFeatureRequest(requestId);

        if (!result.success) {
            return sendHtmlResponse(res, 500, 'Error', result.error || 'Failed to approve feature request');
        }

        // Clear the approval token (one-time use)
        await featureRequests.updateApprovalToken(requestId, null);

        // Success response
        const issueUrl = result.githubResult?.issueUrl;
        return sendHtmlResponse(
            res,
            200,
            'Approved!',
            `Feature request "${request.title}" has been approved and a GitHub issue has been created.`,
            issueUrl
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
