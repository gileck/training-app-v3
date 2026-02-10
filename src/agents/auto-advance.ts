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
import { autoAdvanceApproved } from '@/server/workflow-service';

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

    const result = await autoAdvanceApproved({ dryRun: options.dryRun });

    if (result.total === 0) {
        console.log('No items to process.');
        return;
    }

    console.log(`Found ${result.total} approved item(s):\n`);

    // Print details
    for (const detail of result.details) {
        const prefix = options.dryRun ? '[DRY-RUN] ' : '';
        if (detail.success) {
            console.log(`  ${prefix}Advanced: "${detail.title}"`);
            console.log(`            ${detail.fromStatus} → ${detail.toStatus}`);
        } else {
            const issueLabel = detail.issueNumber ? `Issue #${detail.issueNumber}` : detail.title;
            console.log(`  ⚠️  Skipped: "${issueLabel}" - ${detail.error}`);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));

    console.log(`\nTotal: ${result.total}`);
    console.log(`Succeeded: ${result.advanced}`);
    if (result.failed > 0) {
        console.log(`Failed: ${result.failed}`);
        console.log('\nFailure details:');
        result.details
            .filter((d) => !d.success)
            .forEach((d) => {
                const issueLabel = d.issueNumber ? `Issue #${d.issueNumber}` : d.title;
                console.log(`  • ${issueLabel}: ${d.title}`);
                console.log(`    Status: ${d.fromStatus}`);
                console.log(`    Error: ${d.error || 'Unknown error'}`);
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
