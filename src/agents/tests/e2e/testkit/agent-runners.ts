/**
 * Agent Runners for E2E Tests
 *
 * Wraps each agent type's execution pattern:
 * - Design agents: go through runBatch (which calls getProjectManagementAdapter internally)
 * - Implementation/PR-review/bug-investigator: call exported processItem directly
 */

import type { MockProjectAdapter } from '../mocks/mock-project-adapter';
import { STATUSES } from '@/server/project-management/config';

/**
 * Run the Product Design agent via runBatch.
 * runBatch internally calls getProjectManagementAdapter() which is mocked to return our adapter.
 */
export async function runProductDesignAgent(_adapter: MockProjectAdapter): Promise<void> {
    const { createDesignProcessor } = await import('@/agents/shared/design-agent-processor');
    const { runBatch } = await import('@/agents/shared/batch-processor');
    const { PRODUCT_DESIGN_OUTPUT_FORMAT } = await import('@/agents/shared/output-schemas');
    const {
        buildProductDesignPrompt,
        buildProductDesignRevisionPrompt,
        buildProductDesignClarificationPrompt,
    } = await import('@/agents/shared/prompts');
    const { readDesignDoc } = await import('@/agents/lib/design-files');

    const processItem = createDesignProcessor({
        workflow: 'product-design',
        phaseName: 'Product Design',
        designType: 'product',
        agentName: 'product-design',
        outputFormat: PRODUCT_DESIGN_OUTPUT_FORMAT,
        outputDesignField: 'design',
        modeLabels: { new: 'New Design', feedback: 'Address Feedback', clarification: 'Clarification' },
        progressLabels: { new: 'Generating product design', feedback: 'Revising product design', clarification: 'Continuing with clarification' },
        skipBugs: true,
        skipBugError: 'Bug reports skip Product Design by default',
        buildNewPrompt: ({ content, additionalContext, allComments }) =>
            buildProductDesignPrompt(content, additionalContext, allComments),
        buildFeedbackPrompt: ({ content, existingDesign, allComments }) =>
            buildProductDesignRevisionPrompt(content, existingDesign, allComments),
        buildClarificationPrompt: ({ content, issueNumber, allComments, clarification }) =>
            buildProductDesignClarificationPrompt(
                { title: content.title, number: issueNumber, body: content.body, labels: content.labels },
                allComments,
                clarification,
            ),
        loadAdditionalContext: async ({ issueNumber }) => {
            const productDevelopmentDoc = readDesignDoc(issueNumber, 'product-dev');
            return productDevelopmentDoc
                ? { context: productDevelopmentDoc, label: 'Found PDD' }
                : { context: null };
        },
        prTitle: (issueNumber) => `docs: product design for issue #${issueNumber}`,
        prBody: (issueNumber) => `Design document for issue #${issueNumber}\n\nPart of #${issueNumber}`,
    });

    await runBatch(
        { agentStatus: STATUSES.productDesign, agentDisplayName: 'Product Design' },
        { dryRun: false, verbose: false, stream: false, timeout: 300 },
        processItem,
    );
}

/**
 * Run the Technical Design agent via runBatch.
 */
export async function runTechDesignAgent(_adapter: MockProjectAdapter): Promise<void> {
    const { createDesignProcessor } = await import('@/agents/shared/design-agent-processor');
    const { runBatch } = await import('@/agents/shared/batch-processor');
    const { TECH_DESIGN_OUTPUT_FORMAT } = await import('@/agents/shared/output-schemas');
    const {
        buildTechDesignPrompt,
        buildTechDesignRevisionPrompt,
        buildTechDesignClarificationPrompt,
    } = await import('@/agents/shared/prompts');

    const processItem = createDesignProcessor({
        workflow: 'tech-design',
        phaseName: 'Technical Design',
        designType: 'tech',
        agentName: 'tech-design',
        outputFormat: TECH_DESIGN_OUTPUT_FORMAT,
        outputDesignField: 'design',
        modeLabels: { new: 'New Design', feedback: 'Address Feedback', clarification: 'Clarification' },
        progressLabels: { new: 'Generating technical design', feedback: 'Revising technical design', clarification: 'Continuing with clarification' },
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
        prTitle: (issueNumber) => `docs: technical design for issue #${issueNumber}`,
        prBody: (issueNumber) => `Design document for issue #${issueNumber}\n\nPart of #${issueNumber}`,
    });

    await runBatch(
        { agentStatus: STATUSES.techDesign, agentDisplayName: 'Technical Design' },
        { dryRun: false, verbose: false, stream: false, timeout: 300 },
        processItem,
    );
}

/**
 * Run the Implementation agent for a specific issue (new mode).
 */
export async function runImplementationAgent(issueNumber: number, adapter: MockProjectAdapter): Promise<void> {
    const item = adapter.findItemByIssueNumber(issueNumber);
    if (!item) throw new Error(`Item for issue #${issueNumber} not found`);

    const { processItem } = await import('@/agents/core-agents/implementAgent');

    await processItem(
        { item, mode: 'new' },
        { dryRun: false, verbose: false, stream: false, timeout: 300 },
        adapter,
        'main',
    );
}

/**
 * Run the Implementation agent in feedback mode (address PR review changes).
 */
export async function runImplementationAgentFeedback(issueNumber: number, adapter: MockProjectAdapter): Promise<void> {
    const item = adapter.findItemByIssueNumber(issueNumber);
    if (!item) throw new Error(`Item for issue #${issueNumber} not found`);

    const pr = await adapter.findOpenPRForIssue(issueNumber);
    if (!pr) throw new Error(`No open PR for issue #${issueNumber}`);

    const { processItem } = await import('@/agents/core-agents/implementAgent');

    await processItem(
        { item, mode: 'feedback', prNumber: pr.prNumber, branchName: pr.branchName },
        { dryRun: false, verbose: false, stream: false, timeout: 300 },
        adapter,
        'main',
    );
}

/**
 * Run the PR Review agent for a specific issue.
 */
export async function runPRReviewAgent(issueNumber: number, adapter: MockProjectAdapter): Promise<void> {
    const item = adapter.findItemByIssueNumber(issueNumber);
    if (!item) throw new Error(`Item for issue #${issueNumber} not found`);

    const pr = await adapter.findOpenPRForIssue(issueNumber);
    if (!pr) throw new Error(`No open PR for issue #${issueNumber}`);

    const { processItem } = await import('@/agents/core-agents/prReviewAgent');

    await processItem(
        { item, prNumber: pr.prNumber, branchName: pr.branchName },
        { dryRun: false, verbose: false, stream: false, timeout: 300 },
        adapter,
        'main',
    );
}

/**
 * Run the Bug Investigator agent for a specific issue.
 */
export async function runBugInvestigatorAgent(issueNumber: number, adapter: MockProjectAdapter): Promise<void> {
    const item = adapter.findItemByIssueNumber(issueNumber);
    if (!item) throw new Error(`Item for issue #${issueNumber} not found`);

    const { processItem } = await import('@/agents/core-agents/bugInvestigatorAgent');

    await processItem(
        { item, mode: 'new' },
        { dryRun: false, verbose: false, stream: false, timeout: 300 },
        adapter,
    );
}
