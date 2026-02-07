#!/usr/bin/env npx tsx
/**
 * E2E Test: Agent Decision System (Bug Investigation → Fix Selection → Routing)
 *
 * Tests the full flow:
 * 1. Creates a test bug report via CLI (MongoDB + GitHub + Bug Investigation status)
 * 2. Runs the bug investigator agent
 * 3. Verifies investigation comment posted + review status set
 * 4. Admin selects a fix option (manually via Telegram, or simulated)
 * 5. Verifies final routing state
 *
 * Usage:
 *   npx tsx src/agents/tests/agent-decision-e2e.test.ts
 *   npx tsx src/agents/tests/agent-decision-e2e.test.ts --simulate-telegram-buttons
 *   npx tsx src/agents/tests/agent-decision-e2e.test.ts --skip-agent
 *   npx tsx src/agents/tests/agent-decision-e2e.test.ts --skip-agent --simulate-telegram-buttons
 *   npx tsx src/agents/tests/agent-decision-e2e.test.ts --no-cleanup
 *
 * Options:
 *   --simulate-telegram-buttons  Auto-select the recommended fix option (no manual Telegram interaction)
 *   --skip-agent                 Skip running the bug investigator (assumes it already ran)
 *   --no-cleanup                 Skip cleanup (leave the test issue open for inspection)
 */

import '../../agents/shared/loadEnv';
import { spawn } from 'child_process';
import { getProjectManagementAdapter, STATUSES, REVIEW_STATUSES } from '@/server/project-management';
import {
    generateDecisionToken,
    isDecisionComment,
    parseDecision,
} from '@/apis/template/agent-decision/utils';
import { submitDecision } from '@/apis/template/agent-decision/handlers/submitDecision';

// ============================================================
// CONFIG
// ============================================================

const POLL_INTERVAL_MS = 5000;        // 5 seconds between polls
const MAX_POLL_DURATION_MS = 600000;  // 10 minutes max wait for admin action
const AGENT_TIMEOUT_SECONDS = 300;    // 5 minutes for bug investigator

const TEST_BUG_TITLE = '[E2E Test] Agent Decision Flow';
const TEST_BUG_DESCRIPTION = `Automated E2E test for the agent decision system.

## Steps to Reproduce
1. Navigate to the settings page
2. Toggle the theme to dark mode
3. Refresh the page

## Expected Behavior
Dark theme should persist after page refresh.

## Actual Behavior
Theme reverts to light mode on refresh.`;

// ============================================================
// HELPERS
// ============================================================

function log(msg: string): void {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`);
}

function logSection(title: string): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'='.repeat(60)}`);
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a CLI command and stream output, return exit code + captured output
 */
function runCommand(command: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const proc = spawn(command, args, {
            cwd: process.cwd(),
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data: Buffer) => {
            const text = data.toString();
            stdout += text;
            process.stdout.write(text);
        });

        proc.stderr?.on('data', (data: Buffer) => {
            const text = data.toString();
            stderr += text;
            process.stderr.write(text);
        });

        proc.on('close', (code) => {
            resolve({ code: code ?? 1, stdout, stderr });
        });

        proc.on('error', (error) => {
            resolve({ code: 1, stdout, stderr: error.message });
        });
    });
}

// ============================================================
// TEST STEPS
// ============================================================

interface TestContext {
    issueNumber?: number;
    issueUrl?: string;
    projectItemId?: string;
    decisionUrl?: string;
    finalStatus?: string;
    finalReviewStatus?: string | null;
}

/**
 * Step 1: Create test bug via CLI (handles MongoDB + GitHub sync + routing to Bug Investigation)
 */
