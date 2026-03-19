/**
 * Route Command
 *
 * Routes a workflow item to a specific destination phase.
 * Usage: yarn agent-workflow route <id> --destination <destination>
 */

import {
    findWorkflowItemById,
    findWorkflowItemByIssueNumber,
    findAllWorkflowItems,
} from '@/server/database/collections/template/workflow-items/workflow-items';
import { routeWorkflowItemByWorkflowId } from '@/server/template/workflow-service';
import { STATUSES } from '@/server/template/project-management/config';
import { parseArgs } from '../utils/parse-args';

const VALID_DESTINATIONS = ['product-dev', 'product-design', 'tech-design', 'implementation', 'backlog'];

/**
 * Map routing destination names to their status values
 */
const DESTINATION_TO_STATUS: Record<string, string> = {
    'product-dev': STATUSES.productDevelopment,
    'product-design': STATUSES.productDesign,
    'tech-design': STATUSES.techDesign,
    'implementation': STATUSES.implementation,
    'backlog': STATUSES.backlog,
};

/**
 * Find a workflow item by exact ID, ID prefix, or GitHub issue number
 */
async function findItem(id: string): Promise<{ workflowItemId: string; title: string } | null> {
    // Try exact ObjectId match
    try {
        if (id.length === 24) {
            const exact = await findWorkflowItemById(id);
            if (exact) return { workflowItemId: exact._id.toString(), title: exact.title };
        }
    } catch {
        // Invalid ObjectId format
    }

    // Try prefix match
    if (id.length >= 6 && id.length < 24) {
        const all = await findAllWorkflowItems();
        const match = all.find(item => item._id.toString().startsWith(id));
        if (match) return { workflowItemId: match._id.toString(), title: match.title };
    }

    // Try by GitHub issue number
    const issueNum = parseInt(id, 10);
    if (!isNaN(issueNum)) {
        const item = await findWorkflowItemByIssueNumber(issueNum);
        if (item) return { workflowItemId: item._id.toString(), title: item.title };
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

    console.log(`  Found: "${item.title}" (${item.workflowItemId})`);

    // Convert destination to status string and route via workflow-service
    const targetStatus = DESTINATION_TO_STATUS[destination];
    const result = await routeWorkflowItemByWorkflowId(item.workflowItemId, targetStatus);

    if (!result.success) {
        console.error(`  Error: ${result.error}`);
        process.exit(1);
    }

    console.log(`  Routed to: ${result.targetLabel}`);
    console.log('\nRouted successfully!');
}
