/**
 * Bug Report Full Lifecycle E2E Test
 *
 * Tests: Bug Investigation -> Implementation -> PR Review -> Done
 *
 * Mocks AI calls (runAgent) but runs real agent wrapping code.
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

import { STATUSES, REVIEW_STATUSES } from '@/server/project-management/config';
import { resetNotifications } from './mocks/mock-notifications';
import { resetDesignFiles } from './mocks/mock-design-files';
import { setupBoundaries, teardownBoundaries, type TestBoundaries } from './testkit/setup-boundaries';
import type { MockProjectAdapter } from './mocks/mock-project-adapter';
import type { MockGitAdapter } from './mocks/mock-git-adapter';

// ============================================================
// TEST
// ============================================================

describe('Bug Report Full Lifecycle', () => {
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

    it('flows through investigation, implementation, and review to Done', async () => {
        const issueNumber = 100;
        const title = 'Login button broken';

        // 1. Seed bug in Bug Investigation
        sharedAdapter.seedIssue(issueNumber, title, 'Bug: login button does not respond to clicks', ['bug']);
        sharedAdapter.seedItem(issueNumber, STATUSES.bugInvestigation, null, ['bug']);

        // 2. Run Bug Investigator agent
        const { processItem: bugProcessItem } = await import('@/agents/core-agents/bugInvestigatorAgent');
        const bugItem = sharedAdapter.findItemByIssueNumber(issueNumber)!;

        await bugProcessItem(
            { item: bugItem, mode: 'new' },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            sharedAdapter,
        );

        // Verify: agent was called
        expect(agentCalls.some(c => c.workflow === 'bug-investigation')).toBe(true);

        // The bug investigator's canned output has autoSubmit=true, confidence=high, complexity=S, destination=implement
        // So it should auto-route to "Ready for development"
        const item2 = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item2!.status).toBe(STATUSES.implementation);

        // Verify comment was posted
        const comments = sharedAdapter.getIssueCommentsSync(issueNumber);
        expect(comments.length).toBeGreaterThan(0);

        // 3. Run Implementation agent
        gitAdapter.setImplementationAgentRan(true); // Signal that agent "made changes"
        const implItem = sharedAdapter.findItemByIssueNumber(issueNumber)!;
        const { processItem: implementProcessItem } = await import('@/agents/core-agents/implementAgent');

        await implementProcessItem(
            { item: implItem, mode: 'new' },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            sharedAdapter,
            'main',
        );

        expect(agentCalls.some(c => c.workflow === 'implementation')).toBe(true);
        const item3 = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item3!.status).toBe(STATUSES.prReview);
        expect(item3!.reviewStatus).toBe(REVIEW_STATUSES.waitingForReview);

        // 4. Run PR Review agent
        gitAdapter.setImplementationAgentRan(false); // Reset so PR review agent sees clean working dir
        const implPR = sharedAdapter.getAllPRs().find(
            pr => pr.state === 'open' && (pr.title.includes(`#${issueNumber}`) || pr.body.includes(`#${issueNumber}`))
        );
        expect(implPR).toBeTruthy();
        sharedAdapter.linkPRToIssue(implPR!.number, issueNumber);

        const { processItem: prReviewProcessItem } = await import('@/agents/core-agents/prReviewAgent');
        const reviewItem = sharedAdapter.findItemByIssueNumber(issueNumber)!;

        await prReviewProcessItem(
            { item: reviewItem, prNumber: implPR!.number, branchName: implPR!.head },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            sharedAdapter,
            'main',
        );

        expect(agentCalls.some(c => c.workflow === 'pr-review')).toBe(true);
        const item4 = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item4!.reviewStatus).toBe(REVIEW_STATUSES.approved);

        // 5. Mark as done
        await sharedAdapter.updateItemStatus(item4!.id, STATUSES.done);
        await sharedAdapter.clearItemReviewStatus(item4!.id);

        const finalItem = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(finalItem!.status).toBe(STATUSES.done);

        // 6. Verify full trace — 3 agent calls
        // bug-investigation, implementation, pr-review
        expect(agentCalls.length).toBe(3);
        expect(agentCalls.map(c => c.workflow)).toEqual([
            'bug-investigation',
            'implementation',
            'pr-review',
        ]);
    });
});