async function createTestBugViaCLI(): Promise<{ issueNumber: number; issueUrl: string; projectItemId: string }> {
    logSection('Step 1: Create Test Bug via CLI');

    log('Running: yarn agent-workflow create --type bug --auto-approve ...');
    log('');

    const result = await runCommand('yarn', [
        'agent-workflow', 'create',
        '--type', 'bug',
        '--title', TEST_BUG_TITLE,
        '--description', TEST_BUG_DESCRIPTION,
        '--auto-approve',
    ]);

    if (result.code !== 0) {
        throw new Error(`CLI create failed with exit code ${result.code}`);
    }

    // Extract issue number and URL from CLI output
    const issueNumberMatch = result.stdout.match(/GitHub issue created: #(\d+)/);
    const issueUrlMatch = result.stdout.match(/URL: (https:\/\/github\.com\/[^\s]+)/);

    if (!issueNumberMatch) {
        throw new Error('Could not extract issue number from CLI output');
    }

    const issueNumber = parseInt(issueNumberMatch[1], 10);
    const issueUrl = issueUrlMatch?.[1] || `https://github.com/issues/${issueNumber}`;

    // Find the project item ID for this issue
    const adapter = getProjectManagementAdapter();
    await adapter.init();

    const items = await adapter.listItems({ status: STATUSES.bugInvestigation });
    const item = items.find(i =>
        i.content?.type === 'Issue' && i.content.number === issueNumber
    );

    if (!item) {
        throw new Error(`Could not find project item for issue #${issueNumber} in Bug Investigation`);
    }

    log(`\nIssue #${issueNumber} created and routed to Bug Investigation`);
    log(`Project item ID: ${item.id}`);

    return { issueNumber, issueUrl, projectItemId: item.id };
}

/**
 * Step 2: Verify item is in the expected initial state
 */
async function verifyInitialStatus(projectItemId: string): Promise<void> {
    logSection('Step 2: Verify Initial Status');

    const adapter = getProjectManagementAdapter();
    await adapter.init();

    const item = await adapter.getItem(projectItemId);
    if (!item) {
        throw new Error(`Project item not found: ${projectItemId}`);
    }

    log(`Status: ${item.status}`);
    log(`Review Status: ${item.reviewStatus || '(empty)'}`);

    if (item.status !== STATUSES.bugInvestigation) {
        throw new Error(`Expected status "${STATUSES.bugInvestigation}", got "${item.status}"`);
    }

    if (item.reviewStatus) {
        log('Warning: Review status is not empty, clearing it...');
        await adapter.updateItemReviewStatus(projectItemId, '');
    }

    log('Initial status verified');
}

/**
 * Step 3: Run the bug investigator agent
 */
async function runBugInvestigator(projectItemId: string): Promise<void> {
    logSection('Step 3: Run Bug Investigator Agent');

    log(`Running: yarn github-workflows-agent --bug-investigator --id ${projectItemId} --stream`);
    log('(This may take a few minutes...)\n');

    const result = await runCommand('yarn', [
        'github-workflows-agent',
        '--bug-investigator',
        '--id', projectItemId,
        '--stream',
        '--skip-pull',
        '--timeout', String(AGENT_TIMEOUT_SECONDS),
    ]);

    if (result.code !== 0) {
        throw new Error(`Bug investigator agent failed with exit code ${result.code}`);
    }

    log('\nBug investigator agent completed');
}

/**
 * Step 4: Verify investigation results (comment posted, review status set)
 */
async function verifyInvestigation(projectItemId: string, issueNumber: number): Promise<string> {
    logSection('Step 4: Verify Investigation Results');

    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Check item status
    const item = await adapter.getItem(projectItemId);
    if (!item) {
        throw new Error(`Project item not found: ${projectItemId}`);
    }

    log(`Status: ${item.status}`);
    log(`Review Status: ${item.reviewStatus || '(empty)'}`);

    if (item.reviewStatus !== REVIEW_STATUSES.waitingForReview) {
        throw new Error(`Expected review status "${REVIEW_STATUSES.waitingForReview}", got "${item.reviewStatus}"`);
    }

    // Check for decision comment on the issue
    const comments = await adapter.getIssueComments(issueNumber);
    const decisionComment = comments.find(c => isDecisionComment(c.body));

    if (!decisionComment) {
        throw new Error('No agent decision comment found on the issue');
    }

    log(`Decision comment found (${decisionComment.body.length} chars)`);

    // Generate decision URL
    const token = generateDecisionToken(issueNumber);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    const decisionUrl = `${baseUrl}/decision/${issueNumber}?token=${token}`;

    log(`Decision URL: ${decisionUrl}`);

    return decisionUrl;
}

/**
 * Step 5a (simulated): Auto-select the recommended option via submitDecision handler
 *
 * This simulates the full "Choose Option" flow:
 * 1. Parses the decision comment from the GitHub issue (same as the Decision UI)
 * 2. Picks the recommended option (or first option if none recommended)
 * 3. Calls submitDecision handler directly (same handler the Decision UI calls)
 */
async function simulateDecisionSubmission(issueNumber: number): Promise<{
    finalStatus: string;
    finalReviewStatus: string | null;
}> {
    logSection('Step 5: Simulate Decision Submission');

    log('Simulating "Choose Option" → select recommended → submit...');

    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Find the decision comment (same as Decision UI's getDecision handler)
    const comments = await adapter.getIssueComments(issueNumber);
    let decisionCommentBody: string | null = null;
    for (let i = comments.length - 1; i >= 0; i--) {
        if (isDecisionComment(comments[i].body)) {
            decisionCommentBody = comments[i].body;
            break;
        }
    }

    if (!decisionCommentBody) {
        throw new Error('No decision comment found on the issue');
    }

    // Parse decision to find options (same as Decision UI)
    const issueDetails = await adapter.getIssueDetails(issueNumber);
    const decision = parseDecision(
        decisionCommentBody,
        issueNumber,
        issueDetails?.title || `Issue #${issueNumber}`
    );

    if (!decision || decision.options.length === 0) {
        throw new Error('Could not parse decision or no options found');
    }

    log(`Found ${decision.options.length} option(s):`);
    for (const opt of decision.options) {
        const recommended = opt.isRecommended ? ' (recommended)' : '';
        const dest = typeof opt.metadata['destination'] === 'string' ? opt.metadata['destination'] : 'unknown';
        log(`  - ${opt.id}: ${opt.title} [${dest}]${recommended}`);
    }

    // Pick the recommended option, or fall back to first
    const selectedOption = decision.options.find(o => o.isRecommended) || decision.options[0];
    log(`\nSelecting: ${selectedOption.id} - "${selectedOption.title}"`);

    // Call submitDecision handler directly (same as Decision UI's submit button)
    const token = generateDecisionToken(issueNumber);
    const result = await submitDecision({
        issueNumber,
        token,
        selection: {
            selectedOptionId: selectedOption.id,
            notes: '[E2E Test] Auto-selected by --simulate-telegram-buttons',
        },
    });

    if (result.error) {
        throw new Error(`submitDecision failed: ${result.error}`);
    }

    log(`Decision submitted successfully`);
    if (result.routedTo) {
        log(`Routed to: ${result.routedTo}`);
    }

    // Read back the final state
    const allItems = await adapter.listItems();
    const item = allItems.find(i =>
        i.content?.type === 'Issue' && i.content.number === issueNumber
    );

    if (!item) {
        throw new Error('Project item not found after submission');
    }

    return {
        finalStatus: item.status!,
        finalReviewStatus: item.reviewStatus,
    };
}

/**
 * Step 5b (manual): Wait for admin to select a fix option via Telegram/Decision UI
 */
async function waitForAdminDecision(projectItemId: string): Promise<{
    finalStatus: string;
    finalReviewStatus: string | null;
}> {
    logSection('Step 5: Wait for Admin Decision');

    log('Waiting for you to:');
    log('  1. Click "Choose Option" in the Telegram notification');
    log('  2. Select a fix option in the Decision UI');
    log('  3. Click "Submit Selection"');
    log('');
    log(`Polling every ${POLL_INTERVAL_MS / 1000}s for up to ${MAX_POLL_DURATION_MS / 60000} minutes...`);
    log('');

    const adapter = getProjectManagementAdapter();
    await adapter.init();

    const startTime = Date.now();
    let lastReviewStatus: string = REVIEW_STATUSES.waitingForReview;

    while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
        const item = await adapter.getItem(projectItemId);
        if (!item) {
            throw new Error('Project item disappeared during polling');
        }

        const currentStatus = item.status || '';
        const currentReviewStatus = item.reviewStatus || '';

        // Check if status changed from Bug Investigation (item was routed)
        if (currentStatus !== STATUSES.bugInvestigation) {
            process.stdout.write('\n');
            log(`Status changed: "${STATUSES.bugInvestigation}" -> "${currentStatus}"`);
            log(`Review Status: "${currentReviewStatus || '(empty)'}"`);
            return {
                finalStatus: currentStatus!,
                finalReviewStatus: item.reviewStatus,
            };
        }

        // Log intermediate review status changes
        if (currentReviewStatus !== lastReviewStatus) {
            process.stdout.write('\n');
            log(`Review status changed: "${lastReviewStatus}" -> "${currentReviewStatus || '(empty)'}"`);
            lastReviewStatus = currentReviewStatus;
        }

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(`\r  Polling... (${elapsed}s elapsed)`);

        await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(`Timed out waiting for admin decision after ${MAX_POLL_DURATION_MS / 60000} minutes`);
}

/**
 * Cleanup: Close the GitHub issue and move to Done
 */
async function cleanup(issueNumber: number, projectItemId: string): Promise<void> {
    logSection('Cleanup');

    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Move item to Done status
    try {
        await adapter.updateItemStatus(projectItemId, STATUSES.done);
        log(`Project item moved to "${STATUSES.done}"`);
    } catch (error) {
        log(`Warning: Could not move item to Done: ${error instanceof Error ? error.message : error}`);
    }

    // Close the GitHub issue via gh CLI
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    if (owner && repo) {
        const result = await runCommand('gh', [
            'issue', 'close', String(issueNumber),
            '--repo', `${owner}/${repo}`,
            '--comment', '[E2E Test] Closing test issue after automated test run.',
        ]);
        if (result.code === 0) {
            log(`GitHub issue #${issueNumber} closed`);
        } else {
            log(`Warning: Could not close issue #${issueNumber} via gh CLI`);
        }
    } else {
        log('Warning: GITHUB_OWNER/GITHUB_REPO not set, skipping issue close');
    }

    log('Cleanup complete');
}

/**
 * Step 6: Verify final state after routing
 */
function verifyFinalState(finalStatus: string, finalReviewStatus: string | null): void {
    logSection('Step 6: Verify Final State');

    const validDestinations = [STATUSES.implementation, STATUSES.techDesign];

    log(`Final Status: ${finalStatus}`);
    log(`Final Review Status: ${finalReviewStatus || '(empty)'}`);

    if (!validDestinations.includes(finalStatus as typeof validDestinations[number])) {
        log(`WARNING: Unexpected destination "${finalStatus}"`);
        log(`Expected one of: ${validDestinations.join(', ')}`);
    } else {
        log(`Correctly routed to: ${finalStatus}`);
    }

    if (finalReviewStatus) {
        log(`WARNING: Review status should be empty after routing, got "${finalReviewStatus}"`);
    } else {
        log('Review status correctly cleared');
    }
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const skipAgent = args.includes('--skip-agent');
    const simulateButtons = args.includes('--simulate-telegram-buttons');
    const noCleanup = args.includes('--no-cleanup');

    console.log('\n========================================');
    console.log('  Agent Decision E2E Test');
    console.log('  (Bug Investigation -> Fix Selection)');
    console.log('========================================');
    if (simulateButtons) {
        console.log('  Mode: SIMULATED (auto-selects recommended option)');
    } else {
        console.log('  Mode: MANUAL (waiting for Telegram interaction)');
    }
    console.log('');

    const ctx: TestContext = {};

    try {
        // Step 1: Create test bug via CLI
        const { issueNumber, issueUrl, projectItemId } = await createTestBugViaCLI();
        ctx.issueNumber = issueNumber;
        ctx.issueUrl = issueUrl;
        ctx.projectItemId = projectItemId;

        // Step 2: Verify initial status
        await verifyInitialStatus(projectItemId);

        // Step 3: Run bug investigator (unless skipped)
        if (skipAgent) {
            log('\n--skip-agent flag set, skipping bug investigator agent run');
        } else {
            await runBugInvestigator(projectItemId);
        }

        // Step 4: Verify investigation
        const decisionUrl = await verifyInvestigation(projectItemId, issueNumber);
        ctx.decisionUrl = decisionUrl;

        // Step 5: Get decision (simulated or manual)
        let finalStatus: string;
        let finalReviewStatus: string | null;

        if (simulateButtons) {
            // Simulate: parse decision comment, pick recommended option, call submitDecision
            ({ finalStatus, finalReviewStatus } = await simulateDecisionSubmission(issueNumber));
        } else {
            // Manual: print URL and poll until admin acts
            log('\n========================================');
            log('  ACTION REQUIRED: Select a fix option');
            log('========================================');
            log(`\n  Decision URL: ${decisionUrl}`);
            log(`  Issue: ${issueUrl}`);
            log('  Check your Telegram for the notification.\n');

            ({ finalStatus, finalReviewStatus } = await waitForAdminDecision(projectItemId));
        }

        ctx.finalStatus = finalStatus;
        ctx.finalReviewStatus = finalReviewStatus;

        // Step 6: Verify final state
        verifyFinalState(finalStatus, finalReviewStatus);

        // Cleanup
        if (!noCleanup && ctx.issueNumber && ctx.projectItemId) {
            await cleanup(ctx.issueNumber, ctx.projectItemId);
        } else if (noCleanup) {
            log('\n--no-cleanup flag set, leaving test issue open');
        }

        // Summary
        logSection('Test Complete');
        log(`GitHub Issue: #${ctx.issueNumber} (${ctx.issueUrl})`);
        log(`Project Item: ${ctx.projectItemId}`);
        log(`Decision URL: ${ctx.decisionUrl}`);
        log(`Final Routing: ${ctx.finalStatus}`);
        log('');
        log('RESULT: PASS');

    } catch (error) {
        // Attempt cleanup even on failure
        if (!noCleanup && ctx.issueNumber && ctx.projectItemId) {
            try {
                await cleanup(ctx.issueNumber, ctx.projectItemId);
            } catch (cleanupError) {
                log(`Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : cleanupError}`);
            }
        }

        logSection('Test Failed');
        const message = error instanceof Error ? error.message : String(error);
        log(`ERROR: ${message}`);

        if (ctx.issueNumber) {
            log(`\nTest artifacts:`);
            log(`  GitHub Issue: #${ctx.issueNumber} (${ctx.issueUrl})`);
            log(`  Project Item: ${ctx.projectItemId}`);
        }

        log('\nRESULT: FAIL');
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\nInterrupted. Test artifacts may need manual cleanup.');
    process.exit(1);
});

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
