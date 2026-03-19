/**
 * Implementation Agent main flow.
 *
 * Handles CLI parsing, item collection, batch processing, and notifications.
 * This is the entry point orchestration extracted from index.ts.
 */

import {
    STATUSES,
    REVIEW_STATUSES,
    getProjectManagementAdapter,
    git,
    hasUncommittedChanges,
    getUncommittedChanges,
    notifyBatchComplete,
    createCLI,
} from '../../shared';
import type { ProcessableItem, ImplementOptions } from './types';

/** Type for the processItem function injected from index.ts to avoid circular imports. */
type ProcessItemFn = (
    processable: ProcessableItem,
    options: ImplementOptions,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    defaultBranch: string,
) => Promise<{ success: boolean; prNumber?: number; error?: string }>;

/**
 * Collect items to process based on CLI options and current project state.
 */
async function collectItems(
    options: ImplementOptions,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
): Promise<ProcessableItem[]> {
    const itemsToProcess: ProcessableItem[] = [];

    if (options.id) {
        // Process specific item
        const item = await adapter.getItem(options.id);
        if (!item) {
            console.error(`Item not found: ${options.id}`);
            process.exit(1);
        }

        // Determine mode based on current status and review status
        let mode: 'new' | 'feedback' | 'clarification';
        let prNumber: number | undefined;
        let branchName: string | undefined;

        if (item.status === STATUSES.implementation && !item.reviewStatus) {
            mode = 'new';
        } else if (
            (item.status === STATUSES.implementation || item.status === STATUSES.prReview) &&
            item.reviewStatus === REVIEW_STATUSES.requestChanges
        ) {
            mode = 'feedback';
            const openPR = await adapter.findOpenPRForIssue(item.content?.number || 0);
            if (openPR) {
                prNumber = openPR.prNumber;
                branchName = openPR.branchName;
            }
        } else if (item.status === STATUSES.implementation && item.reviewStatus === REVIEW_STATUSES.clarificationReceived) {
            mode = 'clarification';
        } else if (item.status === STATUSES.implementation && item.reviewStatus === REVIEW_STATUSES.waitingForClarification) {
            console.log('  \u23F3 Waiting for clarification from admin');
            console.log('  Skipping this item (admin needs to respond and click "Clarification Received")');
            process.exit(0);
        } else {
            console.error(`Item is not in a processable state.`);
            console.error(`  Status: ${item.status}`);
            console.error(`  Review Status: ${item.reviewStatus}`);
            console.error(`  Expected: "${STATUSES.implementation}" with empty Review Status, "${REVIEW_STATUSES.requestChanges}", or "${REVIEW_STATUSES.clarificationReceived}"`);
            process.exit(1);
        }

        itemsToProcess.push({ item, mode, prNumber, branchName });
    } else {
        // Flow A: Fetch items ready for implementation
        const allImplementationItems = await adapter.listItems({ status: STATUSES.implementation, limit: options.limit || 50 });
        const newItems = allImplementationItems.filter((item) => !item.reviewStatus);
        for (const item of newItems) {
            itemsToProcess.push({ item, mode: 'new' });
        }

        // Flow B: Fetch items needing revision
        if (adapter.hasReviewStatusField()) {
            const feedbackItems = allImplementationItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.requestChanges
            );
            for (const item of feedbackItems) {
                const openPR = await adapter.findOpenPRForIssue(item.content?.number || 0);
                if (openPR) {
                    itemsToProcess.push({
                        item,
                        mode: 'feedback',
                        prNumber: openPR.prNumber,
                        branchName: openPR.branchName,
                    });
                }
            }

            // Also fetch PR Review items with Request Changes
            const prReviewItems = await adapter.listItems({ status: STATUSES.prReview, limit: options.limit || 50 });
            const prFeedbackItems = prReviewItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.requestChanges
            );
            for (const item of prFeedbackItems) {
                const openPR = await adapter.findOpenPRForIssue(item.content?.number || 0);
                if (openPR) {
                    itemsToProcess.push({
                        item,
                        mode: 'feedback',
                        prNumber: openPR.prNumber,
                        branchName: openPR.branchName,
                    });
                }
            }

            // Flow C: Fetch items with clarification received
            const clarificationItems = allImplementationItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.clarificationReceived
            );
            for (const item of clarificationItems) {
                itemsToProcess.push({ item, mode: 'clarification' });
            }
        }

        // Apply limit
        if (options.limit && itemsToProcess.length > options.limit) {
            itemsToProcess.length = options.limit;
        }
    }

    return itemsToProcess;
}

