/**
 * List Command
 *
 * Lists feature requests and bug reports with optional filters.
 */

import { featureRequests, reports } from '@/server/database';
import type { FeatureRequestDocument } from '@/server/database/collections/feature-requests/types';
import type { ReportDocument } from '@/server/database/collections/reports/types';
import { parseArgs } from '../utils/parse-args';

interface ListItem {
    id: string;
    type: 'feature' | 'bug';
    status: string;
    title: string;
    source: string;
    created: Date;
}

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
 * Convert feature request to list item
 */
function featureToListItem(f: FeatureRequestDocument): ListItem {
    return {
        id: f._id.toString(),
        type: 'feature',
        status: f.status,
        title: f.title,
        source: f.source || 'ui',
        created: f.createdAt,
    };
}

/**
 * Convert report to list item
 */
function reportToListItem(r: ReportDocument): ListItem {
    return {
        id: r._id.toString(),
        type: 'bug',
        status: r.status,
        title: r.description || 'No description',
        source: r.source || 'ui',
        created: r.createdAt,
    };
}

/**
 * Print items as a table
 */
function printTable(items: ListItem[]): void {
    if (items.length === 0) {
        console.log('  No items found.');
        return;
    }

    // Column widths
    const idWidth = 10;
    const typeWidth = 8;
    const statusWidth = 14;
    const titleWidth = 40;
    const sourceWidth = 6;
    const dateWidth = 10;

    // Header
    console.log(
        '  ' +
        'ID'.padEnd(idWidth) +
        'TYPE'.padEnd(typeWidth) +
        'STATUS'.padEnd(statusWidth) +
        'TITLE'.padEnd(titleWidth) +
        'SOURCE'.padEnd(sourceWidth) +
        'CREATED'
    );
    console.log('  ' + '-'.repeat(idWidth + typeWidth + statusWidth + titleWidth + sourceWidth + dateWidth));

    // Rows
    for (const item of items) {
        const idShort = item.id.slice(0, 8);
        console.log(
            '  ' +
            idShort.padEnd(idWidth) +
            item.type.padEnd(typeWidth) +
            item.status.padEnd(statusWidth) +
            truncate(item.title, titleWidth - 2).padEnd(titleWidth) +
            item.source.padEnd(sourceWidth) +
            formatDate(item.created)
        );
    }
}

/**
 * Handle the list command
 */
export async function handleList(args: string[]): Promise<void> {
    const parsed = parseArgs(args);

    console.log('\nFetching items...\n');

    const items: ListItem[] = [];

    // Fetch feature requests if type not specified or type is 'feature'
    if (!parsed.type || parsed.type === 'feature') {
        const featureFilters: { status?: string; source?: string } = {};
        if (parsed.status) featureFilters.status = parsed.status;
        if (parsed.source) featureFilters.source = parsed.source;

        const featureResults = await featureRequests.findFeatureRequests(featureFilters as never);
        items.push(...featureResults.map(featureToListItem));
    }

    // Fetch bug reports if type not specified or type is 'bug'
    if (!parsed.type || parsed.type === 'bug') {
        const reportFilters: { status?: string; source?: string } = {};
        if (parsed.status) reportFilters.status = parsed.status;
        if (parsed.source) reportFilters.source = parsed.source;

        const reportResults = await reports.findReports(reportFilters as never);
        items.push(...reportResults.map(reportToListItem));
    }

    // Sort by created date (newest first)
    items.sort((a, b) => b.created.getTime() - a.created.getTime());

    // Print results
    console.log(`Found ${items.length} item(s):\n`);
    printTable(items);
    console.log('');
}
