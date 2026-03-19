/**
 * List Command
 *
 * Lists workflow items with optional filters.
 */

import { findAllWorkflowItems } from '@/server/database/collections/template/workflow-items/workflow-items';
import type { WorkflowItemDocument } from '@/server/database/collections/template/workflow-items/types';
import { parseArgs } from '../utils/parse-args';

/**
 * Format date for display
 */
function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + '...';
}

/**
 * Print items as a table
 */
function printTable(items: WorkflowItemDocument[]): void {
    if (items.length === 0) {
        console.log('  No items found.');
        return;
    }

    // Column widths
    const idWidth = 10;
    const typeWidth = 8;
    const statusWidth = 22;
    const titleWidth = 34;
    const domainWidth = 10;
    const issueWidth = 7;
    const dateWidth = 10;

    // Header
    console.log(
        '  ' +
        'ID'.padEnd(idWidth) +
        'TYPE'.padEnd(typeWidth) +
        'STATUS'.padEnd(statusWidth) +
        'TITLE'.padEnd(titleWidth) +
        'DOMAIN'.padEnd(domainWidth) +
        'ISSUE#'.padEnd(issueWidth) +
        'UPDATED'
    );
    console.log('  ' + '-'.repeat(idWidth + typeWidth + statusWidth + titleWidth + domainWidth + issueWidth + dateWidth));

    // Rows
    for (const item of items) {
        const idShort = item._id.toString().slice(0, 8);
        const issueStr = item.githubIssueNumber ? `#${item.githubIssueNumber}` : '';
        console.log(
            '  ' +
            idShort.padEnd(idWidth) +
            item.type.padEnd(typeWidth) +
            (item.status || '').padEnd(statusWidth) +
            truncate(item.title, titleWidth - 2).padEnd(titleWidth) +
            (item.domain || '').padEnd(domainWidth) +
            issueStr.padEnd(issueWidth) +
            formatDate(item.updatedAt)
        );
    }
}

/**
 * Handle the list command
 */
export async function handleList(args: string[]): Promise<void> {
    const parsed = parseArgs(args);

    console.log('\nFetching items...\n');

    const filters: { status?: string; type?: string; domain?: string } = {};
    if (parsed.status) filters.status = parsed.status;
    if (parsed.type) filters.type = parsed.type;
    if (parsed.domain) filters.domain = parsed.domain;

    const items = await findAllWorkflowItems(filters);

    // Print results
    console.log(`Found ${items.length} item(s):\n`);
    printTable(items);
    console.log('');
}
