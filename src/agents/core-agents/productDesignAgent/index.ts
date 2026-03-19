#!/usr/bin/env tsx
/**
 * Product Design Agent (2-Phase Flow)
 *
 * Phase 1 (reviewStatus = null → Waiting for Decision):
 *   - Creates 2-3 React mock pages showing different UI/UX approaches
 *   - Posts decision for admin to choose between mock options
 *   - Sets Review Status to "Waiting for Decision"
 *
 * Phase 2 (reviewStatus = Decision Submitted → Waiting for Review):
 *   - Reads chosen mock option from DB
 *   - Writes full Product Design document based on the chosen approach
 *   - Sets Review Status to "Waiting for Review"
 *
 * Feedback (reviewStatus = Request Changes):
 *   - Revises Phase 2 design document based on admin feedback
 *
 * Usage:
 *   yarn agent:product-design                    # Process all pending
 *   yarn agent:product-design --id <item-id>     # Process specific item
 *   yarn agent:product-design --dry-run          # Preview without saving
 *   yarn agent:product-design --stream           # Stream Claude output
 */

import '../../shared/loadEnv';
import {
    // Config
    STATUSES,
    REVIEW_STATUSES,
    // Prompts
    buildProductDesignPrompt,
    buildProductDesignRevisionPrompt,
    buildProductDesignClarificationPrompt,
    buildProductDesignPostSelectionPrompt,
    // Output schemas
    PRODUCT_DESIGN_PHASE1_OUTPUT_FORMAT,
    PRODUCT_DESIGN_PHASE2_OUTPUT_FORMAT,
    // CLI & Batch
    createCLI,
    runBatch,
    // Design Agent Processor
    createDesignProcessor,
    // Main factory
    runAgentMain,
    // Decision utils
    toDecisionOptions,
} from '../../shared';
import type { ProductDesignOutput, MockOption, ProcessMode } from '../../shared';
import {
    readDesignDocAsync,
} from '../../lib/design-files';
import {
    logGitHubAction,
} from '../../lib/logging';
import { formatDecisionComment, saveDecisionToDB } from '@/apis/template/agent-decision/utils';
import { notifyDecisionNeeded } from '../../shared/notifications';
import type { DecisionOption, MetadataFieldConfig, RoutingConfig } from '@/apis/template/agent-decision/types';

// ============================================================
// DECISION FLOW CONFIG
// ============================================================

/** Metadata schema for product design decision options */
const DESIGN_MOCK_METADATA_SCHEMA: MetadataFieldConfig[] = [
    { key: 'approach', label: 'Approach', type: 'tag' },
];

