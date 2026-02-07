#!/usr/bin/env tsx
/**
 * Technical Design Agent
 *
 * Generates Technical Design documents for GitHub Project items.
 * Creates PRs with design files instead of updating issue body directly.
 *
 * Flow A (New Design):
 *   - Fetches items in "Technical Design" status with empty Review Status
 *   - Reads the approved Product Design from issue body or file
 *   - Generates technical design using Claude (read-only mode)
 *   - Creates branch, writes design file, creates PR
 *   - Sends Telegram notification with Approve & Merge buttons
 *   - Sets Review Status to "Waiting for Review"
 *
 * Flow B (Address Feedback):
 *   - Fetches items in "Technical Design" with Review Status = "Request Changes"
 *   - Reads admin feedback comments
 *   - Revises technical design based on feedback
 *   - Updates existing design file and PR
 *   - Sets Review Status back to "Waiting for Review"
 *
 * Usage:
 *   yarn agent:tech-design                    # Process all pending
 *   yarn agent:tech-design --id <item-id>     # Process specific item
 *   yarn agent:tech-design --dry-run          # Preview without saving
 *   yarn agent:tech-design --stream           # Stream Claude output
 */

import '../../shared/loadEnv';
import {
    // Config
    STATUSES,
    // Claude
    extractProductDesign,
    // Prompts
    buildTechDesignPrompt,
    buildTechDesignRevisionPrompt,
    buildTechDesignClarificationPrompt,
    // Output schemas
    TECH_DESIGN_OUTPUT_FORMAT,
    // CLI & Batch
    createCLI,
    runBatch,
    // Design Agent Processor
    createDesignProcessor,
} from '../../shared';
import {
    logGitHubAction,
} from '../../lib/logging';
import {
    formatPhasesToComment,
    hasPhaseComment,
} from '../../lib/phases';
import {
    readDesignDoc,
} from '../../lib/design-files';
import {
    getProductDesignPath,
} from '../../lib/artifacts';
import { getArtifactsFromIssue } from '../../lib/workflow-db';
import type { TechDesignOutput } from '../../shared';

// ============================================================
// PROCESSOR
// ============================================================

const processItem = createDesignProcessor({
    workflow: 'tech-design',
    phaseName: 'Technical Design',
    designType: 'tech',
    agentName: 'tech-design',
    outputFormat: TECH_DESIGN_OUTPUT_FORMAT,
    outputDesignField: 'design',

    modeLabels: {
        new: 'New Design',
        feedback: 'Address Feedback',
        clarification: 'Clarification',
    },

    progressLabels: {
        new: 'Generating technical design',
        feedback: 'Revising technical design',
        clarification: 'Continuing with clarification',
    },

    buildNewPrompt: ({ content, additionalContext, allComments }) =>
        buildTechDesignPrompt(content, additionalContext, allComments),

    buildFeedbackPrompt: ({ content, additionalContext, existingDesign, allComments }) =>
        buildTechDesignRevisionPrompt(content, additionalContext, existingDesign, allComments),

    buildClarificationPrompt: ({ content, issueNumber, additionalContext, allComments, clarification }) =>
        buildTechDesignClarificationPrompt(
            { title: content.title, number: issueNumber, body: content.body },
            additionalContext,
            allComments,
            clarification,
        ),

    loadAdditionalContext: async ({ issueNumber, adapter, content }) => {
        // Try to get product design from file first, then fall back to issue body
        const artifact = await getArtifactsFromIssue(adapter, issueNumber);
        const productDesignPath = getProductDesignPath(artifact);
        if (productDesignPath) {
            const productDesign = readDesignDoc(issueNumber, 'product');
            if (productDesign) {
                return { context: productDesign, label: `Loaded product design from file: ${productDesignPath}` };
            }
        }
        // Fallback to issue body
        const productDesign = extractProductDesign(content.body);
        if (productDesign) {
            return { context: productDesign, label: 'Loaded product design from issue body (fallback)' };
        }
        return { context: null, label: '\u26A0\uFE0F  No product design found for issue \u26A0\uFE0F' };
    },

    sortComments: (comments) =>
        [...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),

    afterPR: async ({ prNumber, adapter, structuredOutput, logCtx }) => {
        const output = structuredOutput as unknown as TechDesignOutput;
        if (output?.phases && output.phases.length >= 2) {
            // Check if phases comment already exists (idempotency)
            const prComments = await adapter.getPRComments(prNumber);
            if (!hasPhaseComment(prComments)) {
                const phasesComment = formatPhasesToComment(output.phases);
                await adapter.addPRComment(prNumber, phasesComment);
                console.log(`  Implementation phases comment posted on PR (${output.phases.length} phases)`);
                logGitHubAction(logCtx, 'comment', `Posted ${output.phases.length} implementation phases on PR`);
            } else {
                console.log('  Phases comment already exists on PR, skipping');
            }
        }
    },

    dryRunExtra: (structuredOutput) => {
        const output = structuredOutput as unknown as TechDesignOutput;
        if (output?.phases && output.phases.length >= 2) {
            console.log(`  [DRY RUN] Would post phases comment on PR (${output.phases.length} phases)`);
        }
    },

    prTitle: (issueNumber) => `docs: technical design for issue #${issueNumber}`,
    prBody: (issueNumber) => `Design document for issue #${issueNumber}

Part of #${issueNumber}

---
*Generated by Technical Design Agent*`,
});

// ============================================================
// CLI
// ============================================================

async function main(): Promise<void> {
    const { options } = createCLI({
        name: 'tech-design',
        displayName: 'Technical Design Agent',
        description: 'Generate Technical Design documents for GitHub Project items',
    });

    await runBatch(
        {
            agentStatus: STATUSES.techDesign,
            agentDisplayName: 'Technical Design',
        },
        options,
        processItem,
    );
}

// Run
main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
