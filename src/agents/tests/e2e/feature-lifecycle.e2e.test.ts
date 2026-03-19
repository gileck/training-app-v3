/**
 * Feature Request Full Lifecycle E2E Test
 *
 * Tests the complete pipeline: Backlog -> Product Design -> Tech Design
 * -> Implementation -> PR Review -> Done
 *
 * Mocks AI calls (runAgent) but runs real agent wrapping code:
 * prompt building, output parsing, PR creation, status transitions, notifications.
 *
 * Boundary-only mocks (8 vi.mock calls):
 * - LLM (runAgent), Telegram (notifications), dev server, loadEnv,
 *   child_process, design-files, agents.config, shared/config
 *
 * Real code via DI: project-management, git-utils, workflow-db, database,
 * artifacts, phases, parsing, playwright-mcp, decision-utils, PR review prompt
 */

import { vi, describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

// ============================================================
// MODULE MOCKS — only true system boundaries (8 total)
// ============================================================

// 1. Mock the AI engine (LLM boundary)
import { mockRunAgent, agentCalls, resetAgentCalls } from './mocks/mock-run-agent';
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

// ============================================================
// IMPORTS — after mocks
// ============================================================

import { STATUSES, REVIEW_STATUSES } from '@/server/template/project-management/config';
import { resetNotifications } from './mocks/mock-notifications';
import { resetDesignFiles } from './mocks/mock-design-files';
import { setupBoundaries, teardownBoundaries, type TestBoundaries } from './testkit/setup-boundaries';
import type { MockProjectAdapter } from './mocks/mock-project-adapter';
import type { MockGitAdapter } from './mocks/mock-git-adapter';

// ============================================================
// TEST
// ============================================================

describe('Feature Request Full Lifecycle', () => {
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
        resetNotifications();
        resetDesignFiles();
        gitAdapter.reset();
    });

    afterEach(() => {
        sharedAdapter.reset();
        resetAgentCalls();
        resetNotifications();
        resetDesignFiles();
        gitAdapter.reset();
    });

    it('flows through all pipeline stages to Done', async () => {
        const issueNumber = 42;
        const title = 'Add dark mode';

        // 1. Seed feature request
        sharedAdapter.seedIssue(issueNumber, title, 'Feature: add dark mode support', ['feature']);
        sharedAdapter.seedItem(issueNumber, STATUSES.productDesign, null, ['feature']);

        // 2. Verify item is in Product Design
        const item1 = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item1).toBeTruthy();
        expect(item1!.status).toBe(STATUSES.productDesign);

        // 3. Run Product Design agent (via runBatch -> createDesignProcessor)
        const { runBatch } = await import('@/agents/shared/batch-processor');
        const { createDesignProcessor } = await import('@/agents/shared/design-agent-processor');
        const { PRODUCT_DESIGN_OUTPUT_FORMAT } = await import('@/agents/shared/output-schemas');

        const productDesignProcessor = createDesignProcessor({
            workflow: 'product-design',
            phaseName: 'Product Design',
            designType: 'product',
            agentName: 'product-design',
            outputFormat: PRODUCT_DESIGN_OUTPUT_FORMAT,
            outputDesignField: 'design',
            modeLabels: { new: 'New Design', feedback: 'Address Feedback', clarification: 'Clarification' },
            progressLabels: { new: 'Generating', feedback: 'Revising', clarification: 'Continuing' },
            buildNewPrompt: () => 'Create product design',
            buildFeedbackPrompt: () => 'Revise product design',
            buildClarificationPrompt: () => 'Continue product design',
            prTitle: (n) => `docs: product design for issue #${n}`,
            prBody: (n) => `Part of #${n}`,
        });

        await runBatch(
            { agentStatus: STATUSES.productDesign, agentDisplayName: 'Product Design' },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            productDesignProcessor,
        );

        // Verify: agent was called, review status set, PR created
        expect(agentCalls.some(c => c.workflow === 'product-design')).toBe(true);
        const item2 = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item2!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);
        const allPRs = sharedAdapter.getAllPRs();
        expect(allPRs.length).toBeGreaterThanOrEqual(1);
        const designPR = allPRs.find(pr => pr.title.includes(`#${issueNumber}`));
        expect(designPR).toBeTruthy();

        // 4. Admin approves -> auto-advance to Tech Design
        await sharedAdapter.updateItemReviewStatus(item2!.id, REVIEW_STATUSES.approved);

        // Simulate auto-advance: approved Product Design -> Technical Design
        await sharedAdapter.updateItemStatus(item2!.id, STATUSES.techDesign);
        await sharedAdapter.clearItemReviewStatus(item2!.id);

        const item3 = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item3!.status).toBe(STATUSES.techDesign);
        expect(item3!.reviewStatus).toBeNull();

        // 5. Run Tech Design agent
        const { TECH_DESIGN_OUTPUT_FORMAT } = await import('@/agents/shared/output-schemas');

        const techDesignProcessor = createDesignProcessor({
            workflow: 'tech-design',
            phaseName: 'Technical Design',
            designType: 'tech',
            agentName: 'tech-design',
            outputFormat: TECH_DESIGN_OUTPUT_FORMAT,
            outputDesignField: 'design',
            modeLabels: { new: 'New Design', feedback: 'Address Feedback', clarification: 'Clarification' },
            progressLabels: { new: 'Generating', feedback: 'Revising', clarification: 'Continuing' },
            buildNewPrompt: () => 'Create tech design',
            buildFeedbackPrompt: () => 'Revise tech design',
            buildClarificationPrompt: () => 'Continue tech design',
            prTitle: (n) => `docs: technical design for issue #${n}`,
            prBody: (n) => `Part of #${n}`,
        });

        await runBatch(
            { agentStatus: STATUSES.techDesign, agentDisplayName: 'Technical Design' },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            techDesignProcessor,
        );

        expect(agentCalls.some(c => c.workflow === 'tech-design')).toBe(true);
        const item4 = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item4!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);

        // 6. Admin approves -> auto-advance to Implementation
        await sharedAdapter.updateItemReviewStatus(item4!.id, REVIEW_STATUSES.approved);
        await sharedAdapter.updateItemStatus(item4!.id, STATUSES.implementation);
        await sharedAdapter.clearItemReviewStatus(item4!.id);

        const item5 = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item5!.status).toBe(STATUSES.implementation);

        // 7. Run Implementation agent
        gitAdapter.setImplementationAgentRan(true); // Signal that agent "made changes"
        const { processItem: implementProcessItem } = await import('@/agents/core-agents/implementAgent');

        await implementProcessItem(
            { item: item5!, mode: 'new' },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            sharedAdapter,
            'main',
        );

        expect(agentCalls.some(c => c.workflow === 'implementation')).toBe(true);
        const item6 = sharedAdapter.findItemByIssueNumber(issueNumber);
        // After implementation, status should be PR Review with Waiting for Review
        expect(item6!.status).toBe(STATUSES.prReview);
        expect(item6!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);

        // 8. Run PR Review agent
        gitAdapter.setImplementationAgentRan(false); // Reset so PR review agent sees clean working dir
        const implPR = sharedAdapter.getAllPRs().find(
            pr => pr.state === 'open' && (pr.title.includes(`#${issueNumber}`) || pr.body.includes(`#${issueNumber}`))
        );
        expect(implPR).toBeTruthy();

        // Link PR to issue so findOpenPRForIssue works
        sharedAdapter.linkPRToIssue(implPR!.number, issueNumber);

        const { processItem: prReviewProcessItem } = await import('@/agents/core-agents/prReviewAgent');

        await prReviewProcessItem(
            { item: item6!, prNumber: implPR!.number, branchName: implPR!.head },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            sharedAdapter,
            'main',
        );

        expect(agentCalls.some(c => c.workflow === 'pr-review')).toBe(true);
        const item7 = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item7!.reviewStatus).toBe(REVIEW_STATUSES.approved);

        // 9. Mark as done
        await sharedAdapter.updateItemStatus(item7!.id, STATUSES.done);
        await sharedAdapter.clearItemReviewStatus(item7!.id);

        const finalItem = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(finalItem!.status).toBe(STATUSES.done);

        // 10. Verify full trace — 4 agent calls total
        // product-design, tech-design, implementation, pr-review
        expect(agentCalls.length).toBe(4);
        expect(agentCalls.map(c => c.workflow)).toEqual([
            'product-design',
            'tech-design',
            'implementation',
            'pr-review',
        ]);
    });
});
