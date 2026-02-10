/**
 * Multi-Agent Flow E2E Test
 *
 * Tests auto-advance moves items through the full pipeline using
 * workflow-service functions (autoAdvanceApproved, markDone) against
 * real MongoDB.
 *
 * Boundary-only mocks (8 vi.mock calls):
 * - LLM (runAgent), Telegram (notifications), dev server, loadEnv,
 *   child_process, design-files, agents.config, shared/config
 *
 * Real code via DI: project-management, git-utils, workflow-db, database,
 * artifacts, phases, parsing, decision-utils, workflow-service
 */

import { vi, describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

// ============================================================
// MODULE MOCKS — only true system boundaries (8 total)
// ============================================================

import { mockRunAgent, agentCalls, resetAgentCalls, resetAgentOverrides } from './mocks/mock-run-agent';
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

import { STATUSES, REVIEW_STATUSES } from '@/server/project-management/config';
import { resetNotifications } from './mocks/mock-notifications';
import { resetDesignFiles } from './mocks/mock-design-files';
import { setupBoundaries, teardownBoundaries, type TestBoundaries } from './testkit/setup-boundaries';
import { runProductDesignAgent, runTechDesignAgent, runImplementationAgent, runPRReviewAgent } from './testkit/agent-runners';
import type { MockProjectAdapter } from './mocks/mock-project-adapter';
import type { MockGitAdapter } from './mocks/mock-git-adapter';

// ============================================================
// TESTS
// ============================================================

describe('Multi-Agent Auto-Advance Flow', () => {
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

    it('auto-advance moves items through the full pipeline', async () => {
        const issueNumber = 80;

        // 1. Seed feature in Product Design status
        adapter.seedIssue(issueNumber, 'Add user profiles', 'Feature: user profile pages', ['feature']);
        adapter.seedItem(issueNumber, STATUSES.productDesign, null, ['feature']);

        // 2. Run Product Design → Waiting for Review
        await runProductDesignAgent(adapter);
        const item1 = adapter.findItemByIssueNumber(issueNumber);
        expect(item1!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);

        // 3. Admin approves
        await adapter.updateItemReviewStatus(item1!.id, REVIEW_STATUSES.approved);

        // 4. Call autoAdvanceApproved() → item advances to Tech Design
        const { autoAdvanceApproved } = await import('@/server/workflow-service');
        await autoAdvanceApproved();

        const item2 = adapter.findItemByIssueNumber(issueNumber);
        expect(item2!.status).toBe(STATUSES.techDesign);
        expect(item2!.reviewStatus).toBeNull();

        // 5. Run Tech Design → Waiting for Review
        await runTechDesignAgent(adapter);
        const item3 = adapter.findItemByIssueNumber(issueNumber);
        expect(item3!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);

        // 6. Admin approves
        await adapter.updateItemReviewStatus(item3!.id, REVIEW_STATUSES.approved);

        // 7. Call autoAdvanceApproved() → item advances to Implementation
        await autoAdvanceApproved();

        const item4 = adapter.findItemByIssueNumber(issueNumber);
        expect(item4!.status).toBe(STATUSES.implementation);
        expect(item4!.reviewStatus).toBeNull();

        // 8. Run Implementation → PR Review
        gitAdapter.setImplementationAgentRan(true);
        await runImplementationAgent(issueNumber, adapter);

        const item5 = adapter.findItemByIssueNumber(issueNumber);
        expect(item5!.status).toBe(STATUSES.prReview);
        expect(item5!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);

        // Link PR to issue for findOpenPRForIssue
        const implPR = adapter.getAllPRs().find(
            pr => pr.state === 'open' && (pr.title.includes(`#${issueNumber}`) || pr.body.includes(`#${issueNumber}`))
        );
        expect(implPR).toBeTruthy();
        adapter.linkPRToIssue(implPR!.number, issueNumber);

        // 9. Run PR Review → Approved
        gitAdapter.setImplementationAgentRan(false);
        await runPRReviewAgent(issueNumber, adapter);

        const item6 = adapter.findItemByIssueNumber(issueNumber);
        expect(item6!.reviewStatus).toBe(REVIEW_STATUSES.approved);

        // 10. Mark done
        const { markDone } = await import('@/server/workflow-service');
        await markDone(issueNumber);

        const finalItem = adapter.findItemByIssueNumber(issueNumber);
        expect(finalItem!.status).toBe(STATUSES.done);

        // 11. Assert: full agent call trace
        expect(agentCalls.length).toBe(4);
        expect(agentCalls.map(c => c.workflow)).toEqual([
            'product-design',
            'tech-design',
            'implementation',
            'pr-review',
        ]);

        // 12. Assert: auto-advance worked (status transitions verified above)
        // Note: Telegram notifications are disabled in test config, so we verify
        // the transitions happened correctly rather than checking notification calls
    });
});
