/**
 * Request Changes E2E Tests
 *
 * Tests feedback mode flows:
 * A. Design PR request changes → revised design
 * B. PR review requests changes → implementation revision → re-review approves
 *
 * Boundary-only mocks (8 vi.mock calls):
 * - LLM (runAgent), Telegram (notifications), dev server, loadEnv,
 *   child_process, design-files, agents.config, shared/config
 *
 * Real code via DI: project-management, git-utils, workflow-db, database,
 * artifacts, phases, parsing, decision-utils, PR review prompt
 */

import { vi, describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

// ============================================================
// MODULE MOCKS — only true system boundaries (8 total)
// ============================================================

import { mockRunAgent, agentCalls, resetAgentCalls, pushAgentResponse, resetAgentOverrides, PR_REVIEW_REQUEST_CHANGES_OUTPUT } from './mocks/mock-run-agent';
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

vi.mock('@/agents/shared/notifications', () => import('./mocks/mock-notifications'));

vi.mock('@/agents/lib/devServer', () => ({
    startDevServer: vi.fn(async () => ({})),
    stopDevServer: vi.fn(async () => {}),
}));

vi.mock('@/agents/shared/loadEnv', () => ({}));

vi.mock('child_process', () => ({
    execSync: vi.fn(() => ''),
}));

vi.mock('@/agents/lib/design-files', () => import('./mocks/mock-design-files'));

vi.mock('@/agents/agents.config', () => ({
    agentsConfig: {
        useOpus: false,
        defaultLibrary: 'mock',
        workflowOverrides: {},
        modelOverrides: {},
        planSubagent: { enabled: false, timeout: 120 },
    },
}));

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
import { runProductDesignAgent, runImplementationAgentFeedback, runPRReviewAgent } from './testkit/agent-runners';
import type { MockProjectAdapter } from './mocks/mock-project-adapter';
import type { MockGitAdapter } from './mocks/mock-git-adapter';

// ============================================================
// TESTS
// ============================================================

describe('Request Changes Flows', () => {
    let boundaries: TestBoundaries;
    let adapter: MockProjectAdapter;
    let gitAdapter: MockGitAdapter;

    beforeAll(async () => {
        boundaries = await setupBoundaries();
        adapter = boundaries.adapter;
        gitAdapter = boundaries.gitAdapter;
    });

    afterAll(async () => {
        await teardownBoundaries();
    });

    beforeEach(() => {
        adapter.reset();
        adapter.init();
        resetAgentCalls();
        resetAgentOverrides();
        resetNotifications();
        resetDesignFiles();
        gitAdapter.reset();
    });

    afterEach(() => {
        adapter.reset();
        resetAgentCalls();
        resetAgentOverrides();
        resetNotifications();
        resetDesignFiles();
        gitAdapter.reset();
    });

    it('design PR request changes triggers revised design', async () => {
        const issueNumber = 50;

        // 1. Seed feature in Product Design status
        adapter.seedIssue(issueNumber, 'Add notifications', 'Feature: push notifications', ['feature']);
        adapter.seedItem(issueNumber, STATUSES.productDesign, null, ['feature']);

        // 2. Run Product Design agent → creates PR, sets Waiting for Review
        await runProductDesignAgent(adapter);

        expect(agentCalls.some(c => c.workflow === 'product-design')).toBe(true);
        const item1 = adapter.findItemByIssueNumber(issueNumber);
        expect(item1!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);

        const allPRs = adapter.getAllPRs();
        expect(allPRs.length).toBeGreaterThanOrEqual(1);
        const designPR = allPRs.find(pr => pr.title.includes(`#${issueNumber}`));
        expect(designPR).toBeTruthy();

        // 3. Admin requests changes
        await adapter.updateItemReviewStatus(item1!.id, REVIEW_STATUSES.requestChanges);

        // 4. Add feedback comment on the issue
        await adapter.addIssueComment(issueNumber, 'Please add more detail about mobile push notification handling.');

        // 5. Run Product Design agent again → batch processor detects mode='feedback'
        await runProductDesignAgent(adapter);

        // 6. Assert: agent called twice, review status back to Waiting for Review
        const productDesignCalls = agentCalls.filter(c => c.workflow === 'product-design');
        expect(productDesignCalls.length).toBe(2);

        const item2 = adapter.findItemByIssueNumber(issueNumber);
        expect(item2!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);
    });

    it('PR review request changes triggers implementation revision then re-review approves', async () => {
        const issueNumber = 51;

        // 1. Seed feature in Implementation status (skip design for brevity)
        adapter.seedIssue(issueNumber, 'Add search feature', 'Feature: full-text search', ['feature']);
        adapter.seedItem(issueNumber, STATUSES.implementation, null, ['feature']);

        // 2. Run Implementation agent → creates PR, status = PR Review
        gitAdapter.setImplementationAgentRan(true);
        const { processItem: implementProcessItem } = await import('@/agents/core-agents/implementAgent');
        const implItem = adapter.findItemByIssueNumber(issueNumber)!;

        await implementProcessItem(
            { item: implItem, mode: 'new' },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            adapter,
            'main',
        );

        expect(agentCalls.some(c => c.workflow === 'implementation')).toBe(true);
        const item1 = adapter.findItemByIssueNumber(issueNumber);
        expect(item1!.status).toBe(STATUSES.prReview);
        expect(item1!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);

        // Link PR to issue for findOpenPRForIssue
        const implPR = adapter.getAllPRs().find(
            pr => pr.state === 'open' && (pr.title.includes(`#${issueNumber}`) || pr.body.includes(`#${issueNumber}`))
        );
        expect(implPR).toBeTruthy();
        adapter.linkPRToIssue(implPR!.number, issueNumber);

        // 3. Push request_changes response for PR review
        pushAgentResponse('pr-review', PR_REVIEW_REQUEST_CHANGES_OUTPUT);

        // 4. Run PR Review agent → decision = request_changes
        gitAdapter.setImplementationAgentRan(false); // Reset so PR review sees clean working dir
        await runPRReviewAgent(issueNumber, adapter);

        const item2 = adapter.findItemByIssueNumber(issueNumber);
        expect(item2!.reviewStatus).toBe(REVIEW_STATUSES.requestChanges);

        // 5. Run Implementation agent in feedback mode → pushes to same branch
        gitAdapter.setImplementationAgentRan(true);
        await runImplementationAgentFeedback(issueNumber, adapter);

        const item3 = adapter.findItemByIssueNumber(issueNumber);
        expect(item3!.status).toBe(STATUSES.prReview);
        expect(item3!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);

        // 6. Run PR Review agent again (default canned = approved)
        gitAdapter.setImplementationAgentRan(false); // Reset for PR review
        await runPRReviewAgent(issueNumber, adapter);

        const item4 = adapter.findItemByIssueNumber(issueNumber);
        expect(item4!.reviewStatus).toBe(REVIEW_STATUSES.approved);

        // 7. Assert: 4 agent calls total
        expect(agentCalls.length).toBe(4);
        expect(agentCalls.map(c => c.workflow)).toEqual([
            'implementation',
            'pr-review',
            'implementation',
            'pr-review',
        ]);
    });
});