/** Routing config: continue in Product Design after selection (Phase 2 writes the design doc) */
const DESIGN_MOCK_ROUTING: RoutingConfig = {
    metadataKey: 'approach',
    statusMap: {},
    continueAfterSelection: true,
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Convert mock options to decision options for the decision flow system
 */
function toMockDecisionOptions(mockOptions: MockOption[]): DecisionOption[] {
    return toDecisionOptions(mockOptions, opt => ({
        approach: opt.title,
    }));
}

// ============================================================
// PROCESSOR
// ============================================================

const processItem = createDesignProcessor({
    workflow: 'product-design',
    phaseName: 'Product Design',
    designType: 'product',
    agentName: 'product-design',

    // Phase 1 (new): mocks only — no design field
    // Phase 2 (post-selection) / feedback / clarification: design + comment
    outputFormat: (mode: ProcessMode) => {
        if (mode === 'new') return PRODUCT_DESIGN_PHASE1_OUTPUT_FORMAT;
        return PRODUCT_DESIGN_PHASE2_OUTPUT_FORMAT;
    },

    // Phase 1 (new) has no design field; Phase 2+ extracts 'design'
    outputDesignField: (mode: ProcessMode) => mode === 'new' ? undefined : 'design',

    // Phase 1 (new) returns Waiting for Decision; Phase 2+ returns Waiting for Review
    getCompletionReviewStatus: (mode: ProcessMode, hasDesignContent: boolean) => {
        if (mode === 'new' && !hasDesignContent) return REVIEW_STATUSES.waitingForDecision;
        return REVIEW_STATUSES.waitingForReview;
    },

    modeLabels: {
        new: 'Phase 1: Create Mocks',
        'post-selection': 'Phase 2: Write Design Doc',
        feedback: 'Address Feedback',
        clarification: 'Clarification',
    },

    progressLabels: {
        new: 'Creating design mock options',
        'post-selection': 'Writing design doc for chosen option',
        feedback: 'Revising product design',
        clarification: 'Continuing with clarification',
    },

    // Only allow writes in Phase 1 (mock pages)
    allowWrite: (mode: ProcessMode) => mode === 'new',
    allowedWritePaths: ['src/pages/design-mocks/'],

    skipBugs: true,
    skipBugMessage: `\u23ED\uFE0F  Skipping bug - bugs bypass Product Design phase\n\uD83D\uDCCC Reason: Most bugs don't need product design (they need technical fixes)\n\uD83D\uDCA1 If this bug requires UX/UI redesign, admin can manually move it to Product Design`,
    skipBugError: 'Bug reports skip Product Design by default',

    buildNewPrompt: ({ content, additionalContext, allComments }) =>
        buildProductDesignPrompt(content, additionalContext, allComments, { allowWrite: true }),

    buildFeedbackPrompt: ({ content, existingDesign, allComments }) =>
        buildProductDesignRevisionPrompt(content, existingDesign, allComments),

    buildClarificationPrompt: ({ content, issueNumber, allComments, clarification }) =>
        buildProductDesignClarificationPrompt(
            { title: content.title, number: issueNumber, body: content.body, labels: content.labels },
            allComments,
            clarification,
            { allowWrite: true },
        ),

    buildPostSelectionPrompt: ({ content, allComments, chosenOption, mockSource }) =>
        buildProductDesignPostSelectionPrompt(content, chosenOption, mockSource, allComments),

    loadAdditionalContext: async ({ issueNumber }) => {
        // Check for Product Development Document (PDD) — tries S3 first, then filesystem
        const productDevelopmentDoc = await readDesignDocAsync(issueNumber, 'product-dev');
        return productDevelopmentDoc
            ? { context: productDevelopmentDoc, label: 'Found Product Development Document (PDD) - will use as context' }
            : { context: null };
    },

    afterPR: async ({ adapter, structuredOutput, logCtx, mode, issueNumber }) => {
        const output = structuredOutput as unknown as ProductDesignOutput;
        const mockOptions = output?.mockOptions;

        // Only create decisions for Phase 1 (new) with mock options
        if (!mockOptions || mockOptions.length < 2 || mode !== 'new') {
            return;
        }

        console.log(`  Mock options: ${mockOptions.length} design options generated`);

        // Create decision for admin to choose between options
        const decisionOptions = toMockDecisionOptions(mockOptions);
        const decisionContext = `**Design Options:** ${mockOptions.length} approaches generated\n\nReview each option and select the design approach for this feature. Each option is available as an interactive mock on the PR preview deployment.\n\n**Note:** After selecting an option, the agent will write a full design document for the chosen approach.`;

        // Post decision comment on issue
        const decisionComment = formatDecisionComment(
            'product-design',
            'design-selection',
            decisionContext,
            decisionOptions,
            DESIGN_MOCK_METADATA_SCHEMA,
            undefined,
            DESIGN_MOCK_ROUTING
        );
        await adapter.addIssueComment(issueNumber, decisionComment);
        console.log('  Decision comment posted on issue');
        logGitHubAction(logCtx, 'comment', `Posted design decision with ${mockOptions.length} options`);

        // Save decision to DB
        await saveDecisionToDB(
            issueNumber,
            'product-design',
            'design-selection',
            decisionContext,
            decisionOptions,
            DESIGN_MOCK_METADATA_SCHEMA,
            undefined,
            DESIGN_MOCK_ROUTING
        );
    },

    overrideNotification: async ({ prNumber, issueNumber, content, issueType, mode, comment }) => {
        // For Phase 1 (new): send decision-needed notification
        if (mode === 'new') {
            try {
                const { getDecisionFromDB } = await import('@/apis/template/agent-decision/utils');
                const decision = await getDecisionFromDB(issueNumber, content.title);
                if (decision && decision.options.length >= 2) {
                    let previewUrl: string | null = null;
                    try {
                        const { getVercelPreviewUrl } = await import('@/agents/lib/preview-url');
                        const baseUrl = await getVercelPreviewUrl(prNumber);
                        if (baseUrl) {
                            previewUrl = `${baseUrl}/design-mocks/issue-${issueNumber}`;
                        }
                    } catch {
                        // Preview URL is optional
                    }

                    const summaryText = comment || `${decision.options.length} design options available`;
                    await notifyDecisionNeeded(
                        'Product Design',
                        content.title,
                        issueNumber,
                        summaryText,
                        decision.options.length,
                        issueType,
                        false,
                        previewUrl
                    );
                    return true;
                }
            } catch {
                // Fall through to default notification
            }
        }

        // For post-selection/feedback/clarification: use default approve notification
        return false;
    },

    dryRunExtra: (structuredOutput) => {
        const output = structuredOutput as unknown as ProductDesignOutput;
        if (output?.mockOptions && output.mockOptions.length >= 2) {
            console.log(`  [DRY RUN] Would generate mock page with ${output.mockOptions.length} options:`);
            for (const opt of output.mockOptions) {
                console.log(`    - ${opt.id}: ${opt.title}${opt.isRecommended ? ' ⭐' : ''}`);
            }
            console.log('  [DRY RUN] Would create design decision for admin selection');
        }
    },

    prTitle: (issueNumber) => `docs: product design for issue #${issueNumber}`,
    prBody: (issueNumber) => `Design document for issue #${issueNumber}

Part of #${issueNumber}

---
*Generated by Product Design Agent*`,
});

// ============================================================
// CLI
// ============================================================

async function main(): Promise<void> {
    const { options } = createCLI({
        name: 'product-design',
        displayName: 'Product Design Agent',
        description: 'Generate Product Design documents for GitHub Project items',
    });

    await runBatch(
        {
            agentStatus: STATUSES.productDesign,
            agentDisplayName: 'Product Design',
        },
        options,
        processItem,
    );
}

// Run
runAgentMain(main);
