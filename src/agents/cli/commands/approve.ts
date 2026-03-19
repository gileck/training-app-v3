/**
 * Approve Command
 *
 * Approves a feature request or bug report, creating a GitHub issue.
 * Usage: yarn agent-workflow approve <id> [--route <destination>]
 */

import { featureRequests, reports } from '@/server/database';
import { approveWorkflowItem } from '@/server/template/workflow-service';
import type { RoutingDestination } from '@/server/template/workflow-service';
import { parseArgs } from '../utils/parse-args';

const VALID_ROUTES = ['product-dev', 'product-design', 'tech-design', 'implementation', 'backlog'];

/**
 * Try to find an item by ID or ID prefix, searching both collections
 */
async function findItem(id: string): Promise<{ type: 'feature' | 'bug'; id: string } | null> {
    // Try exact match in features
    try {
        const feature = await featureRequests.findFeatureRequestById(id);
        if (feature) return { type: 'feature', id: feature._id.toString() };
    } catch { /* invalid ObjectId, try prefix */ }

    // Try exact match in reports
    try {
        const report = await reports.findReportById(id);
        if (report) return { type: 'bug', id: report._id.toString() };
    } catch { /* invalid ObjectId, try prefix */ }

    // Try prefix match
    if (id.length >= 6 && id.length < 24) {
        const allFeatures = await featureRequests.findFeatureRequests();
        const featureMatch = allFeatures.find(f => f._id.toString().startsWith(id));
        if (featureMatch) return { type: 'feature', id: featureMatch._id.toString() };

        const allReports = await reports.findReports();
        const reportMatch = allReports.find(r => r._id.toString().startsWith(id));
        if (reportMatch) return { type: 'bug', id: reportMatch._id.toString() };
    }

    return null;
}

/**
 * Handle the approve command
 */
export async function handleApprove(args: string[]): Promise<void> {
    const parsed = parseArgs(args);

    // Get ID from positional argument
    const id = parsed.id || args.find(arg => !arg.startsWith('--'));

    if (!id) {
        console.error('Error: Missing required argument: <id>');
        console.error('Usage: yarn agent-workflow approve <id> [--route <destination>]');
        process.exit(1);
    }

    const route = parsed.workflowRoute;
    if (route && !VALID_ROUTES.includes(route)) {
        console.error(`Error: Invalid route "${route}". Use: ${VALID_ROUTES.join(' | ')}`);
        process.exit(1);
    }

    console.log(`\nApproving item ${id}...\n`);

    const item = await findItem(id);
    if (!item) {
        console.error(`Error: Item not found with ID: ${id}`);
        process.exit(1);
    }

    console.log(`  Found ${item.type}: ${item.id}`);

    const result = await approveWorkflowItem(
        { id: item.id, type: item.type },
        route ? { initialRoute: route as RoutingDestination } : undefined
    );

    if (!result.success) {
        console.error(`  Error: ${result.error}`);
        process.exit(1);
    }

    console.log(`  GitHub issue created: #${result.issueNumber}`);
    console.log(`  URL: ${result.issueUrl}`);

    if (route) {
        console.log(`  Routed to: ${route}`);
    } else if (result.needsRouting) {
        console.log(`\n  Needs routing. Route with:`);
        console.log(`    yarn agent-workflow route ${item.id} --destination <dest>`);
    }

    console.log('\nApproved successfully!');
}
