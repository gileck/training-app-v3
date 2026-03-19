/**
 * Design Mock Decision E2E Test
 *
 * Tests the product design mock generation and decision flow where:
 * - Product design agent generates mock options (2-3 React components)
 * - Decision is created for admin to select a design approach
 * - Admin submits decision, selected design is copied to canonical S3 key
 * - Next agent (tech design) reads chosen design from S3
 *
 * Boundary-only mocks (9 total):
 * - LLM (runAgent), Telegram (notifications), dev server, loadEnv,
 *   child_process, design-files, agents.config, shared/config, S3 SDK
 */

import { vi, describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

// ============================================================
// MODULE MOCKS — only true system boundaries (9 total)
// ============================================================

// 1. Mock the AI engine (LLM boundary)
import { mockRunAgent, agentCalls, resetAgentCalls, pushAgentResponse, resetAgentOverrides, PRODUCT_DESIGN_MOCK_OPTIONS_OUTPUT } from './mocks/mock-run-agent';
vi.mock('@/agents/lib', async (importOriginal) => {
    const original = await importOriginal() as Record<string, unknown>;
    return {
        ...original,
        runAgent: mockRunAgent,
        getAgentLibrary: vi.fn(async () => ({})),
        getModelForWorkflow: vi.fn(async () => 'mock-model'),
        getLibraryForWorkflow: vi.fn(() => 'mock-library'),
        disposeAllAdapters: vi.fn(async () => {}),
        registerAdapter: vi.fn(),
        extractMarkdown: original.extractMarkdown,
        extractJSON: original.extractJSON,
    };
});

// 2. Mock notifications (Telegram HTTP boundary)
vi.mock('@/agents/shared/notifications', () => import('./mocks/mock-notifications'));

// 3. Mock dev server (external process boundary)
vi.mock('@/agents/lib/devServer', () => ({
    startDevServer: vi.fn(async () => ({})),
    stopDevServer: vi.fn(async () => {}),
}));

// 4. Mock loadEnv (side-effect import)
vi.mock('@/agents/shared/loadEnv', () => ({}));

// 5. Mock execSync for implement agent's runYarnChecks
vi.mock('child_process', () => ({
    execSync: vi.fn(() => ''),
}));

// 6. Mock design files (filesystem boundary)
vi.mock('@/agents/lib/design-files', () => import('./mocks/mock-design-files'));

// 7. Mock agents.config (requires env vars not available in tests)
vi.mock('@/agents/agents.config', () => ({
    agentsConfig: {
        useOpus: false,
        defaultLibrary: 'mock',
        workflowOverrides: {},
        modelOverrides: {},
        planSubagent: { enabled: false, timeout: 120 },
    },
}));

// 8. Mock shared/config (requires env vars not available in tests)
vi.mock('@/agents/shared/config', async (importOriginal) => {
    const original = await importOriginal() as Record<string, unknown>;
    return {
        ...original,
        agentConfig: {
            telegram: { enabled: false },
            claude: { model: 'sonnet', maxTurns: 10, timeoutSeconds: 300 },
            localTesting: { enabled: false, devServerStartupTimeout: 30, testTimeout: 60, maxTurns: 5 },
        },
    };
});

// 9. Mock S3 SDK (AWS boundary) — used by productDesignAgent for option uploads
vi.mock('@/server/template/s3/sdk', () => import('./mocks/mock-s3-sdk'));

// ============================================================
// IMPORTS — after mocks
// ============================================================

import { STATUSES, REVIEW_STATUSES } from '@/server/template/project-management/config';
import { resetNotifications, capturedNotifications } from './mocks/mock-notifications';
import { resetDesignFiles, getS3Docs } from './mocks/mock-design-files';
import { resetS3Storage, getS3Content } from './mocks/mock-s3-sdk';
import { setupBoundaries, teardownBoundaries, type TestBoundaries } from './testkit/setup-boundaries';
import { workflowItems } from '@/server/database';
import type { MockProjectAdapter } from './mocks/mock-project-adapter';
import type { MockGitAdapter } from './mocks/mock-git-adapter';

// ============================================================
// TEST
// ============================================================

describe('Design Mock Decision Flow', () => {
    let boundaries: TestBoundaries;
    let sharedAdapter: MockProjectAdapter;
    let gitAdapter: MockGitAdapter;

    beforeAll(async () => {
        boundaries = await setupBoundaries();
        sharedAdapter = boundaries.adapter;
        gitAdapter = boundaries.gitAdapter;
    });

    afterAll(async () => {
        await teardownBoundaries();
    });

    beforeEach(() => {
        sharedAdapter.reset();
        sharedAdapter.init();
        resetAgentCalls();
        resetAgentOverrides();
        resetNotifications();
        resetDesignFiles();
        resetS3Storage();
        gitAdapter.reset();
    });

    afterEach(() => {
        sharedAdapter.reset();
        resetAgentCalls();
        resetAgentOverrides();
        resetNotifications();
        resetDesignFiles();
        resetS3Storage();
        gitAdapter.reset();
    });

    /**
     * Helper: seed adapter + workflow-items DB for a given issue.
     * The workflow-items DB document is required for saveDecisionToDB/getDecisionFromDB to work.
     */
    async function seedWorkflowItem(issueNumber: number, title: string, status: string, reviewStatus: string | null = null) {
        sharedAdapter.seedIssue(issueNumber, title, `Description for ${title}`, ['feature']);
        sharedAdapter.seedItem(issueNumber, status, reviewStatus, ['feature']);

        await workflowItems.createWorkflowItem({
            type: 'feature',
            title,
            status,
            reviewStatus: reviewStatus || undefined,
            githubIssueNumber: issueNumber,
            githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
            githubIssueTitle: title,
            labels: ['feature'],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    it('agent creates decision with mock options', async () => {
        const issueNumber = 200;
        const title = 'Add search feature';

        // Seed feature in Product Design
        sharedAdapter.seedIssue(issueNumber, title, 'Feature: add search', ['feature']);
        sharedAdapter.seedItem(issueNumber, STATUSES.productDesign, null, ['feature']);

        // Push mock options output for product-design workflow
        pushAgentResponse('product-design', PRODUCT_DESIGN_MOCK_OPTIONS_OUTPUT);

        // Run Product Design agent
        const { runBatch } = await import('@/agents/shared/batch-processor');
        const { createDesignProcessor } = await import('@/agents/shared/design-agent-processor');
        const { PRODUCT_DESIGN_OUTPUT_FORMAT } = await import('@/agents/shared/output-schemas');

        // Use a simplified processor (without the full afterPR hook) to test basic flow
        // The real agent uses afterPR for mock generation + decision creation
        const processor = createDesignProcessor({
            workflow: 'product-design',
            phaseName: 'Product Design',
            designType: 'product',
            agentName: 'product-design',
            outputFormat: PRODUCT_DESIGN_OUTPUT_FORMAT,
            outputDesignField: 'design',
            modeLabels: { new: 'New', feedback: 'Feedback', clarification: 'Clarification' },
            progressLabels: { new: 'Generating', feedback: 'Revising', clarification: 'Continuing' },
            buildNewPrompt: () => 'Create product design with mock options',
            buildFeedbackPrompt: () => 'Revise',
            buildClarificationPrompt: () => 'Continue',
            afterPR: async ({ adapter, structuredOutput, issueNumber: num }) => {
                // Simplified afterPR hook for testing decision creation
                const output = structuredOutput as { mockOptions?: Array<{ id: string; title: string; description: string; isRecommended: boolean }> };
                const mockOptions = output?.mockOptions;
                if (!mockOptions || mockOptions.length < 2) return;

                const { formatDecisionComment, saveDecisionToDB } = await import('@/apis/template/agent-decision/utils');
                const decisionOptions = mockOptions.map(opt => ({
                    id: opt.id,
                    title: opt.title,
                    description: opt.description,
                    isRecommended: opt.isRecommended,
                    metadata: { approach: opt.title },
                }));

                const metadataSchema = [{ key: 'approach', label: 'Approach', type: 'tag' as const }];
                const routing = { metadataKey: 'approach', statusMap: {} };

                const decisionComment = formatDecisionComment(
                    'product-design', 'design-selection', 'Choose a design', decisionOptions, metadataSchema, undefined, routing
                );
                await adapter.addIssueComment(num, decisionComment);
                await saveDecisionToDB(num, 'product-design', 'design-selection', 'Choose a design', decisionOptions, metadataSchema, undefined, routing);

                // Save option designs to S3 (via mock S3 SDK)
                const { uploadFile } = await import('@/server/template/s3/sdk');
                for (const opt of mockOptions) {
                    await uploadFile({
                        content: `# ${opt.title}\n\n${opt.description}`,
                        fileName: `design-docs/issue-${num}/product-design-${opt.id}.md`,
                        contentType: 'text/markdown',
                    });
                }
            },
            prTitle: (n) => `docs: product design for issue #${n}`,
            prBody: (n) => `Part of #${n}`,
        });

        await runBatch(
            { agentStatus: STATUSES.productDesign, agentDisplayName: 'Product Design' },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            processor,
        );

        // Verify agent was called
        expect(agentCalls.some(c => c.workflow === 'product-design')).toBe(true);

        // Verify decision comment was posted on issue
        const comments = sharedAdapter.getIssueCommentsSync(issueNumber);
        const decisionComment = comments.find(c => c.body.includes('AGENT_DECISION_V1'));
        expect(decisionComment).toBeTruthy();
        expect(decisionComment!.body).toContain('design-selection');

        // Verify design was saved to S3
        const s3Docs = getS3Docs();
        expect(s3Docs.has(`${issueNumber}:product`)).toBe(true);

        // Verify option designs were saved to S3 (via SDK mock)
        const optAContent = getS3Content(`design-docs/issue-${issueNumber}/product-design-optA.md`);
        expect(optAContent).toBeTruthy();
        expect(optAContent).toContain('Card Grid Layout');

        const optBContent = getS3Content(`design-docs/issue-${issueNumber}/product-design-optB.md`);
        expect(optBContent).toBeTruthy();
        expect(optBContent).toContain('List with Filters');
    });

    it('admin selects option via decision and item is routed', async () => {
        const issueNumber = 201;
        const title = 'Add dashboard';

        // Seed feature in Product Design with Waiting for Review (adapter + MongoDB)
        await seedWorkflowItem(issueNumber, title, STATUSES.productDesign, REVIEW_STATUSES.waitingForReview);

        // Save decision to DB (as if agent had run)
        const { saveDecisionToDB } = await import('@/apis/template/agent-decision/utils');
        const decisionOptions = [
            { id: 'optA', title: 'Card Layout', description: 'Card grid for metrics', isRecommended: true, metadata: { approach: 'Card Layout' } },
            { id: 'optB', title: 'Table Layout', description: 'Tabular data view', isRecommended: false, metadata: { approach: 'Table Layout' } },
        ];
        await saveDecisionToDB(
            issueNumber, 'product-design', 'design-selection', 'Choose a design',
            decisionOptions,
            [{ key: 'approach', label: 'Approach', type: 'tag' }],
            undefined,
            { metadataKey: 'approach', statusMap: { 'Card Layout': 'Technical Design', 'Table Layout': 'Technical Design' } }
        );

        // Submit decision selecting optB
        const { submitDecision } = await import('@/apis/template/agent-decision/handlers/submitDecision');
        const { generateDecisionToken } = await import('@/apis/template/agent-decision/utils');
        const token = generateDecisionToken(issueNumber);

        const result = await submitDecision({
            issueNumber,
            token,
            selection: { selectedOptionId: 'optB' },
        });

        expect(result.success).toBe(true);
        expect(result.routedTo).toBe('Technical Design');

        // Verify status advanced to Tech Design
        const item = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item!.status).toBe(STATUSES.techDesign);
    });

    it('choose recommended option works for product design decisions', async () => {
        const issueNumber = 202;
        const title = 'Add profile page';

        // Seed adapter + MongoDB
        await seedWorkflowItem(issueNumber, title, STATUSES.productDesign, REVIEW_STATUSES.waitingForReview);

        // Save decision to DB with optA as recommended
        const { saveDecisionToDB, generateDecisionToken } = await import('@/apis/template/agent-decision/utils');
        await saveDecisionToDB(
            issueNumber, 'product-design', 'design-selection', 'Choose a design',
            [
                { id: 'optA', title: 'Minimal Profile', description: 'Clean minimal', isRecommended: true, metadata: { approach: 'Minimal' } },
                { id: 'optB', title: 'Rich Profile', description: 'Feature-rich', isRecommended: false, metadata: { approach: 'Rich' } },
            ],
            [{ key: 'approach', label: 'Approach', type: 'tag' }],
            undefined,
            { metadataKey: 'approach', statusMap: { 'Minimal': 'Technical Design', 'Rich': 'Technical Design' } }
        );

        // Submit with chooseRecommended
        const { submitDecision } = await import('@/apis/template/agent-decision/handlers/submitDecision');
        const token = generateDecisionToken(issueNumber);

        const result = await submitDecision({
            issueNumber,
            token,
            selection: { chooseRecommended: true },
        });

        expect(result.success).toBe(true);
        expect(result.routedTo).toBe('Technical Design');

        // Verify status advanced to Tech Design
        const item = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item!.status).toBe(STATUSES.techDesign);
    });

    it('decision notification sent instead of approve notification', async () => {
        const issueNumber = 203;
        const title = 'Add settings page';

        // Seed feature in Product Design (adapter + MongoDB)
        // MongoDB workflow item is needed so saveDecisionToDB works inside afterPR hook
        await seedWorkflowItem(issueNumber, title, STATUSES.productDesign);

        // Push mock options output
        pushAgentResponse('product-design', PRODUCT_DESIGN_MOCK_OPTIONS_OUTPUT);

        // Run with a processor that has overrideNotification
        const { runBatch } = await import('@/agents/shared/batch-processor');
        const { createDesignProcessor } = await import('@/agents/shared/design-agent-processor');
        const { PRODUCT_DESIGN_OUTPUT_FORMAT } = await import('@/agents/shared/output-schemas');

        const processor = createDesignProcessor({
            workflow: 'product-design',
            phaseName: 'Product Design',
            designType: 'product',
            agentName: 'product-design',
            outputFormat: PRODUCT_DESIGN_OUTPUT_FORMAT,
            outputDesignField: 'design',
            modeLabels: { new: 'New', feedback: 'Feedback', clarification: 'Clarification' },
            progressLabels: { new: 'Generating', feedback: 'Revising', clarification: 'Continuing' },
            buildNewPrompt: () => 'Create product design',
            buildFeedbackPrompt: () => 'Revise',
            buildClarificationPrompt: () => 'Continue',
            afterPR: async ({ structuredOutput, issueNumber: num }) => {
                const output = structuredOutput as { mockOptions?: Array<{ id: string; title: string; description: string; isRecommended: boolean }> };
                const mockOptions = output?.mockOptions;
                if (!mockOptions || mockOptions.length < 2) return;

                const { saveDecisionToDB } = await import('@/apis/template/agent-decision/utils');
                const decisionOptions = mockOptions.map(opt => ({
                    id: opt.id, title: opt.title, description: opt.description,
                    isRecommended: opt.isRecommended, metadata: { approach: opt.title },
                }));
                await saveDecisionToDB(num, 'product-design', 'design-selection', 'Choose', decisionOptions,
                    [{ key: 'approach', label: 'Approach', type: 'tag' as const }], undefined, { metadataKey: 'approach', statusMap: {} });
            },
            overrideNotification: async ({ issueNumber: num, content, issueType }) => {
                const { getDecisionFromDB } = await import('@/apis/template/agent-decision/utils');
                const { notifyDecisionNeeded } = await import('@/agents/shared/notifications');
                const decision = await getDecisionFromDB(num, content.title);
                if (decision && decision.options.length >= 2) {
                    await notifyDecisionNeeded('Product Design', content.title, num, 'Options available', decision.options.length, issueType, false);
                    return true;
                }
                return false;
            },
            prTitle: (n) => `docs: product design for issue #${n}`,
            prBody: (n) => `Part of #${n}`,
        });

        await runBatch(
            { agentStatus: STATUSES.productDesign, agentDisplayName: 'Product Design' },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            processor,
        );

        // Verify decision-needed notification was sent (not design-pr-ready)
        const decisionNotif = capturedNotifications.find(n => n.fn === 'notifyDecisionNeeded');
        expect(decisionNotif).toBeTruthy();

        // Verify NO approve notification was sent
        const approveNotif = capturedNotifications.find(n => n.fn === 'notifyDesignPRReady');
        expect(approveNotif).toBeFalsy();
    });
});
