#!/usr/bin/env tsx
/**
 * Triage Agent
 *
 * Automatically classifies Backlog items that are missing a domain.
 * Uses AI to determine the domain and optionally suggests priority/size/complexity
 * if those fields are also missing.
 *
 * This agent does NOT change item status or review status — items stay in Backlog.
 *
 * Usage:
 *   yarn agent:triage                    # Process all Backlog items missing domain
 *   yarn agent:triage --dry-run          # Preview without saving
 *   yarn agent:triage --stream           # Stream Claude output
 *   yarn agent:triage --limit <n>        # Limit items to process
 */

import '../../shared/loadEnv';
import {
    STATUSES,
    getProjectManagementAdapter,
    runAgent,
    buildTriagePrompt,
    TRIAGE_OUTPUT_FORMAT,
    createCLI,
    runBatch,
    type ProcessableItem,
    type CommonCLIOptions,
    type TriageOutput,
    runAgentMain,
} from '../../shared';
import {
    findWorkflowItemByIssueNumber,
    updateWorkflowFields,
    getUniqueDomains,
} from '@/server/database/collections/template/workflow-items/workflow-items';
import { normalizeDomain } from '@/server/template/project-management/domains';

export async function processItem(
    processable: ProcessableItem,
    options: CommonCLIOptions,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>
): Promise<{ success: boolean; error?: string }> {
    const { item } = processable;
    const content = item.content;

    if (!content) {
        return { success: false, error: 'Item has no content' };
    }

    const issueNumber = content.number;
    if (!issueNumber) {
        return { success: false, error: 'Item has no issue number' };
    }

    // Look up the workflow item document to check existing fields
    const doc = await findWorkflowItemByIssueNumber(issueNumber);
    if (!doc) {
        return { success: false, error: `No workflow item found for issue #${issueNumber}` };
    }

    // Skip if already triaged (has triage summary in description) AND all metadata fields are present
    const alreadyTriaged = doc.description?.includes('**Triage Summary:**');
    if (alreadyTriaged && doc.domain && doc.priority && doc.size && doc.complexity) {
        console.log(`  Skipping #${issueNumber}: already triaged (domain=${doc.domain})`);
        return { success: true };
    }

    console.log(`\n  Triaging issue #${issueNumber}: ${content.title}`);
    if (doc.domain) {
        console.log(`  Domain already set: ${doc.domain} (checking missing metadata)`);
    }

    // Fetch issue body for additional context
    let issueBody: string | undefined;
    try {
        const comments = await adapter.getIssueComments(issueNumber);
        // The first "comment" is often the issue body
        if (comments.length > 0 && comments[0].body) {
            issueBody = comments[0].body.slice(0, 2000); // Limit to 2k chars
        }
    } catch {
        // Non-fatal - proceed without issue body
    }

    // Fetch existing domains for prompt context
    const existingDomains = await getUniqueDomains();

    const prompt = buildTriagePrompt({
        title: content.title,
        description: doc.description,
        issueBody,
        type: doc.type,
        hasPriority: !!doc.priority,
        hasSize: !!doc.size,
        hasComplexity: !!doc.complexity,
        existingDomains,
    });

    if (options.dryRun) {
        console.log('  [DRY RUN] Would call AI to classify item');
        console.log(`  [DRY RUN] Missing: domain=${!doc.domain}, priority=${!doc.priority}, size=${!doc.size}, complexity=${!doc.complexity}`);
        return { success: true };
    }

    // Run the agent
    const result = await runAgent({
        prompt,
        stream: options.stream,
        verbose: options.verbose,
        timeout: options.timeout,
        progressLabel: 'Triaging item',
        workflow: 'triage',
        outputFormat: TRIAGE_OUTPUT_FORMAT,
    });

    if (!result.success || !result.content) {
        return { success: false, error: result.error || 'No content generated' };
    }

    // Extract structured output
    let output: TriageOutput;
    const structuredOutput = result.structuredOutput as TriageOutput | undefined;
    if (structuredOutput && typeof structuredOutput.domain === 'string') {
        output = structuredOutput;
    } else {
        try {
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                output = JSON.parse(jsonMatch[0]) as TriageOutput;
            } else {
                return { success: false, error: 'No JSON found in triage output' };
            }
        } catch {
            return { success: false, error: 'Failed to parse triage output as JSON' };
        }
    }

    // Build fields to update (only set fields that are currently missing)
    const fields: Record<string, string> = {};
    if (!doc.domain) fields.domain = normalizeDomain(output.domain);
    if (!doc.priority && output.priority) fields.priority = output.priority;
    if (!doc.size && output.size) fields.size = output.size;
    if (!doc.complexity && output.complexity) fields.complexity = output.complexity;

    // Append triage summary to description
    if (output.triageSummary) {
        const separator = '\n\n---\n\n**Triage Summary:**\n';
        const existingDesc = doc.description || '';
        fields.description = existingDesc + separator + output.triageSummary;
        if (!output.stillRelevant) {
            fields.description += '\n\n⚠️ **Note:** This item may no longer be relevant — the issue appears to be already resolved.';
        }
    }

    if (Object.keys(fields).length === 0) {
        console.log(`  No fields to update for #${issueNumber}`);
        return { success: true };
    }

    await updateWorkflowFields(doc._id, fields as Parameters<typeof updateWorkflowFields>[1]);
    const metadataFields = Object.entries(fields).filter(([k]) => k !== 'description').map(([k, v]) => `${k}=${v}`).join(', ');
    if (metadataFields) console.log(`  Updated #${issueNumber}: ${metadataFields}`);
    if (!output.stillRelevant) console.log(`  ⚠️  Item may no longer be relevant`);
    console.log(`  Reasoning: ${output.reasoning}`);

    return { success: true };
}

async function main(): Promise<void> {
    const { options } = createCLI({
        name: 'triage',
        displayName: 'Triage Agent',
        description: 'Classify Backlog items by domain and suggest metadata',
    });

    await runBatch(
        {
            agentStatus: STATUSES.backlog,
            agentDisplayName: 'Triage',
            needsExistingPR: false,
            listOptions: { domainMissing: true },
        },
        { ...options, limit: options.limit ?? 3 },
        processItem,
    );
}

runAgentMain(main, { skipInTest: true });
