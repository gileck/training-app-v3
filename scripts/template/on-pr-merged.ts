#!/usr/bin/env tsx
/**
 * On PR Merged - Handle Phase Transitions
 *
 * This script is triggered by GitHub Actions when a PR is merged.
 * It handles all PR merge events including multi-phase transitions.
 *
 * What it does:
 * 1. Extracts issue number from PR body ("Closes #X" or "Part of #X")
 * 2. Finds the corresponding project item
 * 3. Posts a status comment on the issue
 * 4. Updates project status based on phase:
 *
 * For multi-phase features (L/XL):
 * - Mid-phase merge: Increments phase counter (1/3 → 2/3), returns to Implementation
 * - Final phase merge: Clears phase, marks as Done
 *
 * For single-phase features:
 * - Marks as Done immediately
 *
 * Status Comments Posted:
 * - Mid-phase: "✅ Phase X/Y complete - Merged PR #Z. Starting Phase X+1..."
 * - Final phase: "✅ Phase X/X complete - All phases done!"
 * - Single-phase: "✅ Merged PR #Z - Issue complete!"
 */

import '../../src/agents/shared/loadEnv';
import { getProjectManagementAdapter } from '@/server/project-management';
import type { ProjectManagementAdapter } from '@/server/project-management/types';
import { STATUSES } from '@/server/project-management/config';
import { sendNotificationToOwner } from '@/server/telegram';
import { appConfig } from '@/app.config';
import { findByGitHubIssueNumber as findFeatureByIssue, updateFeatureRequestStatus } from '@/server/database/collections/template/feature-requests';
import { findByGitHubIssueNumber as findReportByIssue, updateReport } from '@/server/database/collections/template/reports';
import { parsePhaseString } from '../../src/agents/lib/parsing';
import {
    updateDesignArtifact,
    getDesignDocLink,
    hasPhaseComment,
    updateImplementationPhaseArtifact,
    initializeImplementationPhases,
} from '../../src/agents/lib';
import { getArtifactsFromIssue, saveDesignArtifactToDB, savePhaseStatusToDB, savePhasesToDB } from '../../src/agents/lib/workflow-db';
import { readDesignDoc } from '../../src/agents/lib/design-files';
import { formatPhasesToComment, parsePhasesFromMarkdown } from '../../src/agents/lib/phases';

/**
 * Handle design PR merged event
 *
 * NOTE: Status updates are handled by Telegram webhook (primary flow).
 * This function only handles idempotent backup operations:
 * 1. Update artifact comment on issue
 * 2. For tech design PRs with phases, post phases comment on issue (if not exists)
 *
 * Status is NOT updated here to avoid conflicts with Telegram webhook.
 */
