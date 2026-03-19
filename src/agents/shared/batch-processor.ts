/**
 * Shared Batch Processor
 *
 * Handles item collection by status, mode detection (new/feedback/clarification),
 * the processing loop with progress logging, summary output, and batch notification.
 *
 * Used by all 6 core agents to replace ~150 lines of duplicated main() logic.
 */

import { REVIEW_STATUSES } from './config';
import { getProjectManagementAdapter, type ProjectItem } from '@/server/template/project-management';
import { notifyBatchComplete } from './notifications';
import { progress } from './console';
import type { CommonCLIOptions, UsageStats } from './types';

// ============================================================
// TYPES
// ============================================================

export type ProcessMode = 'new' | 'feedback' | 'clarification' | 'post-selection';

export interface ProcessableItem {
    item: ProjectItem;
    mode: ProcessMode;
    existingPR?: { prNumber: number; branchName: string };
}

export interface BatchConfig {
    /** The status this agent operates on (e.g., STATUSES.productDesign) */
    agentStatus: string;
    /** Human-readable agent name for logs (e.g., 'Product Design') */
    agentDisplayName: string;
    /** Whether to look up existing PRs for feedback items (default: true) */
    needsExistingPR?: boolean;
    /** Optional: skip items matching this predicate */
    skipItem?: (item: ProjectItem) => { skip: boolean; reason?: string };
    /** Optional: additional statuses to check for feedback items (e.g., implementAgent also checks prReview) */
    additionalFeedbackStatuses?: string[];
    /** Optional: extra filters to pass to listItems (e.g., { domainMissing: true }) */
    listOptions?: { domainMissing?: boolean };
}

export interface ProcessItemFn {
    (processable: ProcessableItem, options: CommonCLIOptions, adapter: Adapter): Promise<{ success: boolean; error?: string }>;
}

type Adapter = Awaited<ReturnType<typeof getProjectManagementAdapter>>;

// ============================================================
// MAIN ENTRY POINT
// ============================================================

/**
 * Collect items by status, determine modes, run the processing loop, print summary.
 * This replaces the bulk of each agent's main() function.
 */
