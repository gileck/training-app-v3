#!/usr/bin/env tsx
/**
 * Auto-Advance Agent
 *
 * Automatically advances approved items to the next workflow phase.
 * This is simple JavaScript - no AI/Claude involved.
 *
 * Transitions:
 *   - Product Development (Approved) → Product Design
 *   - Product Design (Approved) → Technical Design
 *   - Technical Design (Approved) → Implementation
 *   - Implementation (Approved) → Done
 *
 * Usage:
 *   yarn agent:auto-advance              # Process all approved items
 *   yarn agent:auto-advance --dry-run    # Preview without changes
 */

import './shared/loadEnv';
import { Command } from 'commander';
import {
    STATUSES,
    REVIEW_STATUSES,
    getProjectManagementAdapter,
    agentConfig,
    type ProjectItem,
} from './shared';
import { notifyAutoAdvance } from './shared/notifications';

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Status transitions when Review Status = Approved
 */
const STATUS_TRANSITIONS: Record<string, string> = {
    [STATUSES.productDevelopment]: STATUSES.productDesign,
    [STATUSES.productDesign]: STATUSES.techDesign,
    [STATUSES.techDesign]: STATUSES.implementation,
    [STATUSES.implementation]: STATUSES.done,
};

// ============================================================
// MAIN LOGIC
// ============================================================

interface AdvanceResult {
    item: ProjectItem;
    fromStatus: string;
    toStatus: string;
    success: boolean;
    error?: string;
}

async function advanceItem(
    item: ProjectItem,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    dryRun: boolean
): Promise<AdvanceResult> {
    const fromStatus = item.status;
    const title = item.content?.title || `Item ${item.id}`;

    // Skip items without a status
    if (!fromStatus) {
        console.log(`  ⚠️  Skipped: "${title}" - Item has no status`);
        return {
            item,
            fromStatus: 'Unknown',
            toStatus: 'N/A',
            success: false,
            error: 'Item has no status',
        };
    }

    // PR Review items are handled by GitHub Action on PR merge, not auto-advance
    // The merge script (scripts/mark-issue-done.ts) handles phase transitions:
    // - If more phases remain: moves back to "Ready for development" with next phase
    // - If final phase: moves to "Done"
    if (fromStatus === STATUSES.prReview) {
        return {
            item,
            fromStatus,
            toStatus: 'N/A',
            success: false,
            error: 'PR Review handled by GitHub Action on merge',
        };
    }

    const toStatus = STATUS_TRANSITIONS[fromStatus];

    if (!toStatus) {
        console.log(`  ⚠️  Skipped: "${title}" - No transition defined for status: ${fromStatus}`);
        return {
            item,
            fromStatus,
            toStatus: 'N/A',
            success: false,
            error: `No transition defined for status: ${fromStatus}`,
        };
    }

    if (dryRun) {
        console.log(`  [DRY-RUN] Would advance: "${title}"`);
        console.log(`            ${fromStatus} → ${toStatus}`);
        return { item, fromStatus, toStatus, success: true };
    }

    try {
        // Update status to next phase
        await adapter.updateItemStatus(item.id, toStatus);

        // Clear Review Status (set to empty for next agent)
        await adapter.updateItemReviewStatus(item.id, '');

        console.log(`  Advanced: "${title}"`);
        console.log(`            ${fromStatus} → ${toStatus}`);

        // Send Telegram notification
        const issueNumber = item.content?.number;
        if (issueNumber && agentConfig.telegram.enabled) {
            await notifyAutoAdvance(title, issueNumber, fromStatus, toStatus);
        }

        return { item, fromStatus, toStatus, success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  Failed to advance "${title}": ${errorMessage}`);
        return { item, fromStatus, toStatus, success: false, error: errorMessage };
    }
}

async function main() {
    const program = new Command()
        .name('auto-advance')
        .description('Advance approved items to next workflow phase')
        .option('--dry-run', 'Preview changes without applying them')
        .parse(process.argv);

    const options = program.opts<{ dryRun?: boolean }>();

    console.log('='.repeat(60));
    console.log('Auto-Advance Agent');
    console.log('='.repeat(60));

    if (options.dryRun) {
        console.log('\n[DRY-RUN MODE - No changes will be made]\n');
    }

    // Initialize adapter
    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Find all items with Review Status = Approved (excluding Done items)
    const allItems = await adapter.listItems({});
    const approvedItems = allItems.filter(
        (item) =>
            item.reviewStatus === REVIEW_STATUSES.approved &&
            item.status !== STATUSES.done // Ignore items already done
    );

    if (approvedItems.length === 0) {
        console.log('No items to process.');
        return;
    }

    console.log(`Found ${approvedItems.length} approved item(s):\n`);

    // Process each approved item
    const results: AdvanceResult[] = [];

    for (const item of approvedItems) {
        const result = await advanceItem(item, adapter, options.dryRun || false);
        results.push(result);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`\nTotal: ${results.length}`);
    console.log(`Succeeded: ${succeeded}`);
    if (failed > 0) {
        console.log(`Failed: ${failed}`);
        console.log('\nFailure details:');
        results
            .filter((r) => !r.success)
            .forEach((r) => {
                const title = r.item.content?.title || `Item ${r.item.id}`;
                const issueNum = r.item.content?.number || 'N/A';
                console.log(`  • Issue #${issueNum}: ${title}`);
                console.log(`    Status: ${r.fromStatus}`);
                console.log(`    Error: ${r.error || 'Unknown error'}`);
            });
    }

    if (options.dryRun) {
        console.log('\n[DRY-RUN] No changes were made.\n');
    }
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
