/**
 * Workflow E2E Testkit
 *
 * Fluent API for composing test flows:
 *   - Seed items into the mock adapter
 *   - Run agents (design via runBatch, impl/review/bug via processItem)
 *   - Perform admin actions (approve, advance, markDone)
 *   - Assert state (status, review status, PRs, comments, agent calls)
 */

import { expect } from 'vitest';
import { MockProjectAdapter } from '../mocks/mock-project-adapter';
import { agentCalls, resetAgentCalls } from '../mocks/mock-run-agent';
import { capturedNotifications, resetNotifications } from '../mocks/mock-notifications';
import { resetDesignFiles, getS3Docs } from '../mocks/mock-design-files';
import { STATUSES, REVIEW_STATUSES } from '@/server/template/project-management/config';
import {
    runProductDesignAgent,
    runTechDesignAgent,
    runImplementationAgent,
    runPRReviewAgent,
    runBugInvestigatorAgent,
} from './agent-runners';

export function createWorkflowTestKit() {
    const adapter = new MockProjectAdapter();

    return {
        adapter,

        // ====== Seeding ======

        async seedFeatureRequest(opts: {
            title: string;
            issueNumber: number;
            status?: string;
            body?: string;
            labels?: string[];
        }) {
            const status = opts.status || STATUSES.backlog;
            const body = opts.body || `Feature request: ${opts.title}`;
            const labels = opts.labels || ['feature'];

            // Seed issue in adapter
            adapter.seedIssue(opts.issueNumber, opts.title, body, labels);
            // Seed project item
            adapter.seedItem(opts.issueNumber, status, null, labels);
        },

        async seedBugReport(opts: {
            title: string;
            issueNumber: number;
            status?: string;
            body?: string;
            labels?: string[];
        }) {
            const status = opts.status || STATUSES.bugInvestigation;
            const body = opts.body || `Bug report: ${opts.title}`;
            const labels = opts.labels || ['bug'];

            adapter.seedIssue(opts.issueNumber, opts.title, body, labels);
            adapter.seedItem(opts.issueNumber, status, null, labels);
        },

        // ====== Admin Actions ======

        async routeTo(issueNumber: number, status: string) {
            const item = adapter.findItemByIssueNumber(issueNumber);
            if (!item) throw new Error(`Item for issue #${issueNumber} not found`);
            await adapter.updateItemStatus(item.id, status);
            await adapter.clearItemReviewStatus(item.id);
        },

        async approve(issueNumber: number) {
            const item = adapter.findItemByIssueNumber(issueNumber);
            if (!item) throw new Error(`Item for issue #${issueNumber} not found`);
            await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.approved);
        },

        async autoAdvance() {
            // Import dynamically so mocks are in place
            const { autoAdvanceApproved } = await import('@/server/template/workflow-service');
            return autoAdvanceApproved();
        },

        async markDone(issueNumber: number) {
            const { markDone } = await import('@/server/template/workflow-service');
            return markDone(issueNumber);
        },

        // ====== Agent Runners ======

        async runProductDesignAgent() {
            await runProductDesignAgent(adapter);
        },

        async runTechDesignAgent() {
            await runTechDesignAgent(adapter);
        },

        async runImplementationAgent(issueNumber: number) {
            await runImplementationAgent(issueNumber, adapter);
        },

        async runPRReviewAgent(issueNumber: number) {
            await runPRReviewAgent(issueNumber, adapter);
        },

        async runBugInvestigatorAgent(issueNumber: number) {
            await runBugInvestigatorAgent(issueNumber, adapter);
        },

        // ====== Assertions ======

        assertItemStatus(issueNumber: number, expectedStatus: string) {
            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item, `Item for issue #${issueNumber} should exist`).toBeTruthy();
            expect(item!.status).toBe(expectedStatus);
        },

        assertItemReviewStatus(issueNumber: number, expectedReviewStatus: string | null) {
            const item = adapter.findItemByIssueNumber(issueNumber);
            expect(item, `Item for issue #${issueNumber} should exist`).toBeTruthy();
            expect(item!.reviewStatus).toBe(expectedReviewStatus);
        },

        assertAgentCalled(workflow: string) {
            const found = agentCalls.some(c => c.workflow === workflow);
            expect(found, `Expected runAgent to be called with workflow="${workflow}"`).toBe(true);
        },

        assertAgentCallCount(count: number) {
            expect(agentCalls.length).toBe(count);
        },

        assertPRCreated(issueNumber: number) {
            const allPRs = adapter.getAllPRs();
            // PR title or body should reference the issue
            const found = allPRs.some(
                pr => pr.title.includes(`#${issueNumber}`) || pr.body.includes(`#${issueNumber}`)
            );
            expect(found, `Expected a PR to be created for issue #${issueNumber}`).toBe(true);
        },

        assertCommentPosted(issueNumber: number, pattern: RegExp) {
            const comments = adapter.getIssueCommentsSync(issueNumber);
            const found = comments.some(c => pattern.test(c.body));
            expect(found, `Expected a comment matching ${pattern} on issue #${issueNumber}`).toBe(true);
        },

        assertNotificationSent(fnName: string) {
            const found = capturedNotifications.some(n => n.fn === fnName);
            expect(found, `Expected notification "${fnName}" to be sent`).toBe(true);
        },

        assertDesignInS3(issueNumber: number, type: string, expectedContentSubstring?: string) {
            const s3Docs = getS3Docs();
            const key = `${issueNumber}:${type}`;
            expect(s3Docs.has(key), `Expected design doc for issue #${issueNumber} type "${type}" in S3`).toBe(true);
            if (expectedContentSubstring) {
                expect(s3Docs.get(key)).toContain(expectedContentSubstring);
            }
        },

        getDesignFromS3(issueNumber: number, type: string): string | undefined {
            return getS3Docs().get(`${issueNumber}:${type}`);
        },

        async approveDesign(issueNumber: number, prNumber: number, designType: 'product-dev' | 'product' | 'tech') {
            const { approveDesign } = await import('@/server/template/workflow-service');
            return approveDesign(issueNumber, prNumber, designType);
        },

        async assertPRNotMerged(prNumber: number) {
            const pr = await adapter.getPRDetails(prNumber);
            expect(pr, `PR #${prNumber} should exist`).toBeTruthy();
            expect(pr!.merged, `PR #${prNumber} should NOT be merged`).toBe(false);
        },

        // ====== State Access ======

        getItem(issueNumber: number) {
            return adapter.findItemByIssueNumber(issueNumber);
        },

        getAgentCalls() {
            return [...agentCalls];
        },

        getNotifications() {
            return [...capturedNotifications];
        },

        getAdapter() {
            return adapter;
        },

        // ====== Lifecycle ======

        reset() {
            adapter.reset();
            resetAgentCalls();
            resetNotifications();
            resetDesignFiles();
        },

        cleanup() {
            adapter.reset();
            resetAgentCalls();
            resetNotifications();
            resetDesignFiles();
        },
    };
}
