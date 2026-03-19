/**
 * Delete Command
 *
 * Deletes a workflow item and optionally closes the linked GitHub issue.
 * Usage: yarn agent-workflow delete <id> [--force]
 */

import {
    findWorkflowItemById,
    findWorkflowItemByIssueNumber,
    findAllWorkflowItems,
    deleteWorkflowItem as deleteWorkflowItemFromDB,
} from '@/server/database/collections/template/workflow-items/workflow-items';
import { GitHubClient } from '@/server/template/project-management/github-client';
import { parseArgs } from '../utils/parse-args';

/**
 * Find a workflow item by exact ID, ID prefix, or GitHub issue number
 */
async function findItem(id: string): Promise<{ workflowItemId: string; title: string; githubIssueNumber?: number; githubIssueUrl?: string } | null> {
    // Try exact ObjectId match
    try {
        if (id.length === 24) {
            const exact = await findWorkflowItemById(id);
            if (exact) return {
                workflowItemId: exact._id.toString(),
                title: exact.title,
                githubIssueNumber: exact.githubIssueNumber,
                githubIssueUrl: exact.githubIssueUrl,
            };
        }
    } catch {
        // Invalid ObjectId format
    }

    // Try prefix match
    if (id.length >= 6 && id.length < 24) {
        const all = await findAllWorkflowItems();
        const match = all.find(item => item._id.toString().startsWith(id));
        if (match) return {
            workflowItemId: match._id.toString(),
            title: match.title,
            githubIssueNumber: match.githubIssueNumber,
            githubIssueUrl: match.githubIssueUrl,
        };
    }

    // Try by GitHub issue number
    const issueNum = parseInt(id, 10);
    if (!isNaN(issueNum)) {
        const item = await findWorkflowItemByIssueNumber(issueNum);
        if (item) return {
            workflowItemId: item._id.toString(),
            title: item.title,
            githubIssueNumber: item.githubIssueNumber,
            githubIssueUrl: item.githubIssueUrl,
        };
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

    console.log(`  Found: "${item.title}" (${item.workflowItemId})`);

    // Check GitHub sync status (block unless force)
    if (item.githubIssueUrl && !force) {
        console.error(`  Error: Cannot delete: already synced to GitHub (issue #${item.githubIssueNumber})`);
        console.error(`  Use --force to delete anyway.`);
        process.exit(1);
    }

    // Delete workflow item from DB
    const deleted = await deleteWorkflowItemFromDB(item.workflowItemId);
    if (!deleted) {
        console.error(`  Error: Failed to delete workflow item`);
        process.exit(1);
    }

    console.log(`  Deleted workflow item from DB`);

    // Close GitHub issue if exists (fire-and-forget)
    if (item.githubIssueNumber) {
        try {
            const gh = new GitHubClient();
            await gh.init();
            await gh.addIssueComment(item.githubIssueNumber, 'This item was deleted from the workflow.');
            await gh.closeIssue(item.githubIssueNumber);
            console.log(`  Closed GitHub issue #${item.githubIssueNumber}`);
        } catch (error) {
            console.warn(`  Warning: Failed to close GitHub issue: ${error}`);
        }
    }

    console.log(`\nDeleted "${item.title}" successfully!`);
}
