/**
 * Workflow Service Actions E2E Tests
 *
 * Tests the workflow-service functions added in phases 1-3:
 * reviewDesign, requestChangesOnPR, mergeDesignPR,
 * mergeImplementationPR, revertMerge, mergeRevertPR, undoStatusChange.
 *
 * Boundary-only mocks (8 vi.mock calls):
 * - LLM (runAgent), Telegram (notifications), dev server, loadEnv,
 *   child_process, design-files, agents.config, shared/config
 *
 * Real code via DI: project-management, workflow-db, database,
 * artifacts, phases, parsing, workflow-service
 */

import { vi, describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

// ============================================================
// MODULE MOCKS — only true system boundaries (8 total)
// ============================================================

import { mockRunAgent, resetAgentCalls, resetAgentOverrides } from './mocks/mock-run-agent';
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
import {
    reviewDesign,
    requestChangesOnPR,
    mergeImplementationPR,
    revertMerge,
    undoStatusChange,
} from '@/server/workflow-service';
import {
    createWorkflowItem,
    setCommitMessage,
    findWorkflowItemByIssueNumber,
} from '@/server/database/collections/template/workflow-items';
import type { MockProjectAdapter } from './mocks/mock-project-adapter';

// ============================================================
// TESTS
// ============================================================

describe('Workflow Service Actions', () => {
    let boundaries: TestBoundaries;
    let adapter: MockProjectAdapter;

    beforeAll(async () => {
        boundaries = await setupBoundaries();
        adapter = boundaries.adapter;
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
    });

    afterEach(() => {
        adapter.reset();
        resetAgentCalls();
        resetAgentOverrides();
        resetNotifications();
        resetDesignFiles();
    });

    /**
     * Helper: seed adapter + workflow-items DB for a given issue
     */
    async function seedWorkflowItem(issueNumber: number, title: string, status: string, reviewStatus: string | null = null) {
        adapter.seedIssue(issueNumber, title, `Description for ${title}`, ['feature']);
        adapter.seedItem(issueNumber, status, reviewStatus, ['feature']);

        await createWorkflowItem({
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

    // ============================================================
    // reviewDesign
    // ============================================================

    describe('reviewDesign', () => {
        it('approve clears review status and advances', async () => {
            const issueNumber = 100;
            await seedWorkflowItem(issueNumber, 'Test feature', STATUSES.productDesign, REVIEW_STATUSES.waitingForReview);

            const result = await reviewDesign(issueNumber, 'approve');
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item).toBeTruthy();
            // After approve, review status should be cleared
            expect(item!.reviewStatus).toBeNull();
        });

        it('changes sets Request Changes review status', async () => {
            const issueNumber = 101;
            await seedWorkflowItem(issueNumber, 'Test feature 2', STATUSES.productDesign, REVIEW_STATUSES.waitingForReview);

            const result = await reviewDesign(issueNumber, 'changes');
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.reviewStatus).toBe(REVIEW_STATUSES.requestChanges);
        });

        it('reject sets Rejected review status', async () => {
            const issueNumber = 102;
            await seedWorkflowItem(issueNumber, 'Test feature 3', STATUSES.productDesign, REVIEW_STATUSES.waitingForReview);

            const result = await reviewDesign(issueNumber, 'reject');
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.reviewStatus).toBe(REVIEW_STATUSES.rejected);
        });
    });

    // ============================================================
    // requestChangesOnPR
    // ============================================================

    describe('requestChangesOnPR', () => {
        it('sets status to Implementation + Request Changes', async () => {
            const issueNumber = 110;
            await seedWorkflowItem(issueNumber, 'PR feature', STATUSES.prReview, REVIEW_STATUSES.waitingForReview);

            const result = await requestChangesOnPR(issueNumber);
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.status).toBe(STATUSES.implementation);
            expect(item!.reviewStatus).toBe(REVIEW_STATUSES.requestChanges);
        });
    });

    // ============================================================
    // mergeImplementationPR
    // ============================================================

    describe('mergeImplementationPR', () => {
        it('merges PR with commit message from DB and marks done', async () => {
            const issueNumber = 120;
            await seedWorkflowItem(issueNumber, 'Merge feature', STATUSES.prReview, REVIEW_STATUSES.approved);

            // Create a PR via adapter
            const pr = await adapter.createPullRequest(
                `feat/issue-${issueNumber}`,
                'main',
                `feat: merge feature #${issueNumber}`,
                `Closes #${issueNumber}`
            );
            adapter.linkPRToIssue(pr.number, issueNumber);

            // Save commit message to DB
            await setCommitMessage(issueNumber, pr.number, 'feat: merge feature', `Closes #${issueNumber}`);

            // Add implementation artifact comment so getArtifactsFromIssue can find the PR
            await adapter.addIssueComment(issueNumber, `<!-- IMPLEMENTATION_ARTIFACT -->\n{"implementation":{"phases":[{"phase":1,"name":"","status":"in-review","prNumber":${pr.number}}]}}`);

            const result = await mergeImplementationPR(issueNumber, pr.number);
            expect(result.success).toBe(true);
            expect(result.mergeCommitSha).toBeTruthy();

            // Verify PR was merged in adapter
            const prDetails = await adapter.getPRDetails(pr.number);
            expect(prDetails!.merged).toBe(true);

            // Verify lastMergedPr was persisted
            const dbItem = await findWorkflowItemByIssueNumber(issueNumber);
            expect(dbItem?.artifacts?.lastMergedPr?.prNumber).toBe(pr.number);
        });
    });

    // ============================================================
    // revertMerge + mergeRevertPR
    // ============================================================

    describe('revertMerge', () => {
        it('returns error when createRevertPR fails', async () => {
            const issueNumber = 130;
            await seedWorkflowItem(issueNumber, 'Revert feature', STATUSES.done);

            // Create and merge a PR so getMergeCommitSha works
            const pr = await adapter.createPullRequest(
                `feat/issue-${issueNumber}`,
                'main',
                `feat: revert feature #${issueNumber}`,
                `Closes #${issueNumber}`
            );
            await adapter.mergePullRequest(pr.number);

            // Default mock createRevertPR returns null
            const result = await revertMerge(issueNumber, pr.number);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to create revert PR');
        });

        it('works without shortSha (UI path)', async () => {
            const issueNumber = 131;
            await seedWorkflowItem(issueNumber, 'Revert feature 2', STATUSES.done);

            // Create and merge a PR
            const pr = await adapter.createPullRequest(
                `feat/issue-${issueNumber}`,
                'main',
                `feat: revert feature 2 #${issueNumber}`,
                `Closes #${issueNumber}`
            );
            await adapter.mergePullRequest(pr.number);

            // Call without shortSha (UI path) — should not fail on SHA validation
            const result = await revertMerge(issueNumber, pr.number, undefined);
            // Will fail because createRevertPR returns null in mock, but NOT because of SHA mismatch
            expect(result.success).toBe(false);
            expect(result.error).not.toContain('SHA mismatch');
        });

        it('validates shortSha when provided (Telegram path)', async () => {
            const issueNumber = 132;
            await seedWorkflowItem(issueNumber, 'Revert feature 3', STATUSES.done);

            // Create and merge a PR
            const pr = await adapter.createPullRequest(
                `feat/issue-${issueNumber}`,
                'main',
                `feat: revert feature 3 #${issueNumber}`,
                `Closes #${issueNumber}`
            );
            await adapter.mergePullRequest(pr.number);

            // Call with wrong shortSha — should fail on SHA validation
            const result = await revertMerge(issueNumber, pr.number, 'wrongsha');
            expect(result.success).toBe(false);
            expect(result.error).toContain('SHA mismatch');
        });

        it('validates shortSha passes when correct prefix', async () => {
            const issueNumber = 133;
            await seedWorkflowItem(issueNumber, 'Revert feature 4', STATUSES.done);

            const pr = await adapter.createPullRequest(
                `feat/issue-${issueNumber}`,
                'main',
                `feat: revert feature 4 #${issueNumber}`,
                `Closes #${issueNumber}`
            );
            await adapter.mergePullRequest(pr.number);

            // SHA from mock is `merge-sha-{prNumber}`, use correct prefix
            const result = await revertMerge(issueNumber, pr.number, 'merge-sha');
            // Passes SHA check but fails on createRevertPR (returns null in mock)
            expect(result.success).toBe(false);
            expect(result.error).not.toContain('SHA mismatch');
        });
    });

    // ============================================================
    // undoStatusChange
    // ============================================================

    describe('undoStatusChange', () => {
        it('restores status within undo window', async () => {
            const issueNumber = 140;
            await seedWorkflowItem(issueNumber, 'Undo feature', STATUSES.implementation, REVIEW_STATUSES.requestChanges);

            const result = await undoStatusChange(
                issueNumber,
                STATUSES.prReview,
                null, // clear review status
                { timestamp: Date.now() }
            );
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.status).toBe(STATUSES.prReview);
            expect(item!.reviewStatus).toBeNull();
        });

        it('fails when undo window expired', async () => {
            const issueNumber = 141;
            await seedWorkflowItem(issueNumber, 'Undo expired', STATUSES.implementation, REVIEW_STATUSES.requestChanges);

            const result = await undoStatusChange(
                issueNumber,
                STATUSES.prReview,
                null,
                { timestamp: Date.now() - 6 * 60 * 1000 } // 6 minutes ago
            );
            expect(result.success).toBe(false);
            expect(result.expired).toBe(true);
        });

        it('clears review status without changing main status', async () => {
            const issueNumber = 142;
            await seedWorkflowItem(issueNumber, 'Undo review', STATUSES.productDesign, REVIEW_STATUSES.requestChanges);

            const result = await undoStatusChange(
                issueNumber,
                null, // don't change status
                null, // clear review status
                { timestamp: Date.now() }
            );
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.status).toBe(STATUSES.productDesign);
            expect(item!.reviewStatus).toBeNull();
        });
    });
});