export async function runBatch(
    config: BatchConfig,
    options: CommonCLIOptions,
    processItem: ProcessItemFn,
): Promise<void> {
    // Initialize project management adapter
    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Collect items to process
    const itemsToProcess: ProcessableItem[] = [];
    const needsExistingPR = config.needsExistingPR !== false; // default true

    if (options.id) {
        // Process specific item
        const item = await adapter.getItem(options.id);
        if (!item) {
            console.error(`Item not found: ${options.id}`);
            process.exit(1);
        }

        // Determine mode based on current status and review status
        let mode: ProcessMode;
        let existingPR: { prNumber: number; branchName: string } | undefined;

        if (item.status === config.agentStatus && !item.reviewStatus) {
            mode = 'new';
        } else if (item.status === config.agentStatus && item.reviewStatus === REVIEW_STATUSES.requestChanges) {
            mode = 'feedback';
            // Find existing PR for feedback mode
            if (needsExistingPR) {
                const issueNumber = item.content?.number;
                if (issueNumber) {
                    existingPR = await adapter.findOpenPRForIssue(issueNumber) || undefined;
                }
            }
        } else if (item.status === config.agentStatus && item.reviewStatus === REVIEW_STATUSES.clarificationReceived) {
            mode = 'clarification';
        } else if (item.status === config.agentStatus && item.reviewStatus === REVIEW_STATUSES.decisionSubmitted) {
            mode = 'post-selection';
            // Find existing PR for post-selection mode (branch exists from Phase 1)
            if (needsExistingPR) {
                const issueNumber = item.content?.number;
                if (issueNumber) {
                    existingPR = await adapter.findOpenPRForIssue(issueNumber) || undefined;
                }
            }
        } else if (item.status === config.agentStatus && item.reviewStatus === REVIEW_STATUSES.waitingForDecision) {
            console.log('  \u23F3 Waiting for admin decision');
            console.log('  Skipping this item (admin needs to select an option via the decision UI)');
            process.exit(0);
        } else if (item.status === config.agentStatus && item.reviewStatus === REVIEW_STATUSES.waitingForClarification) {
            console.log('  \u23F3 Waiting for clarification from admin');
            console.log('  Skipping this item (admin needs to respond and click "Clarification Received")');
            process.exit(0);
        } else {
            console.error(`Item is not in a processable state.`);
            console.error(`  Status: ${item.status}`);
            console.error(`  Review Status: ${item.reviewStatus}`);
            console.error(`  Expected: "${config.agentStatus}" with empty Review Status, "${REVIEW_STATUSES.requestChanges}", "${REVIEW_STATUSES.clarificationReceived}", or "${REVIEW_STATUSES.decisionSubmitted}"`);
            process.exit(1);
        }

        itemsToProcess.push({ item, mode, existingPR });
    } else {
        // Fetch all items in the agent's status
        const allItems = await adapter.listItems({ status: config.agentStatus, limit: options.limit || 50, ...config.listOptions });

        // Flow A: New items (empty Review Status)
        const newItems = allItems.filter((item) => !item.reviewStatus);
        for (const item of newItems) {
            itemsToProcess.push({ item, mode: 'new' });
        }

        // Flow B: Feedback items (Request Changes)
        if (adapter.hasReviewStatusField()) {
            const feedbackItems = allItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.requestChanges
            );
            for (const item of feedbackItems) {
                let existingPR: { prNumber: number; branchName: string } | undefined;
                if (needsExistingPR) {
                    const issueNumber = item.content?.number;
                    if (issueNumber) {
                        existingPR = await adapter.findOpenPRForIssue(issueNumber) || undefined;
                    }
                }
                itemsToProcess.push({ item, mode: 'feedback', existingPR });
            }

            // Flow C: Clarification received
            const clarificationItems = allItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.clarificationReceived
            );
            for (const item of clarificationItems) {
                itemsToProcess.push({ item, mode: 'clarification' });
            }

            // Flow D: Decision submitted (post-selection)
            const postSelectionItems = allItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.decisionSubmitted
            );
            for (const item of postSelectionItems) {
                let existingPR: { prNumber: number; branchName: string } | undefined;
                if (needsExistingPR) {
                    const issueNumber = item.content?.number;
                    if (issueNumber) {
                        existingPR = await adapter.findOpenPRForIssue(issueNumber) || undefined;
                    }
                }
                itemsToProcess.push({ item, mode: 'post-selection', existingPR });
            }
        }

        // Apply limit
        if (options.limit && itemsToProcess.length > options.limit) {
            itemsToProcess.length = options.limit;
        }
    }

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
        totalUsage: {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
            totalCostUSD: 0,
        } as UsageStats,
    };

    // Process each item
    for (const processable of itemsToProcess) {
        results.processed++;
        const { item } = processable;
        const title = item.content?.title || 'Unknown';

        console.log(`\n----------------------------------------`);
        console.log(`[${results.processed}/${itemsToProcess.length}] ${title}`);
        progress(`Item ID: ${item.id}`);
        progress(`Status: ${item.status}`);
        if (item.reviewStatus) {
            progress(`Review Status: ${item.reviewStatus}`);
        }

        // Check skip predicate
        if (config.skipItem) {
            const skipResult = config.skipItem(item);
            if (skipResult.skip) {
                results.failed++;
                console.log(`  Skipped: ${skipResult.reason || 'skipped'}`);
                continue;
            }
        }

        const result = await processItem(processable, options, adapter);

        if (result.success) {
            results.succeeded++;
        } else {
            results.failed++;
            console.error(`  Failed: ${result.error}`);
        }
    }

    // Print summary
    console.log('\n========================================');
    console.log('  Summary');
    console.log('========================================');
    progress(`Processed: ${results.processed}`);
    progress(`Succeeded: ${results.succeeded}`);
    progress(`Failed: ${results.failed}`);
    console.log('========================================\n');

    // Send batch completion notification
    if (!options.dryRun && results.processed > 1) {
        await notifyBatchComplete(config.agentDisplayName, results.processed, results.succeeded, results.failed);
    }
}
