#!/usr/bin/env tsx
/**
 * Mark Issue as Done on PR Merge
 *
 * This script is triggered by GitHub Actions when a PR is merged.
 * It extracts the issue number from the PR body, finds the corresponding
 * project item, and updates its status to "Done".
 */

import '../src/agents/shared/loadEnv';
import { getProjectManagementAdapter } from '@/server/project-management';
import { STATUSES } from '@/server/project-management/config';
import { sendNotificationToOwner } from '@/server/telegram';
import { appConfig } from '@/app.config';
import { findByGitHubIssueNumber as findFeatureByIssue, updateFeatureRequestStatus } from '@/server/database/collections/feature-requests';
import { findByGitHubIssueNumber as findReportByIssue, updateReport } from '@/server/database/collections/reports';

async function main() {
    const prNumber = process.env.PR_NUMBER;
    const prBody = process.env.PR_BODY || '';
    const prTitle = process.env.PR_TITLE || '';
    const mergedBy = process.env.MERGED_BY || 'unknown';

    if (!prNumber) {
        console.error('Error: PR_NUMBER environment variable not set');
        process.exit(1);
    }

    console.log(`\nProcessing merged PR #${prNumber}`);
    console.log(`Title: ${prTitle}`);
    console.log(`Merged by: ${mergedBy}`);

    // Extract issue number from PR body
    // Looks for patterns like "Closes #123", "Fixes #123", "Resolves #123"
    const issueMatch = prBody.match(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i);

    if (!issueMatch) {
        console.log('No issue reference found in PR body (e.g., "Closes #123")');
        console.log('Skipping status update.');
        return;
    }

    const issueNumber = parseInt(issueMatch[1], 10);
    console.log(`Found issue reference: #${issueNumber}`);

    try {
        // Initialize project management adapter
        console.log('\nConnecting to GitHub...');
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Find the project item for this issue
        console.log(`Finding project item for issue #${issueNumber}...`);
        const items = await adapter.listItems({ limit: 100 });
        const item = items.find((i) => i.content?.type === 'Issue' && i.content.number === issueNumber);

        if (!item) {
            console.log(`No project item found for issue #${issueNumber}`);
            console.log('The issue may not be added to the project.');
            return;
        }

        console.log(`Found project item: ${item.id}`);
        console.log(`Current status: ${item.status}`);

        // Check if already done
        if (item.status === STATUSES.done) {
            console.log('Item is already marked as Done. No update needed.');
            return;
        }

        // Update GitHub Project status to Done
        console.log(`Updating GitHub Project status to: ${STATUSES.done}`);
        await adapter.updateItemStatus(item.id, STATUSES.done);
        console.log('✅ GitHub Project status updated');

        // Clear review status
        if (adapter.hasReviewStatusField() && item.reviewStatus) {
            await adapter.updateItemReviewStatus(item.id, '');
            console.log('Cleared review status');
        }

        // Update feature request OR bug report in MongoDB
        console.log('\nUpdating database...');
        const featureRequest = await findFeatureByIssue(issueNumber);
        if (featureRequest) {
            await updateFeatureRequestStatus(featureRequest._id, 'done');
            console.log('✅ Feature request marked as done in database');
        } else {
            // Try bug reports collection
            const bugReport = await findReportByIssue(issueNumber);
            if (bugReport) {
                await updateReport(bugReport._id.toString(), { status: 'resolved' });
                console.log('✅ Bug report marked as resolved in database');
            } else {
                console.log('ℹ️ No feature request or bug report found for this issue');
            }
        }

        // Send Telegram notification
        if (appConfig.ownerTelegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const repoUrl = `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`;
            const prUrl = `${repoUrl}/pull/${prNumber}`;
            const issueUrl = `${repoUrl}/issues/${issueNumber}`;

            // Escape HTML special characters
            const escapeHtml = (text: string) =>
                text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            const message = `<b>Agent (Auto-Complete):</b> 🎉 Issue Completed

📋 ${escapeHtml(prTitle)}
🔗 Issue #${issueNumber} → Done
🔀 PR #${prNumber} merged by ${mergedBy}

Status automatically updated on PR merge.`;

            await sendNotificationToOwner(message, {
                parseMode: 'HTML',
                inlineKeyboard: [
                    [
                        { text: '📋 View Issue', url: issueUrl },
                        { text: '🔀 View PR', url: prUrl },
                    ],
                ],
            });
            console.log('Telegram notification sent');
        }

        console.log('\n✅ Done\n');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
