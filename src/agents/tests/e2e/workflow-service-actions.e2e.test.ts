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

import { STATUSES, REVIEW_STATUSES } from '@/server/template/project-management/config';
import { resetNotifications } from './mocks/mock-notifications';
import { resetDesignFiles } from './mocks/mock-design-files';
import { setupBoundaries, teardownBoundaries, type TestBoundaries } from './testkit/setup-boundaries';
import {
    reviewDesign,
    requestChangesOnPR,
    requestChangesOnDesignPR,
    mergeImplementationPR,
    mergeDesignPR,
    mergeFinalPR,
    mergeRevertPR,
    revertMerge,
    undoStatusChange,
    approveWorkflowItem,
    routeWorkflowItem,
    deleteWorkflowItem,
    advanceStatus,
    setWorkflowStatus,
    markClarificationReceived,
    submitDecisionRouting,
    routeWorkflowItemByWorkflowId,
} from '@/server/template/workflow-service';
import {
    createWorkflowItem,
    setCommitMessage,
    setRevertPrNumber,
    findWorkflowItemByIssueNumber,
} from '@/server/database/collections/template/workflow-items';
import { featureRequests } from '@/server/database';
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

    // ============================================================
    // requestChangesOnDesignPR
    // ============================================================

    describe('requestChangesOnDesignPR', () => {
        it('sets review status to Request Changes', async () => {
            const issueNumber = 150;
            await seedWorkflowItem(issueNumber, 'Design PR feature', STATUSES.productDesign, REVIEW_STATUSES.waitingForReview);

            const result = await requestChangesOnDesignPR(issueNumber, 42, 'Product Design');
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.reviewStatus).toBe(REVIEW_STATUSES.requestChanges);
            // Status should remain unchanged
            expect(item!.status).toBe(STATUSES.productDesign);
        });

        it('returns error for missing issue', async () => {
            const result = await requestChangesOnDesignPR(99999, 42, 'Product Design');
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    // ============================================================
    // mergeDesignPR
    // ============================================================

    describe('mergeDesignPR', () => {
        it('merges design PR and advances to next phase', async () => {
            const issueNumber = 160;
            await seedWorkflowItem(issueNumber, 'Design merge feature', STATUSES.productDesign, REVIEW_STATUSES.approved);

            // Create a design PR
            const pr = await adapter.createPullRequest(
                `design/issue-${issueNumber}`,
                'main',
                `docs: product design for #${issueNumber}`,
                `Product design document`
            );

            const result = await mergeDesignPR(issueNumber, pr.number, 'product');
            expect(result.success).toBe(true);
            expect(result.advancedTo).toBe('Tech Design');

            // Verify PR was merged
            const prDetails = await adapter.getPRDetails(pr.number);
            expect(prDetails!.merged).toBe(true);

            // Verify status advanced to Technical Design
            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.status).toBe(STATUSES.techDesign);
            // Review status should be cleared after advance
            expect(item!.reviewStatus).toBeNull();
        });

        it('returns success even without item in adapter', async () => {
            // This tests the edge case where the item is not found in the adapter
            // mergeDesignPR still merges the PR but skips advance
            const issueNumber = 161;
            // Only seed the issue (no project item) so findItemByIssueNumber returns null
            adapter.seedIssue(issueNumber, 'No item feature', 'Description', ['feature']);

            const pr = await adapter.createPullRequest(
                `design/issue-${issueNumber}`,
                'main',
                `docs: product design for #${issueNumber}`,
                `Product design document`
            );

            const result = await mergeDesignPR(issueNumber, pr.number, 'product');
            expect(result.success).toBe(true);
            // advancedTo is undefined because item was not found
            expect(result.advancedTo).toBeUndefined();
        });
    });

    // ============================================================
    // mergeFinalPR
    // ============================================================

    describe('mergeFinalPR', () => {
        it('merges final PR and marks item Done', async () => {
            const issueNumber = 170;
            await seedWorkflowItem(issueNumber, 'Final merge feature', STATUSES.finalReview);

            // Create and seed a final PR
            const pr = await adapter.createPullRequest(
                `feature/task-${issueNumber}`,
                'main',
                `feat: final merge for #${issueNumber}`,
                `Closes #${issueNumber}`
            );

            const result = await mergeFinalPR(issueNumber, pr.number);
            expect(result.success).toBe(true);

            // Verify PR was merged
            const prDetails = await adapter.getPRDetails(pr.number);
            expect(prDetails!.merged).toBe(true);

            // Verify status is Done in adapter
            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.status).toBe(STATUSES.done);
        });

        it('returns error when PR not found', async () => {
            const issueNumber = 171;
            await seedWorkflowItem(issueNumber, 'Final merge missing PR', STATUSES.finalReview);

            const result = await mergeFinalPR(issueNumber, 99999);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Could not fetch PR info');
        });
    });

    // ============================================================
    // mergeRevertPR
    // ============================================================

    describe('mergeRevertPR', () => {
        it('merges revert PR and clears revert tracking', async () => {
            const issueNumber = 180;
            await seedWorkflowItem(issueNumber, 'Revert merge feature', STATUSES.implementation, REVIEW_STATUSES.requestChanges);

            // Create a revert PR
            const revertPR = await adapter.createPullRequest(
                `revert-merge-sha-123`,
                'main',
                `Revert "feat: some feature #${issueNumber}"`,
                `Part of #${issueNumber}`
            );

            // Set the revert PR number in DB
            await setRevertPrNumber(issueNumber, revertPR.number);

            const result = await mergeRevertPR(issueNumber, revertPR.number);
            expect(result.success).toBe(true);

            // Verify revert PR was merged
            const prDetails = await adapter.getPRDetails(revertPR.number);
            expect(prDetails!.merged).toBe(true);

            // Verify revertPrNumber was cleared from DB
            const dbItem = await findWorkflowItemByIssueNumber(issueNumber);
            expect(dbItem?.artifacts?.revertPrNumber).toBeUndefined();
        });

        it('returns error for non-existent revert PR', async () => {
            const issueNumber = 181;
            await seedWorkflowItem(issueNumber, 'Missing revert PR', STATUSES.implementation);

            const result = await mergeRevertPR(issueNumber, 99999);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    // ============================================================
    // approveWorkflowItem
    // ============================================================

    describe('approveWorkflowItem', () => {
        it('creates GitHub issue and returns needsRouting for features', async () => {
            // Create a feature request in MongoDB (status: 'new')
            const fr = await featureRequests.createFeatureRequest({
                title: 'New feature to approve',
                description: 'A test feature description',
                status: 'new',
                needsUserInput: false,
                requestedBy: new (await import('mongodb')).ObjectId(),
                comments: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await approveWorkflowItem({ id: fr._id.toString(), type: 'feature' });
            expect(result.success).toBe(true);
            expect(result.issueNumber).toBeTruthy();
            expect(result.needsRouting).toBe(true);
        });

        it('prevents double approval', async () => {
            // Create a feature request that is already synced
            const fr = await featureRequests.createFeatureRequest({
                title: 'Already approved feature',
                description: 'Already synced',
                status: 'in_progress',
                needsUserInput: false,
                requestedBy: new (await import('mongodb')).ObjectId(),
                comments: [],
                githubIssueUrl: 'https://github.com/test/repo/issues/999',
                githubIssueNumber: 999,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await approveWorkflowItem({ id: fr._id.toString(), type: 'feature' });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Already approved');
        });

        it('routes to backlog when initialRoute is backlog', async () => {
            const fr = await featureRequests.createFeatureRequest({
                title: 'Backlog feature',
                description: 'Should go to backlog',
                status: 'new',
                needsUserInput: false,
                requestedBy: new (await import('mongodb')).ObjectId(),
                comments: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await approveWorkflowItem(
                { id: fr._id.toString(), type: 'feature' },
                { initialRoute: 'backlog' }
            );
            expect(result.success).toBe(true);
            expect(result.needsRouting).toBe(false);

            // Verify item status is Backlog in adapter (set via initialStatusOverride)
            if (result.issueNumber) {
                const item = adapter.findItemByIssueNumber(result.issueNumber);
                expect(item!.status).toBe(STATUSES.backlog);
            }
        });
    });

    // ============================================================
    // routeWorkflowItem
    // ============================================================

    describe('routeWorkflowItem', () => {
        it('routes feature to product-design', async () => {
            // Create a feature request in MongoDB, approve it so it has a githubProjectItemId
            const fr = await featureRequests.createFeatureRequest({
                title: 'Route test feature',
                description: 'Feature to route',
                status: 'new',
                needsUserInput: false,
                requestedBy: new (await import('mongodb')).ObjectId(),
                comments: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Approve to get GitHub issue + project item
            const approveResult = await approveWorkflowItem({ id: fr._id.toString(), type: 'feature' });
            expect(approveResult.success).toBe(true);

            // Route to product-design
            const result = await routeWorkflowItem({ id: fr._id.toString(), type: 'feature' }, 'product-design');
            expect(result.success).toBe(true);
            expect(result.targetStatus).toBe(STATUSES.productDesign);

            // Verify adapter status
            if (approveResult.issueNumber) {
                const item = adapter.findItemByIssueNumber(approveResult.issueNumber);
                expect(item!.status).toBe(STATUSES.productDesign);
                // Review status should be cleared
                expect(item!.reviewStatus).toBeNull();
            }
        });

        it('returns error for invalid destination', async () => {
            const fr = await featureRequests.createFeatureRequest({
                title: 'Invalid route feature',
                description: 'Feature with invalid route',
                status: 'new',
                needsUserInput: false,
                requestedBy: new (await import('mongodb')).ObjectId(),
                comments: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const approveResult = await approveWorkflowItem({ id: fr._id.toString(), type: 'feature' });
            expect(approveResult.success).toBe(true);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await routeWorkflowItem({ id: fr._id.toString(), type: 'feature' }, 'invalid' as any);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid routing destination');
        });
    });

    // ============================================================
    // deleteWorkflowItem
    // ============================================================

    describe('deleteWorkflowItem', () => {
        it('deletes feature request and cleans up workflow item', async () => {
            const fr = await featureRequests.createFeatureRequest({
                title: 'Feature to delete',
                description: 'Should be deletable',
                status: 'new',
                needsUserInput: false,
                requestedBy: new (await import('mongodb')).ObjectId(),
                comments: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Create matching workflow-item
            await createWorkflowItem({
                type: 'feature',
                title: 'Feature to delete',
                status: STATUSES.backlog,
                githubIssueNumber: 200,
                githubIssueUrl: 'https://github.com/test/repo/issues/200',
                githubIssueTitle: 'Feature to delete',
                labels: ['feature'],
                sourceRef: { collection: 'feature-requests', id: fr._id },
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await deleteWorkflowItem({ id: fr._id.toString(), type: 'feature' });
            expect(result.success).toBe(true);
            expect(result.title).toBe('Feature to delete');

            // Assert feature request deleted from DB
            const deletedFr = await featureRequests.findFeatureRequestById(fr._id.toString());
            expect(deletedFr).toBeNull();
        });

        it('blocks deletion of GitHub-synced item without force flag', async () => {
            const fr = await featureRequests.createFeatureRequest({
                title: 'Synced feature',
                description: 'Already synced to GitHub',
                status: 'in_progress',
                needsUserInput: false,
                requestedBy: new (await import('mongodb')).ObjectId(),
                comments: [],
                githubIssueUrl: 'https://github.com/test/repo/issues/201',
                githubIssueNumber: 201,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await deleteWorkflowItem({ id: fr._id.toString(), type: 'feature' });
            expect(result.success).toBe(false);
            expect(result.error).toContain('synced to GitHub');
        });

        it('cleans up orphaned workflow-item when source doc already deleted', async () => {
            const { ObjectId: OId } = await import('mongodb');
            const orphanId = new OId();

            // Create workflow-item pointing to non-existent feature request
            await createWorkflowItem({
                type: 'feature',
                title: 'Orphaned item',
                status: STATUSES.backlog,
                githubIssueNumber: 202,
                githubIssueUrl: 'https://github.com/test/repo/issues/202',
                githubIssueTitle: 'Orphaned item',
                labels: ['feature'],
                sourceRef: { collection: 'feature-requests', id: orphanId },
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await deleteWorkflowItem({ id: orphanId.toString(), type: 'feature' });
            expect(result.success).toBe(true);
        });
    });

    // ============================================================
    // advanceStatus
    // ============================================================

    describe('advanceStatus', () => {
        it('advances status and clears review status by default', async () => {
            const issueNumber = 300;
            await seedWorkflowItem(issueNumber, 'Advance feature', STATUSES.productDesign, REVIEW_STATUSES.waitingForReview);

            const result = await advanceStatus(issueNumber, STATUSES.techDesign);
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.status).toBe(STATUSES.techDesign);
            expect(item!.reviewStatus).toBeNull();
        });

        it('preserves review status when clearReview is false', async () => {
            const issueNumber = 301;
            await seedWorkflowItem(issueNumber, 'Advance preserve review', STATUSES.productDesign, REVIEW_STATUSES.approved);

            const result = await advanceStatus(issueNumber, STATUSES.techDesign, { clearReview: false });
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.status).toBe(STATUSES.techDesign);
            expect(item!.reviewStatus).toBe(REVIEW_STATUSES.approved);
        });

        it('returns error when issue not found', async () => {
            const result = await advanceStatus(999, STATUSES.techDesign);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    // ============================================================
    // setWorkflowStatus
    // ============================================================

    describe('setWorkflowStatus', () => {
        it('sets non-routable status directly', async () => {
            const issueNumber = 310;
            const { ObjectId: OId } = await import('mongodb');

            // Seed adapter item
            adapter.seedIssue(issueNumber, 'Set status feature', 'Description', ['feature']);
            const adapterItemId = adapter.seedItem(issueNumber, STATUSES.implementation, null, ['feature']);

            // Create feature request with githubProjectItemId pointing to the adapter item
            const fr = await featureRequests.createFeatureRequest({
                title: 'Set status feature',
                description: 'Feature for set-status test',
                status: 'in_progress',
                needsUserInput: false,
                requestedBy: new OId(),
                comments: [],
                githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
                githubIssueNumber: issueNumber,
                githubProjectItemId: adapterItemId,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as Parameters<typeof featureRequests.createFeatureRequest>[0]);

            // Create workflow-item with sourceRef pointing to the feature request
            const wfItem = await createWorkflowItem({
                type: 'feature',
                title: 'Set status feature',
                status: STATUSES.implementation,
                githubIssueNumber: issueNumber,
                githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
                githubIssueTitle: 'Set status feature',
                labels: ['feature'],
                sourceRef: { collection: 'feature-requests', id: fr._id },
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await setWorkflowStatus(wfItem._id.toString(), STATUSES.done);
            expect(result.success).toBe(true);

            // Verify adapter status updated
            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.status).toBe(STATUSES.done);
        });

        it('returns error for non-existent workflow item', async () => {
            const result = await setWorkflowStatus('000000000000000000000000', STATUSES.done);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    // ============================================================
    // markClarificationReceived
    // ============================================================

    describe('markClarificationReceived', () => {
        it('updates review status to Clarification Received', async () => {
            const issueNumber = 320;
            await seedWorkflowItem(issueNumber, 'Clarification feature', STATUSES.techDesign, REVIEW_STATUSES.waitingForClarification);

            const result = await markClarificationReceived(issueNumber);
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.reviewStatus).toBe(REVIEW_STATUSES.clarificationReceived);
        });

        it('returns error when item is not waiting for clarification', async () => {
            const issueNumber = 321;
            await seedWorkflowItem(issueNumber, 'Not waiting feature', STATUSES.techDesign, REVIEW_STATUSES.waitingForReview);

            const result = await markClarificationReceived(issueNumber);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not waiting for clarification');
        });

        it('returns error when issue not found', async () => {
            const result = await markClarificationReceived(999);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    // ============================================================
    // submitDecisionRouting
    // ============================================================

    describe('submitDecisionRouting', () => {
        it('routes to target status and clears review', async () => {
            const issueNumber = 330;
            await seedWorkflowItem(issueNumber, 'Decision route feature', STATUSES.bugInvestigation, REVIEW_STATUSES.waitingForReview);

            const result = await submitDecisionRouting(issueNumber, STATUSES.techDesign, { logAction: 'decision_routed' });
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.status).toBe(STATUSES.techDesign);
            // Review status should be cleared when routing
            expect(item!.reviewStatus).toBeNull();
        });

        it('sets review status when no target status (approval-only)', async () => {
            const issueNumber = 331;
            await seedWorkflowItem(issueNumber, 'Decision approve feature', STATUSES.bugInvestigation);

            const result = await submitDecisionRouting(issueNumber, undefined, { reviewStatus: REVIEW_STATUSES.approved });
            expect(result.success).toBe(true);

            const item = adapter.findItemByIssueNumber(issueNumber);
            // Status should not change
            expect(item!.status).toBe(STATUSES.bugInvestigation);
            expect(item!.reviewStatus).toBe(REVIEW_STATUSES.approved);
        });

        it('returns error when issue not found', async () => {
            const result = await submitDecisionRouting(999, STATUSES.techDesign);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    // ============================================================
    // routeWorkflowItemByWorkflowId
    // ============================================================

    describe('routeWorkflowItemByWorkflowId', () => {
        it('routes feature via workflow item ID', async () => {
            const issueNumber = 340;
            const { ObjectId: OId } = await import('mongodb');

            // Seed adapter item
            adapter.seedIssue(issueNumber, 'Route by workflow ID', 'Description', ['feature']);
            adapter.seedItem(issueNumber, STATUSES.backlog, null, ['feature']);

            // Create feature request with githubProjectItemId
            const adapterItem = adapter.findItemByIssueNumber(issueNumber);
            const fr = await featureRequests.createFeatureRequest({
                title: 'Route by workflow ID',
                description: 'Feature to route by workflow ID',
                status: 'in_progress',
                needsUserInput: false,
                requestedBy: new OId(),
                comments: [],
                githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
                githubIssueNumber: issueNumber,
                githubProjectItemId: adapterItem!.id,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as Parameters<typeof featureRequests.createFeatureRequest>[0]);

            // Create workflow-item with sourceRef
            const wfItem = await createWorkflowItem({
                type: 'feature',
                title: 'Route by workflow ID',
                status: STATUSES.backlog,
                githubIssueNumber: issueNumber,
                githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
                githubIssueTitle: 'Route by workflow ID',
                labels: ['feature'],
                sourceRef: { collection: 'feature-requests', id: fr._id },
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await routeWorkflowItemByWorkflowId(wfItem._id.toString(), STATUSES.productDesign);
            expect(result.success).toBe(true);
            expect(result.targetStatus).toBe(STATUSES.productDesign);

            // Verify adapter status
            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item!.status).toBe(STATUSES.productDesign);
        });

        it('returns error for non-routable status', async () => {
            const issueNumber = 341;
            const { ObjectId: OId } = await import('mongodb');

            // Seed adapter item
            adapter.seedIssue(issueNumber, 'Non-routable feature', 'Description', ['feature']);
            adapter.seedItem(issueNumber, STATUSES.backlog, null, ['feature']);

            // Create feature request
            const adapterItem = adapter.findItemByIssueNumber(issueNumber);
            const fr = await featureRequests.createFeatureRequest({
                title: 'Non-routable feature',
                description: 'Feature for non-routable test',
                status: 'in_progress',
                needsUserInput: false,
                requestedBy: new OId(),
                comments: [],
                githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
                githubIssueNumber: issueNumber,
                githubProjectItemId: adapterItem!.id,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as Parameters<typeof featureRequests.createFeatureRequest>[0]);

            // Create workflow-item with sourceRef
            const wfItem = await createWorkflowItem({
                type: 'feature',
                title: 'Non-routable feature',
                status: STATUSES.backlog,
                githubIssueNumber: issueNumber,
                githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
                githubIssueTitle: 'Non-routable feature',
                labels: ['feature'],
                sourceRef: { collection: 'feature-requests', id: fr._id },
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const result = await routeWorkflowItemByWorkflowId(wfItem._id.toString(), STATUSES.prReview);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not a valid routing destination');
        });

        it('returns error for non-existent workflow item', async () => {
            const result = await routeWorkflowItemByWorkflowId('000000000000000000000000', STATUSES.productDesign);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });
});
