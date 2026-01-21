#!/usr/bin/env tsx
/**
 * Product Design Agent
 *
 * Generates Product Design documents for GitHub Project items.
 *
 * Flow A (New Design):
 *   - Fetches items in "Product Design" status with empty Review Status
 *   - Generates product design using Claude (read-only mode)
 *   - Updates issue body with design
 *   - Sets Review Status to "Waiting for Review"
 *
 * Flow B (Address Feedback):
 *   - Fetches items in "Product Design" with Review Status = "Request Changes"
 *   - Reads admin feedback comments
 *   - Revises product design based on feedback
 *   - Updates issue body with revised design
 *   - Sets Review Status back to "Waiting for Review"
 *
 * Usage:
 *   yarn agent:product-design                    # Process all pending
 *   yarn agent:product-design --id <item-id>     # Process specific item
 *   yarn agent:product-design --dry-run          # Preview without saving
 *   yarn agent:product-design --stream           # Stream Claude output
 */

import './shared/loadEnv';
import { Command } from 'commander';
import {
    // Config
    STATUSES,
    REVIEW_STATUSES,
    agentConfig,
    // Project management
    getProjectManagementAdapter,
    type ProjectItem,
    // Claude
    runAgent,
    extractMarkdown,
    extractOriginalDescription,
    extractProductDesign,
    buildUpdatedIssueBody,
    // Notifications
    notifyProductDesignReady,
    notifyAgentError,
    notifyBatchComplete,
    notifyAgentStarted,
    // Prompts
    buildProductDesignPrompt,
    buildProductDesignRevisionPrompt,
    buildProductDesignClarificationPrompt,
    // Types
    type CommonCLIOptions,
    type UsageStats,
    // Utils
    extractClarification,
    handleClarificationRequest,
} from './shared';
import { getIssueType } from './shared/utils';

// ============================================================
// TYPES
// ============================================================

interface ProcessableItem {
    item: ProjectItem;
    mode: 'new' | 'feedback' | 'clarification';
}

// ============================================================
// MAIN LOGIC
// ============================================================