/**
 * Create the main entry point for the implementation agent.
 * Returns an async function that parses CLI, collects items, and runs batch processing.
 *
 * @param processItem - The item processor function (injected to avoid circular imports)
 */
export function createMain(processItem: ProcessItemFn): () => Promise<void> {
    return async function main(): Promise<void> {
    const { options: baseOptions, extra } = createCLI({
        name: 'implement',
        displayName: 'Implementation Agent',
        description: 'Implement features and create PRs for GitHub Project items',
        additionalOptions: [
            { flag: '--skip-push', description: 'Skip pushing to remote (for testing)', defaultValue: false },
            { flag: '--skip-pull', description: 'Skip pulling latest changes from master', defaultValue: false },
            { flag: '--skip-local-test', description: 'Skip local testing with Playwright MCP', defaultValue: false },
        ],
    });
    const options: ImplementOptions = {
        ...baseOptions,
        skipPush: Boolean(extra.skipPush),
        skipPull: Boolean(extra.skipPull),
        skipLocalTest: Boolean(extra.skipLocalTest),
    };

    // Check for uncommitted changes before starting
    if (hasUncommittedChanges()) {
        console.error('Error: Uncommitted changes in working directory.');
        console.error('Please commit or stash your changes before running this agent.');
        console.error('Uncommitted files:\n' + getUncommittedChanges());
        process.exit(1);
    }

    // Get default branch and ensure we're on it
    let defaultBranch: string;
    try {
        defaultBranch = git('symbolic-ref refs/remotes/origin/HEAD --short', { silent: true }).replace('origin/', '');
        console.log(`Switching to ${defaultBranch}...`);
        git(`checkout ${defaultBranch}`, { silent: true });
        console.log(`  \u2705 On ${defaultBranch}`);
    } catch (error) {
        console.error('Error: Failed to checkout default branch.');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }

    // Pull latest (unless --skip-pull is specified)
    if (!options.skipPull) {
        console.log(`Pulling latest from ${defaultBranch}...`);
        try {
            git(`pull origin ${defaultBranch}`, { silent: true });
            console.log(`  \u2705 On latest ${defaultBranch}`);
        } catch (error) {
            console.error('Error: Failed to pull latest.');
            console.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    } else {
        console.log('\u26A0\uFE0F  Skipping git pull (--skip-pull specified)');
    }

    // Initialize project management adapter
    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Collect items to process
    const itemsToProcess = await collectItems(options, adapter);

    if (itemsToProcess.length === 0) {
        console.log('No items to process.');
        return;
    }

    console.log(`\nProcessing ${itemsToProcess.length} item(s)...`);

    // Track results
    const results = {
        processed: 0,
        succeeded: 0,
        failed: 0,
    };

    // Process each item
    for (const processable of itemsToProcess) {
        results.processed++;
        const { item } = processable;
        const title = item.content?.title || 'Unknown';

        console.log(`\n----------------------------------------`);
        console.log(`[${results.processed}/${itemsToProcess.length}] ${title}`);
        console.log(`  Item ID: ${item.id}`);
        console.log(`  Status: ${item.status}`);
        if (item.reviewStatus) {
            console.log(`  Review Status: ${item.reviewStatus}`);
        }

        const result = await processItem(processable, options, adapter, defaultBranch);

        if (result.success) {
            results.succeeded++;
            if (result.prNumber) {
                console.log(`  PR: #${result.prNumber}`);
            }
        } else {
            results.failed++;
            console.error(`  Failed: ${result.error}`);
        }
    }

    // Print summary
    console.log('\n========================================');
    console.log('  Summary');
    console.log('========================================');
    console.log(`  Processed: ${results.processed}`);
    console.log(`  Succeeded: ${results.succeeded}`);
    console.log(`  Failed: ${results.failed}`);
    console.log('========================================\n');

    // Send batch completion notification
    if (!options.dryRun && results.processed > 1) {
        await notifyBatchComplete('Implementation', results.processed, results.succeeded, results.failed);
    }
    };
}
