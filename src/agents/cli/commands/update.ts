/**
 * Update Command
 *
 * Updates fields on a workflow item.
 */

import {
    findWorkflowItemById,
    findWorkflowItemByIssueNumber,
    findAllWorkflowItems,
    updateWorkflowFields,
} from '@/server/database/collections/template/workflow-items/workflow-items';
import type { WorkflowItemDocument } from '@/server/database/collections/template/workflow-items/types';
import { STATUSES } from '@/server/template/project-management/config';
import { parseArgs } from '../utils/parse-args';

const VALID_STATUSES: string[] = Object.values(STATUSES);
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

/**
 * Find a workflow item by exact ID, ID prefix, or GitHub issue number
 */
async function findById(id: string): Promise<WorkflowItemDocument | null> {
    // Try exact ObjectId match
    try {
        if (id.length === 24) {
            const exact = await findWorkflowItemById(id);
            if (exact) return exact;
        }
    } catch {
        // Invalid ObjectId format
    }

    // Try prefix match
    if (id.length >= 6 && id.length < 24) {
        const all = await findAllWorkflowItems();
        const match = all.find(item => item._id.toString().startsWith(id));
        if (match) return match;
    }

    // Try by GitHub issue number
    const issueNum = parseInt(id, 10);
    if (!isNaN(issueNum)) {
        const item = await findWorkflowItemByIssueNumber(issueNum);
        if (item) return item;
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
        console.error('Usage: yarn agent-workflow update <id> [--status <status>] [--priority <priority>] [--size <size>] [--complexity <complexity>] [--domain <domain>]');
        process.exit(1);
    }

    // Must have at least one update field
    if (!parsed.status && !parsed.priority && !parsed.size && !parsed.complexity && !parsed.domain) {
        console.error('Error: Must specify at least one field to update (--status, --priority, --size, --complexity, or --domain)');
        process.exit(1);
    }

    console.log(`\nFetching item ${id}...\n`);

    const item = await findById(id);

    if (!item) {
        console.error(`Error: Item not found with ID: ${id}`);
        console.error('\nTip: Use `yarn agent-workflow list` to see available items.');
        process.exit(1);
    }

    console.log(`Found: "${item.title}" (${item._id})`);
    console.log(`  Current status: ${item.status}`);
    if (item.priority) console.log(`  Current priority: ${item.priority}`);

    // Validate status
    if (parsed.status && !VALID_STATUSES.includes(parsed.status)) {
        console.error(`\nError: Invalid status "${parsed.status}".`);
        console.error(`Valid values: ${VALID_STATUSES.join(', ')}`);
        process.exit(1);
    }

    // Validate priority
    if (parsed.priority && !PRIORITIES.includes(parsed.priority)) {
        console.error(`\nError: Invalid priority "${parsed.priority}".`);
        console.error(`Valid values: ${PRIORITIES.join(', ')}`);
        process.exit(1);
    }

    // Validate size
    if (parsed.size && !['XS', 'S', 'M', 'L', 'XL'].includes(parsed.size)) {
        console.error(`\nError: Invalid size "${parsed.size}".`);
        console.error('Valid values: XS, S, M, L, XL');
        process.exit(1);
    }

    // Validate complexity
    if (parsed.complexity && !['High', 'Medium', 'Low'].includes(parsed.complexity)) {
        console.error(`\nError: Invalid complexity "${parsed.complexity}".`);
        console.error('Valid values: High, Medium, Low');
        process.exit(1);
    }

    if (parsed.dryRun) {
        console.log('\nDRY RUN - Would update:');
        if (parsed.status) console.log(`  Status: ${item.status} -> ${parsed.status}`);
        if (parsed.priority) console.log(`  Priority: ${item.priority || 'none'} -> ${parsed.priority}`);
        if (parsed.size) console.log(`  Size: ${item.size || 'none'} -> ${parsed.size}`);
        if (parsed.complexity) console.log(`  Complexity: ${item.complexity || 'none'} -> ${parsed.complexity}`);
        if (parsed.domain) console.log(`  Domain: ${item.domain || 'none'} -> ${parsed.domain}`);
        return;
    }

    // Apply updates
    console.log('\nApplying updates...');

    const fields: Parameters<typeof updateWorkflowFields>[1] = {};
    if (parsed.status) fields.workflowStatus = parsed.status;
    if (parsed.priority) fields.priority = parsed.priority as 'critical' | 'high' | 'medium' | 'low';
    if (parsed.size) fields.size = parsed.size as 'XS' | 'S' | 'M' | 'L' | 'XL';
    if (parsed.complexity) fields.complexity = parsed.complexity as 'High' | 'Medium' | 'Low';
    if (parsed.domain) fields.domain = parsed.domain;

    await updateWorkflowFields(item._id, fields);

    if (parsed.status) console.log(`  Status: ${item.status} -> ${parsed.status}`);
    if (parsed.priority) console.log(`  Priority: ${item.priority || 'none'} -> ${parsed.priority}`);
    if (parsed.size) console.log(`  Size: ${item.size || 'none'} -> ${parsed.size}`);
    if (parsed.complexity) console.log(`  Complexity: ${item.complexity || 'none'} -> ${parsed.complexity}`);
    if (parsed.domain) console.log(`  Domain: ${item.domain || 'none'} -> ${parsed.domain}`);

    console.log('\nWorkflow item updated successfully!\n');
}
