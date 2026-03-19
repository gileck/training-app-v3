/**
 * Clarification Flow E2E Test
 *
 * Tests: Design agent needs clarification → admin responds → agent continues
 *
 * When the agent outputs needsClarification: true, the item goes to
 * "Waiting for Clarification". After admin responds, it becomes
 * "Clarification Received" and the agent re-runs in mode='clarification'.
 *
 * Boundary-only mocks (8 vi.mock calls):
 * - LLM (runAgent), Telegram (notifications), dev server, loadEnv,
 *   child_process, design-files, agents.config, shared/config
 *
 * Real code via DI: project-management, git-utils, workflow-db, database,
 * artifacts, phases, parsing, decision-utils
 */

import { vi, describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

// ============================================================
// MODULE MOCKS — only true system boundaries (8 total)
// ============================================================

import { mockRunAgent, agentCalls, resetAgentCalls, pushAgentResponse, resetAgentOverrides, CLARIFICATION_OUTPUT } from './mocks/mock-run-agent';
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
import { resetNotifications, capturedNotifications } from './mocks/mock-notifications';
import { resetDesignFiles } from './mocks/mock-design-files';
import { setupBoundaries, teardownBoundaries, type TestBoundaries } from './testkit/setup-boundaries';
import { runProductDesignAgent } from './testkit/agent-runners';
import type { MockProjectAdapter } from './mocks/mock-project-adapter';
import type { MockGitAdapter } from './mocks/mock-git-adapter';

// ============================================================
// TESTS
// ============================================================

describe('Clarification Flow', () => {
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

    it('design agent needs clarification, admin responds, agent continues', async () => {
        const issueNumber = 60;

        // 1. Seed feature in Product Design status
        adapter.seedIssue(issueNumber, 'Add dark mode', 'Feature: dark mode support', ['feature']);
        adapter.seedItem(issueNumber, STATUSES.productDesign, null, ['feature']);

        // 2. Push clarification output for first product-design call
        pushAgentResponse('product-design', CLARIFICATION_OUTPUT);

        // 3. Run Product Design agent → detects needsClarification: true
        await runProductDesignAgent(adapter);

        // 4. Assert: review status = Waiting for Clarification
        const item1 = adapter.findItemByIssueNumber(issueNumber);
        expect(item1!.reviewStatus).toBe(REVIEW_STATUSES.waitingForClarification);

        // Assert: clarification comment posted on issue
        const comments1 = adapter.getIssueCommentsSync(issueNumber);
        const clarificationComment = comments1.find(c => c.body.includes('Clarification'));
        expect(clarificationComment).toBeTruthy();

        // Assert: notification sent
        expect(capturedNotifications.some(n => n.fn === 'notifyAgentNeedsClarification')).toBe(true);

        // 5. Simulate admin response: add answer comment and set Clarification Received
        await adapter.addIssueComment(issueNumber, 'Full app dark mode is preferred. Apply to all UI including sidebar.');
        await adapter.updateItemReviewStatus(item1!.id, REVIEW_STATUSES.clarificationReceived);

        // 6. Run Product Design agent again → default canned output (normal design)
        //    Batch processor detects mode='clarification' from Clarification Received status
        await runProductDesignAgent(adapter);

        // 7. Assert: review status = Waiting for Review (normal completion)
        const item2 = adapter.findItemByIssueNumber(issueNumber);
        expect(item2!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);

        // Assert: 2 agent calls total
        const productDesignCalls = agentCalls.filter(c => c.workflow === 'product-design');
        expect(productDesignCalls.length).toBe(2);

        // Assert: PR created (from the second successful run)
        const allPRs = adapter.getAllPRs();
        const designPR = allPRs.find(pr => pr.title.includes(`#${issueNumber}`));
        expect(designPR).toBeTruthy();
    });
});
