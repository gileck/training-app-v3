/**
 * Update Command
 *
 * Updates status or priority of a feature request or bug report.
 */

import { featureRequests, reports } from '@/server/database';
import type { FeatureRequestDocument, FeatureRequestStatus, FeatureRequestPriority } from '@/server/database/collections/template/feature-requests/types';
import type { ReportDocument, ReportStatus } from '@/server/database/collections/template/reports/types';
import { parseArgs } from '../utils/parse-args';

const FEATURE_STATUSES: FeatureRequestStatus[] = ['new', 'in_progress', 'done', 'rejected'];
const REPORT_STATUSES: ReportStatus[] = ['new', 'investigating', 'resolved', 'closed'];
const PRIORITIES: FeatureRequestPriority[] = ['low', 'medium', 'high', 'critical'];

/**
 * Find item by ID or ID prefix
 */
async function findById(
    id: string,
    typeHint?: string
): Promise<{ type: 'feature'; item: FeatureRequestDocument } | { type: 'bug'; item: ReportDocument } | null> {
    if (typeHint === 'feature') {
        const feature = await tryFindFeature(id);
        if (feature) return { type: 'feature', item: feature };
        return null;
    }

    if (typeHint === 'bug') {
        const report = await tryFindReport(id);
        if (report) return { type: 'bug', item: report };
        return null;
    }

    const feature = await tryFindFeature(id);
    if (feature) return { type: 'feature', item: feature };

    const report = await tryFindReport(id);
    if (report) return { type: 'bug', item: report };

    return null;
}

async function tryFindFeature(id: string): Promise<FeatureRequestDocument | null> {
    try {
        const exact = await featureRequests.findFeatureRequestById(id);
        if (exact) return exact;
    } catch {
        // Invalid ObjectId format
    }

    if (id.length >= 6 && id.length < 24) {
        const all = await featureRequests.findFeatureRequests();
        const match = all.find(f => f._id.toString().startsWith(id));
        if (match) return match;
    }

    return null;
}

async function tryFindReport(id: string): Promise<ReportDocument | null> {
    try {
        const exact = await reports.findReportById(id);
        if (exact) return exact;
    } catch {
        // Invalid ObjectId format
    }

    if (id.length >= 6 && id.length < 24) {
        const all = await reports.findReports();
        const match = all.find(r => r._id.toString().startsWith(id));
        if (match) return match;
    }

    return null;
}

/**
 * Handle the update command
 */
export async function handleUpdate(args: string[]): Promise<void> {
    const parsed = parseArgs(args);

    // Get ID from positional argument or --id flag
    const id = parsed.id || args.find(arg => !arg.startsWith('--'));

    if (!id) {
        console.error('Error: Missing required argument: <id>');
        console.error('Usage: yarn agent-workflow update <id> --status <status> [--priority <priority>]');
        process.exit(1);
    }

    // Must have at least one update field
    if (!parsed.status && !parsed.priority) {
        console.error('Error: Must specify at least one field to update (--status or --priority)');
        console.error('Usage: yarn agent-workflow update <id> --status <status> [--priority <priority>]');
        process.exit(1);
    }

    console.log(`\nFetching item ${id}...\n`);

    const result = await findById(id, parsed.type);

    if (!result) {
        console.error(`Error: Item not found with ID: ${id}`);
        console.error('\nTip: Use `yarn agent-workflow list` to see available items.');
        process.exit(1);
    }

    const fullId = result.type === 'feature'
        ? (result.item as FeatureRequestDocument)._id.toString()
        : (result.item as ReportDocument)._id.toString();

    // Validate and apply updates
    if (result.type === 'feature') {
        const feature = result.item as FeatureRequestDocument;

        console.log(`Found feature request: ${feature.title}`);
        console.log(`  Current status: ${feature.status}`);
        console.log(`  Current priority: ${feature.priority}`);

        // Validate status
        if (parsed.status && !FEATURE_STATUSES.includes(parsed.status as FeatureRequestStatus)) {
            console.error(`\nError: Invalid status "${parsed.status}" for feature request.`);
            console.error(`Valid values: ${FEATURE_STATUSES.join(', ')}`);
            process.exit(1);
        }

        // Validate priority
        if (parsed.priority && !PRIORITIES.includes(parsed.priority as FeatureRequestPriority)) {
            console.error(`\nError: Invalid priority "${parsed.priority}".`);
            console.error(`Valid values: ${PRIORITIES.join(', ')}`);
            process.exit(1);
        }

        if (parsed.dryRun) {
            console.log('\nDRY RUN - Would update:');
            if (parsed.status) console.log(`  Status: ${feature.status} -> ${parsed.status}`);
            if (parsed.priority) console.log(`  Priority: ${feature.priority} -> ${parsed.priority}`);
            return;
        }

        // Apply updates
        console.log('\nApplying updates...');

        if (parsed.status) {
            await featureRequests.updateFeatureRequestStatus(fullId, parsed.status as FeatureRequestStatus);
            console.log(`  Status: ${feature.status} -> ${parsed.status}`);
        }

        if (parsed.priority) {
            await featureRequests.updatePriority(fullId, parsed.priority as FeatureRequestPriority);
            console.log(`  Priority: ${feature.priority} -> ${parsed.priority}`);
        }

        console.log('\nFeature request updated successfully!');

    } else {
        const report = result.item as ReportDocument;

        console.log(`Found bug report: ${report.description || 'No description'}`);
        console.log(`  Current status: ${report.status}`);

        // Validate status
        if (parsed.status && !REPORT_STATUSES.includes(parsed.status as ReportStatus)) {
            console.error(`\nError: Invalid status "${parsed.status}" for bug report.`);
            console.error(`Valid values: ${REPORT_STATUSES.join(', ')}`);
            process.exit(1);
        }

        // Priority not applicable to bug reports
        if (parsed.priority) {
            console.error('\nError: Priority is only applicable to feature requests, not bug reports.');
            process.exit(1);
        }

        if (parsed.dryRun) {
            console.log('\nDRY RUN - Would update:');
            if (parsed.status) console.log(`  Status: ${report.status} -> ${parsed.status}`);
            return;
        }

        // Apply updates
        console.log('\nApplying updates...');

        if (parsed.status) {
            await reports.updateReportStatus(fullId, parsed.status as ReportStatus);
            console.log(`  Status: ${report.status} -> ${parsed.status}`);
        }

        console.log('\nBug report updated successfully!');
    }

    console.log('');
}
