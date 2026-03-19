/**
 * Multi-Phase Feature E2E Test
 *
 * Tests: Tech design outputs multiple phases → implementation creates
 * phase PRs targeting a feature branch, then advances through phases.
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

import { STATUSES } from '@/server/template/project-management/config';
import { resetNotifications } from './mocks/mock-notifications';
import { resetDesignFiles } from './mocks/mock-design-files';
import { setupBoundaries, teardownBoundaries, type TestBoundaries } from './testkit/setup-boundaries';
import { runImplementationAgent } from './testkit/agent-runners';
import type { MockProjectAdapter } from './mocks/mock-project-adapter';
import type { MockGitAdapter } from './mocks/mock-git-adapter';

// ============================================================
// TESTS
// ============================================================

describe('Multi-Phase Feature', () => {
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

    it('multi-phase feature creates sequential phase PRs targeting feature branch', async () => {
        const issueNumber = 70;

        // 1. Seed feature in Implementation status (phases already decided in tech design)
        adapter.seedIssue(issueNumber, 'Add user dashboard', 'Feature: comprehensive user dashboard', ['feature']);
        adapter.seedItem(issueNumber, STATUSES.implementation, null, ['feature']);

        // 2. Add phases comment on the issue (as if posted by tech design agent)
        // The implementation agent discovers phases from issue comments via parsePhasesFromComment
        const { formatPhasesToComment } = await import('@/agents/lib/phases');
        const phases = [
            { order: 1, name: 'Database Layer', description: 'Create schema and migrations', files: ['src/db/schema.ts'], estimatedSize: 'S' as const },
            { order: 2, name: 'API Layer', description: 'Add REST endpoints', files: ['src/api/routes.ts'], estimatedSize: 'M' as const },
            { order: 3, name: 'UI Components', description: 'Build frontend components', files: ['src/components/feature.tsx'], estimatedSize: 'S' as const },
        ];
        const phasesComment = formatPhasesToComment(phases);
        await adapter.addIssueComment(issueNumber, phasesComment);

        // 3. Run Implementation agent (Phase 1/3)
        // The agent should detect 3 phases from the issue comment,
        // create a feature branch, and create Phase 1 PR targeting the feature branch
        gitAdapter.setImplementationAgentRan(true);
        await runImplementationAgent(issueNumber, adapter);

        // Assert: Implementation Phase field set to "1/3"
        const item1 = adapter.findItemByIssueNumber(issueNumber);
        const phase1 = await adapter.getImplementationPhase(item1!.id);
        expect(phase1).toBe('1/3');

        // Assert: PR created
        const allPRs = adapter.getAllPRs();
        const phase1PR = allPRs.find(
            pr => pr.state === 'open' && (pr.title.includes(`#${issueNumber}`) || pr.body.includes(`#${issueNumber}`))
        );
        expect(phase1PR).toBeTruthy();

        // Assert: PR targets the feature branch (not main)
        expect(phase1PR!.base).toBe(`feature/task-${issueNumber}`);

        // Assert: Feature branch was created
        const featureBranchExists = await adapter.branchExists(`feature/task-${issueNumber}`);
        expect(featureBranchExists).toBe(true);

        // 4. Simulate Phase 1 merge and advance to Phase 2
        const { advanceImplementationPhase } = await import('@/server/template/workflow-service');
        await advanceImplementationPhase(issueNumber, '2/3', STATUSES.implementation);

        const phase2Check = await adapter.getImplementationPhase(item1!.id);
        expect(phase2Check).toBe('2/3');

        // 5. Run Implementation agent (Phase 2/3)
        await runImplementationAgent(issueNumber, adapter);

        // Assert: 2nd PR also targets feature branch
        const allPRs2 = adapter.getAllPRs();
        const openPRs = allPRs2.filter(pr => pr.state === 'open');
        const phase2PR = openPRs.find(pr => pr !== phase1PR);
        expect(phase2PR).toBeTruthy();
        expect(phase2PR!.base).toBe(`feature/task-${issueNumber}`);

        // 6. Simulate Phase 2 merge and advance to Phase 3
        await advanceImplementationPhase(issueNumber, '3/3', STATUSES.implementation);

        const phase3Check = await adapter.getImplementationPhase(item1!.id);
        expect(phase3Check).toBe('3/3');

        // 7. Run Implementation agent (Phase 3/3)
        await runImplementationAgent(issueNumber, adapter);

        // Assert: total 3 implementation agent calls
        const implCalls = agentCalls.filter(c => c.workflow === 'implementation');
        expect(implCalls.length).toBe(3);

        expect(agentCalls.map(c => c.workflow)).toEqual([
            'implementation',
            'implementation',
            'implementation',
        ]);
    });
});
