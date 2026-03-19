/**
 * Get Command
 *
 * Gets full details of a workflow item by ID, ID prefix, or GitHub issue number.
 */

import {
    findWorkflowItemById,
    findWorkflowItemByIssueNumber,
    findAllWorkflowItems,
} from '@/server/database/collections/template/workflow-items/workflow-items';
import type { WorkflowItemDocument } from '@/server/database/collections/template/workflow-items/types';
import { parseArgs } from '../utils/parse-args';

/**
 * Format date for display
 */
function formatDate(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 19);
}

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
 * Print workflow item details
 */
function printWorkflowItemDetails(item: WorkflowItemDocument): void {
    console.log('=== Workflow Item ===\n');
    console.log(`  ID:              ${item._id}`);
    console.log(`  Type:            ${item.type}`);
    console.log(`  Title:           ${item.title}`);
    console.log(`  Status:          ${item.status}`);
    if (item.reviewStatus) console.log(`  Review Status:   ${item.reviewStatus}`);
    if (item.implementationPhase) console.log(`  Impl Phase:      ${item.implementationPhase}`);
    if (item.priority) console.log(`  Priority:        ${item.priority}`);
    if (item.size) console.log(`  Size:            ${item.size}`);
    if (item.complexity) console.log(`  Complexity:      ${item.complexity}`);
    if (item.domain) console.log(`  Domain:          ${item.domain}`);
    if (item.labels?.length) console.log(`  Labels:          ${item.labels.join(', ')}`);
    if (item.createdBy) console.log(`  Created By:      ${item.createdBy}`);
    console.log(`  Reviewed:        ${item.reviewed ?? false}`);
    if (item.reviewSummary) console.log(`  Review Summary:  ${item.reviewSummary}`);
    console.log(`  Created:         ${formatDate(item.createdAt)}`);
    console.log(`  Updated:         ${formatDate(item.updatedAt)}`);

    if (item.githubIssueNumber) {
        console.log(`\n  GitHub Issue:    #${item.githubIssueNumber}`);
        if (item.githubIssueUrl) console.log(`  GitHub URL:      ${item.githubIssueUrl}`);
    }

    if (item.sourceRef) {
        console.log(`\n  Source:          ${item.sourceRef.collection} / ${item.sourceRef.id}`);
    }

    // Description
    if (item.description) {
        console.log(`\n  Description:\n    ${item.description.split('\n').join('\n    ')}`);
    }

    // Artifacts
    if (item.artifacts) {
        const a = item.artifacts;
        if (a.designs?.length) {
            console.log(`\n  Designs (${a.designs.length}):`);
            for (const d of a.designs) {
                console.log(`    - ${d.type}: ${d.path} (${d.status}${d.prNumber ? `, PR #${d.prNumber}` : ''})`);
            }
        }
        if (a.phases?.length) {
            console.log(`\n  Phases (${a.phases.length}):`);
            for (const p of a.phases) {
                console.log(`    - Phase ${p.order}: ${p.name} [${p.estimatedSize}] (${p.status}${p.prNumber ? `, PR #${p.prNumber}` : ''})`);
            }
        }
        if (a.taskBranch) console.log(`\n  Task Branch:     ${a.taskBranch}`);
        if (a.finalPrNumber) console.log(`  Final PR:        #${a.finalPrNumber}`);
        if (a.revertPrNumber) console.log(`  Revert PR:       #${a.revertPrNumber}`);
        if (a.lastMergedPr) {
            console.log(`  Last Merged PR:  #${a.lastMergedPr.prNumber}${a.lastMergedPr.phase ? ` (${a.lastMergedPr.phase})` : ''} at ${a.lastMergedPr.mergedAt}`);
        }
        if (a.decision) {
            console.log(`\n  Decision:`);
            console.log(`    Agent:   ${a.decision.agentId}`);
            console.log(`    Type:    ${a.decision.type}`);
            console.log(`    Options: ${a.decision.options.map(o => o.title ?? o.id).join(', ')}`);
            if (a.decision.selection) {
                const sel = a.decision.selection;
                console.log(`    Selected: ${sel.selectedOptionId ?? (sel.chooseRecommended ? '(recommended)' : 'N/A')}`);
            }
        }
        if (a.commitMessages?.length) {
            console.log(`\n  Commit Messages (${a.commitMessages.length}):`);
            for (const cm of a.commitMessages) {
                console.log(`    - PR #${cm.prNumber}: ${cm.title}`);
            }
        }
    }

    // History
    if (item.history?.length) {
        console.log(`\n  History (${item.history.length}):`);
        for (const h of item.history) {
            console.log(`    - [${h.timestamp}] ${h.action}: ${h.description}${h.actor ? ` (${h.actor})` : ''}`);
        }
    }
}

/**
 * Handle the get command
 */
export async function handleGet(args: string[]): Promise<void> {
    const parsed = parseArgs(args);

    // Get ID from positional argument or --id flag
    const id = parsed.id || args.find(arg => !arg.startsWith('--'));

    if (!id) {
        console.error('Error: Missing required argument: <id>');
        console.error('Usage: yarn agent-workflow get <id>');
        console.error('  <id> can be a workflow-item ID, ID prefix, or GitHub issue number');
        process.exit(1);
    }

    console.log(`\nFetching item ${id}...\n`);

    const item = await findById(id);

    if (!item) {
        console.error(`Error: Item not found with ID: ${id}`);
        console.error('\nTip: Use `yarn agent-workflow list` to see available items.');
        process.exit(1);
    }

    printWorkflowItemDetails(item);
    console.log('');
}
