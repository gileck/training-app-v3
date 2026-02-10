/**
 * Delete Command
 *
 * Deletes a feature request or bug report.
 * Usage: yarn agent-workflow delete <id> [--force]
 */

import { featureRequests, reports } from '@/server/database';
import { deleteWorkflowItem } from '@/server/workflow-service';
import { parseArgs } from '../utils/parse-args';

/**
 * Try to find an item by ID or ID prefix, searching both collections
 */
async function findItem(id: string): Promise<{ type: 'feature' | 'bug'; id: string; title: string } | null> {
    // Try exact match in features
    try {
        const feature = await featureRequests.findFeatureRequestById(id);
        if (feature) return { type: 'feature', id: feature._id.toString(), title: feature.title };
    } catch { /* invalid ObjectId, try prefix */ }

    // Try exact match in reports
    try {
        const report = await reports.findReportById(id);
        if (report) return { type: 'bug', id: report._id.toString(), title: report.description?.slice(0, 80) || 'Bug Report' };
    } catch { /* invalid ObjectId, try prefix */ }

    // Try prefix match
    if (id.length >= 6 && id.length < 24) {
        const allFeatures = await featureRequests.findFeatureRequests();
        const featureMatch = allFeatures.find(f => f._id.toString().startsWith(id));
        if (featureMatch) return { type: 'feature', id: featureMatch._id.toString(), title: featureMatch.title };

        const allReports = await reports.findReports();
        const reportMatch = allReports.find(r => r._id.toString().startsWith(id));
        if (reportMatch) return { type: 'bug', id: reportMatch._id.toString(), title: reportMatch.description?.slice(0, 80) || 'Bug Report' };
    }

    return null;
}

/**
 * Handle the delete command
 */
export async function handleDelete(args: string[]): Promise<void> {
    const parsed = parseArgs(args);

    // Get ID from positional argument
    const id = parsed.id || args.find(arg => !arg.startsWith('--'));

    if (!id) {
        console.error('Error: Missing required argument: <id>');
        console.error('Usage: yarn agent-workflow delete <id> [--force]');
        process.exit(1);
    }

    const force = parsed.force;

    console.log(`\nDeleting item ${id}...\n`);

    const item = await findItem(id);
    if (!item) {
        console.error(`Error: Item not found with ID: ${id}`);
        process.exit(1);
    }

    console.log(`  Found ${item.type}: "${item.title}" (${item.id})`);

    const result = await deleteWorkflowItem(
        { id: item.id, type: item.type },
        force ? { force: true } : undefined
    );

    if (!result.success) {
        console.error(`  Error: ${result.error}`);
        if (result.error?.includes('synced to GitHub')) {
            console.error(`  Use --force to delete anyway.`);
        }
        process.exit(1);
    }

    console.log(`  Deleted: "${result.title}"`);
    console.log('\nDeleted successfully!');
}