async function processItem(
    processable: ProcessableItem,
    options: CommonCLIOptions,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>
): Promise<{ success: boolean; error?: string }> {
    const { item, mode } = processable;
    const content = item.content;

    if (!content || content.type !== 'Issue') {
        return { success: false, error: 'Item has no linked issue' };
    }

    const issueNumber = content.number!;
    console.log(`\n  Processing issue #${issueNumber}: ${content.title}`);
    console.log(`  Mode: ${mode === 'new' ? 'New Design' : 'Address Feedback'}`);

    // Check if this is a bug - skip by default
    const issueType = getIssueType(content.labels);
    if (issueType === 'bug') {
        console.log('  ⚠️  Skipping bug report (bugs typically skip Product Design)');
        console.log('  💡 If this bug needs product design, admin should move it here manually');
        return { success: false, error: 'Bug reports skip Product Design by default' };
    }

    // Send "work started" notification
    if (!options.dryRun) {
        await notifyAgentStarted('Product Design', content.title, issueNumber, mode, issueType);
    }

    try {
        // Always fetch comments - they provide context for any phase
        const comments = await adapter.getIssueComments(issueNumber);
        const issueComments = comments.map((c) => ({
            id: c.id,
            body: c.body,
            author: c.author,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        }));
        if (issueComments.length > 0) {
            console.log(`  Found ${issueComments.length} comment(s) on issue`);
        }

        let prompt: string;

        if (mode === 'new') {
            // Flow A: New design
            prompt = buildProductDesignPrompt(content, issueComments);
        } else if (mode === 'feedback') {
            // Flow B: Address feedback
            const existingDesign = extractProductDesign(content.body);
            if (!existingDesign) {
                return { success: false, error: 'No existing product design found to revise' };
            }

            if (issueComments.length === 0) {
                return { success: false, error: 'No feedback comments found' };
            }

            prompt = buildProductDesignRevisionPrompt(content, existingDesign, issueComments);
        } else {
            // Flow C: Continue after clarification
            const adminComments = issueComments.filter(c => !c.author.includes('bot'));
            const clarification = adminComments[adminComments.length - 1];

            if (!clarification) {
                return { success: false, error: 'No clarification comment found' };
            }

            prompt = buildProductDesignClarificationPrompt(
                { title: content.title, number: issueNumber, body: content.body, labels: content.labels },
                issueComments,
                clarification
            );
        }

        // Run the agent
        console.log('');
        const progressLabel = mode === 'new'
            ? 'Generating product design'
            : mode === 'feedback'
            ? 'Revising product design'
            : 'Continuing with clarification';

        const result = await runAgent({
            prompt,
            stream: options.stream,
            verbose: options.verbose,
            timeout: options.timeout,
            progressLabel,
            workflow: 'product-design',
        });

        if (!result.success || !result.content) {
            const error = result.error || 'No content generated';
            if (!options.dryRun) {
                await notifyAgentError('Product Design', content.title, issueNumber, error);
            }
            return { success: false, error };
        }

        // Check if agent needs clarification
        const clarificationRequest = extractClarification(result.content);
        if (clarificationRequest) {
            console.log('  🤔 Agent needs clarification');
            return await handleClarificationRequest(
                adapter,
                { id: item.id, content: { number: issueNumber, title: content.title, labels: content.labels } },
                issueNumber,
                clarificationRequest,
                'Product Design',
                content.title,
                issueType,
                options,
                'product-design'
            );
        }

        // Extract markdown design from output
        const design = extractMarkdown(result.content);
        if (!design) {
            const error = 'Could not extract design document from output';
            if (!options.dryRun) {
                await notifyAgentError('Product Design', content.title, issueNumber, error);
            }
            return { success: false, error };
        }

        console.log(`  Design generated: ${design.length} chars`);
        console.log(`  Preview: ${design.slice(0, 100).replace(/\n/g, ' ')}...`);

        if (options.dryRun) {
            console.log('  [DRY RUN] Would update issue body');
            console.log('  [DRY RUN] Would set Review Status to Waiting for Review');
            console.log('  [DRY RUN] Would send notification');
            return { success: true };
        }

        // Update issue body
        const originalDescription = extractOriginalDescription(content.body);
        const existingTechDesign = null; // Product design doesn't touch tech design
        const newBody = buildUpdatedIssueBody(originalDescription, design, existingTechDesign);
        await adapter.updateIssueBody(issueNumber, newBody);
        console.log('  Issue body updated');

        // Update review status (status stays at "Product Design")
        if (adapter.hasReviewStatusField()) {
            await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForReview);
            console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForReview}`);
        }

        // Send notification
        await notifyProductDesignReady(content.title, issueNumber, mode === 'feedback', issueType);
        console.log('  Notification sent');

        return { success: true };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`  Error: ${errorMsg}`);
        if (!options.dryRun) {
            await notifyAgentError('Product Design', content.title, issueNumber, errorMsg);
        }
        return { success: false, error: errorMsg };
    }
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('product-design')
        .description('Generate Product Design documents for GitHub Project items')
        .option('--id <itemId>', 'Process a specific project item by ID')
        .option('--limit <number>', 'Limit number of items to process', parseInt)
        .option('--timeout <seconds>', 'Timeout per item in seconds', parseInt)
        .option('--dry-run', 'Preview without saving changes', false)
        .option('--stream', "Stream Claude's output in real-time", false)
        .option('--verbose', 'Show additional debug output', false)
        .parse(process.argv);

    const opts = program.opts();
    const options: CommonCLIOptions = {
        id: opts.id as string | undefined,
        limit: opts.limit as number | undefined,
        timeout: (opts.timeout as number | undefined) ?? agentConfig.claude.timeoutSeconds,
        dryRun: Boolean(opts.dryRun),
        verbose: Boolean(opts.verbose),
        stream: Boolean(opts.stream),
    };

    console.log('\n========================================');
    console.log('  Product Design Agent');
    console.log('========================================');
    console.log(`  Timeout: ${options.timeout}s per item`);
    if (options.dryRun) {
        console.log('  Mode: DRY RUN (no changes will be saved)');
    }
    console.log('');

    // Initialize project management adapter
    console.log('Connecting to GitHub...');
    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Collect items to process
    const itemsToProcess: ProcessableItem[] = [];

    if (options.id) {
        // Process specific item
        console.log(`\nFetching item: ${options.id}`);
        const item = await adapter.getItem(options.id);
        if (!item) {
            console.error(`Item not found: ${options.id}`);
            process.exit(1);
        }

        // Determine mode based on current status and review status
        let mode: 'new' | 'feedback' | 'clarification';
        if (item.status === STATUSES.productDesign && !item.reviewStatus) {
            mode = 'new';
        } else if (item.status === STATUSES.productDesign && item.reviewStatus === REVIEW_STATUSES.requestChanges) {
            mode = 'feedback';
        } else if (item.status === STATUSES.productDesign && item.reviewStatus === REVIEW_STATUSES.clarificationReceived) {
            mode = 'clarification';
        } else if (item.status === STATUSES.productDesign && item.reviewStatus === REVIEW_STATUSES.waitingForClarification) {
            console.log('  ⏳ Waiting for clarification from admin');
            console.log('  Skipping this item (admin needs to respond and click "Clarification Received")');
            process.exit(0);
        } else {
            console.error(`Item is not in a processable state.`);
            console.error(`  Status: ${item.status}`);
            console.error(`  Review Status: ${item.reviewStatus}`);
            console.error(`  Expected: "${STATUSES.productDesign}" with empty Review Status, "${REVIEW_STATUSES.requestChanges}", or "${REVIEW_STATUSES.clarificationReceived}"`);
            process.exit(1);
        }

        itemsToProcess.push({ item, mode });
    } else {
        // Flow A: Fetch items ready for new design (Product Design status with empty Review Status)
        console.log(`\nFetching items in "${STATUSES.productDesign}" with empty Review Status...`);
        const allProductDesignItems = await adapter.listItems({ status: STATUSES.productDesign, limit: options.limit || 50 });
        const newItems = allProductDesignItems.filter((item) => !item.reviewStatus);
        for (const item of newItems) {
            itemsToProcess.push({ item, mode: 'new' });
        }
        console.log(`  Found ${newItems.length} item(s) for new design`);

        // Flow B: Fetch items needing revision (Product Design status with Request Changes)
        if (adapter.hasReviewStatusField()) {
            console.log(`\nFetching items with Review Status "${REVIEW_STATUSES.requestChanges}"...`);
            const feedbackItems = allProductDesignItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.requestChanges
            );
            for (const item of feedbackItems) {
                itemsToProcess.push({ item, mode: 'feedback' });
            }
            console.log(`  Found ${feedbackItems.length} item(s) needing revision`);

            // Flow C: Fetch items with clarification received
            console.log(`\nFetching items with Review Status "${REVIEW_STATUSES.clarificationReceived}"...`);
            const clarificationItems = allProductDesignItems.filter(
                (item) => item.reviewStatus === REVIEW_STATUSES.clarificationReceived
            );
            for (const item of clarificationItems) {
                itemsToProcess.push({ item, mode: 'clarification' });
            }
            console.log(`  Found ${clarificationItems.length} item(s) with clarification received`);
        }

        // Apply limit
        if (options.limit && itemsToProcess.length > options.limit) {
            itemsToProcess.length = options.limit;
        }
    }

    if (itemsToProcess.length === 0) {
        console.log('\nNo items to process.');
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
        console.log(`  Item ID: ${item.id}`);
        console.log(`  Status: ${item.status}`);
        if (item.reviewStatus) {
            console.log(`  Review Status: ${item.reviewStatus}`);
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
    console.log(`  Processed: ${results.processed}`);
    console.log(`  Succeeded: ${results.succeeded}`);
    console.log(`  Failed: ${results.failed}`);
    console.log('========================================\n');

    // Send batch completion notification
    if (!options.dryRun && results.processed > 1) {
        await notifyBatchComplete('Product Design', results.processed, results.succeeded, results.failed);
    }
}

// Run
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