async function handleDesignPRMerged(
    adapter: ProjectManagementAdapter,
    prNumber: number,
    prTitle: string,
    issueNumber: number,
    designType: 'product-dev' | 'product' | 'tech'
): Promise<void> {
    const designLabel = designType === 'product-dev'
        ? 'Product Development'
        : designType === 'product'
            ? 'Product Design'
            : 'Technical Design';

    console.log(`\n📄 Processing ${designLabel} PR merge...`);

    // 1. Update artifact comment on issue
    console.log(`  Updating artifact comment on issue #${issueNumber}...`);
    const artifactType: 'product-dev' | 'product-design' | 'tech-design' = designType === 'product-dev'
        ? 'product-dev'
        : designType === 'product'
            ? 'product-design'
            : 'tech-design';
    const designArtifact = {
        type: artifactType,
        path: getDesignDocLink(issueNumber, designType),
        status: 'approved' as const,
        lastUpdated: new Date().toISOString().split('T')[0],
        prNumber,
    };
    await saveDesignArtifactToDB(issueNumber, designArtifact);
    await updateDesignArtifact(adapter, issueNumber, designArtifact);
    console.log('  Artifact comment updated');

    // 2. Find project item and advance status
    const items = await adapter.listItems({ limit: 100 });
    const item = items.find((i) => i.content?.type === 'Issue' && i.content.number === issueNumber);

    if (!item) {
        console.log(`  ⚠️ No project item found for issue #${issueNumber}`);
        return;
    }

    console.log(`  Found project item: ${item.id}`);
    console.log(`  Current status: ${item.status}`);
    console.log('  (Status update handled by Telegram webhook - skipping here)')

    // Delete the design branch after successful merge (idempotent - may already be deleted)
    try {
        const prDetails = await adapter.getPRDetails(prNumber);
        if (prDetails?.headBranch) {
            console.log(`  Cleaning up design branch: ${prDetails.headBranch}`);
            await adapter.deleteBranch(prDetails.headBranch);
        }
    } catch (error) {
        // Branch may already be deleted by Telegram webhook - that's fine
        console.log('  Branch already deleted or not found (skipping)');
    }

    // 3. For tech design PRs, check for phases and initialize in artifact comment
    if (designType === 'tech') {
        const techDesign = readDesignDoc(issueNumber, 'tech');
        if (techDesign) {
            const phases = parsePhasesFromMarkdown(techDesign);
            if (phases && phases.length >= 2) {
                // Check if phases comment already exists (idempotency)
                const comments = await adapter.getIssueComments(issueNumber);
                if (!hasPhaseComment(comments)) {
                    const phasesComment = formatPhasesToComment(phases);
                    await adapter.addIssueComment(issueNumber, phasesComment);
                    console.log(`  Posted phases comment (${phases.length} phases)`);
                } else {
                    console.log('  Phases comment already exists, skipping');
                }

                // Pre-populate all phases in artifact comment with "pending" status
                await savePhasesToDB(issueNumber, phases);
                await initializeImplementationPhases(
                    adapter,
                    issueNumber,
                    phases.map(p => ({ order: p.order, name: p.name }))
                );
            }
        }
    }

    // Status comment and Telegram notification handled by Telegram webhook

    console.log(`\n✅ ${designLabel} PR backup operations completed\n`);
}

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

    // Check for design PRs by title pattern
    // Format: "docs: product development for issue #123", "docs: product design for issue #123", or "docs: technical design for issue #123"
    const productDevMatch = prTitle.match(/^docs:\s*product\s+development\s+for\s+issue\s+#(\d+)/i);
    const productDesignMatch = prTitle.match(/^docs:\s*product\s+design\s+for\s+issue\s+#(\d+)/i);
    const techDesignMatch = prTitle.match(/^docs:\s*technical?\s+design\s+for\s+issue\s+#(\d+)/i);

    if (productDevMatch || productDesignMatch || techDesignMatch) {
        const issueNumber = parseInt((productDevMatch || productDesignMatch || techDesignMatch)![1], 10);
        const designType: 'product-dev' | 'product' | 'tech' = productDevMatch
            ? 'product-dev'
            : productDesignMatch
                ? 'product'
                : 'tech';
        const designLabel = designType === 'product-dev'
            ? 'Product Development'
            : designType === 'product'
                ? 'Product Design'
                : 'Technical';

        console.log(`\n📋 Detected ${designLabel} Design PR for issue #${issueNumber}`);

        // Initialize adapter
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        await handleDesignPRMerged(adapter, parseInt(prNumber), prTitle, issueNumber, designType);
        return;
    }

    // Extract issue number from PR body for implementation PRs
    // Looks for patterns like "Closes #123", "Fixes #123", "Resolves #123", "Part of #123"
    const closesMatch = prBody.match(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i);
    const partOfMatch = prBody.match(/part\s+of\s+#(\d+)/i);

    const issueMatch = closesMatch || partOfMatch;
    const isPartialPhase = !closesMatch && !!partOfMatch;

    if (!issueMatch) {
        console.log('No issue reference found in PR body (e.g., "Closes #123" or "Part of #123")');
        console.log('Skipping status update.');
        return;
    }

    const issueNumber = parseInt(issueMatch[1], 10);
    console.log(`Found issue reference: #${issueNumber}${isPartialPhase ? ' (partial - multi-phase)' : ''}`);

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

        // Check for multi-phase implementation
        const phase = await adapter.getImplementationPhase(item.id);
        const parsedPhase = parsePhaseString(phase);

        if (parsedPhase) {
            console.log(`📋 Multi-phase feature: Phase ${parsedPhase.current}/${parsedPhase.total}`);

            // Get phase name from DB-first artifact read
            const artifact = await getArtifactsFromIssue(adapter, issueNumber);
            const currentPhaseArtifact = artifact?.implementation?.phases?.find(
                p => p.phase === parsedPhase.current
            );
            const phaseName = currentPhaseArtifact?.name || `Phase ${parsedPhase.current}`;

            // Update artifact comment to mark phase as merged
            try {
                await savePhaseStatusToDB(issueNumber, parsedPhase.current, 'merged', parseInt(prNumber, 10));
                await updateImplementationPhaseArtifact(
                    adapter,
                    issueNumber,
                    parsedPhase.current,
                    parsedPhase.total,
                    phaseName,
                    'merged',
                    parseInt(prNumber, 10)
                );
                console.log('  Updated artifact comment - phase marked as merged');
            } catch (error) {
                console.warn('  Warning: Failed to update artifact comment:', error instanceof Error ? error.message : String(error));
            }

            if (parsedPhase.current < parsedPhase.total) {
                // More phases to go - increment phase and return to Implementation
                const nextPhase = parsedPhase.current + 1;
                console.log(`\n🔄 Phase ${parsedPhase.current} complete, starting Phase ${nextPhase}...`);

                // Add status comment on issue
                const phaseCompleteComment = `✅ **Phase ${parsedPhase.current}/${parsedPhase.total}** complete - Merged PR #${prNumber}\n\n🔄 Starting Phase ${nextPhase}/${parsedPhase.total}...`;
                await adapter.addIssueComment(issueNumber, phaseCompleteComment);
                console.log(`  Phase completion comment added to issue`);

                // Update phase counter
                await adapter.setImplementationPhase(item.id, `${nextPhase}/${parsedPhase.total}`);
                console.log(`  Implementation Phase updated to: ${nextPhase}/${parsedPhase.total}`);

                // Return to Implementation status
                await adapter.updateItemStatus(item.id, STATUSES.implementation);
                console.log(`  Status updated to: ${STATUSES.implementation}`);

                // Clear review status for next phase
                if (adapter.hasReviewStatusField() && item.reviewStatus) {
                    await adapter.clearItemReviewStatus(item.id);
                    console.log('  Cleared review status');
                }

                // Delete the feature branch after successful phase merge
                const prDetails = await adapter.getPRDetails(parseInt(prNumber, 10));
                if (prDetails?.headBranch) {
                    console.log(`  Cleaning up feature branch: ${prDetails.headBranch}`);
                    await adapter.deleteBranch(prDetails.headBranch);
                }

                // Send notification for phase completion
                if (appConfig.ownerTelegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
                    const repoUrl = `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}`;
                    const prUrl = `${repoUrl}/pull/${prNumber}`;
                    const issueUrl = `${repoUrl}/issues/${issueNumber}`;

                    const escapeHtml = (text: string) =>
                        text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                    const message = `<b>Agent (Multi-PR):</b> ✅ Phase ${parsedPhase.current}/${parsedPhase.total} merged

📋 ${escapeHtml(prTitle.replace(/ \(Phase \d+\/\d+\)/, ''))}
🔗 Issue #${issueNumber}
🔀 PR #${prNumber} merged by ${mergedBy}

Starting Phase ${nextPhase}/${parsedPhase.total}...
Run <code>yarn agent:implement</code> to continue.`;

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

                console.log(`\n✅ Ready for Phase ${nextPhase}\n`);
                return;
            }

            // All phases complete - clear phase field and proceed to Done
            console.log(`\n🎉 All ${parsedPhase.total} phases complete!`);

            // Add final phase completion comment
            const allPhasesCompleteComment = `✅ **Phase ${parsedPhase.current}/${parsedPhase.total}** complete - Merged PR #${prNumber}\n\n🎉 **All ${parsedPhase.total} phases complete!** Issue is now Done.`;
            await adapter.addIssueComment(issueNumber, allPhasesCompleteComment);
            console.log('  Final phase completion comment added to issue');

            await adapter.clearImplementationPhase(item.id);
            console.log('  Cleared Implementation Phase field');
        } else {
            // Single-phase feature - update artifact comment and add completion comment
            try {
                // Use Phase 1/1 format for consistency
                await savePhaseStatusToDB(issueNumber, 1, 'merged', parseInt(prNumber, 10));
                await updateImplementationPhaseArtifact(
                    adapter,
                    issueNumber,
                    1,
                    1,
                    '', // No name for single-phase
                    'merged',
                    parseInt(prNumber, 10)
                );
                console.log('  Updated artifact comment - implementation marked as merged');
            } catch (error) {
                console.warn('  Warning: Failed to update artifact comment:', error instanceof Error ? error.message : String(error));
            }

            const completionComment = `✅ Merged PR #${prNumber} - Issue complete!`;
            await adapter.addIssueComment(issueNumber, completionComment);
            console.log('  Completion comment added to issue');
        }

        // Update GitHub Project status to Done
        console.log(`Updating GitHub Project status to: ${STATUSES.done}`);
        await adapter.updateItemStatus(item.id, STATUSES.done);
        console.log('✅ GitHub Project status updated');

        // Clear review status
        if (adapter.hasReviewStatusField() && item.reviewStatus) {
            await adapter.clearItemReviewStatus(item.id);
            console.log('Cleared review status');
        }

        // Delete the feature branch after successful merge
        const prDetails = await adapter.getPRDetails(parseInt(prNumber, 10));
        if (prDetails?.headBranch) {
            console.log(`\nCleaning up feature branch: ${prDetails.headBranch}`);
            await adapter.deleteBranch(prDetails.headBranch);
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

            const allPhasesMessage = parsedPhase
                ? `\n\n🎉 All ${parsedPhase.total} phases completed!`
                : '';

            const message = `<b>Agent (Auto-Complete):</b> 🎉 Issue Completed

📋 ${escapeHtml(prTitle.replace(/ \(Phase \d+\/\d+\)/, ''))}
🔗 Issue #${issueNumber} → Done
🔀 PR #${prNumber} merged by ${mergedBy}

Status automatically updated on PR merge.${allPhasesMessage}`;

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
