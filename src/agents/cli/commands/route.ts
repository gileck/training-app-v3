/**
 * Route Command
 *
 * Routes a workflow item to a specific destination phase.
 * Usage: yarn agent-workflow route <id> --destination <destination>
 */

import { featureRequests, reports } from '@/server/database';
import { routeWorkflowItem } from '@/server/workflow-service';
import type { RoutingDestination } from '@/server/workflow-service';
import { parseArgs } from '../utils/parse-args';

const VALID_DESTINATIONS = ['product-dev', 'product-design', 'tech-design', 'implementation', 'backlog'];

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
 * Handle the route command
 */
export async function handleRoute(args: string[]): Promise<void> {
    const parsed = parseArgs(args);

    // Get ID from positional argument
    const id = parsed.id || args.find(arg => !arg.startsWith('--'));

    if (!id) {
        console.error('Error: Missing required argument: <id>');
        console.error('Usage: yarn agent-workflow route <id> --destination <destination>');
        process.exit(1);
    }

    const destination = parsed.destination;
    if (!destination) {
        console.error('Error: Missing required argument: --destination');
        console.error(`Valid destinations: ${VALID_DESTINATIONS.join(' | ')}`);
        process.exit(1);
    }

    if (!VALID_DESTINATIONS.includes(destination)) {
        console.error(`Error: Invalid destination "${destination}". Use: ${VALID_DESTINATIONS.join(' | ')}`);
        process.exit(1);
    }

    console.log(`\nRouting item ${id} to ${destination}...\n`);

    const item = await findItem(id);
    if (!item) {
        console.error(`Error: Item not found with ID: ${id}`);
        process.exit(1);
    }

    console.log(`  Found ${item.type}: ${item.id}`);

    const result = await routeWorkflowItem(
        { id: item.id, type: item.type },
        destination as RoutingDestination
    );

    if (!result.success) {
        console.error(`  Error: ${result.error}`);
        process.exit(1);
    }

    console.log(`  Routed to: ${result.targetLabel}`);
    console.log('\nRouted successfully!');
}
