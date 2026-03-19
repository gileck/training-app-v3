/**
 * In-memory MockProjectAdapter implementing ProjectManagementAdapter.
 * Used in E2E tests to avoid real GitHub/MongoDB calls.
 */

import type {
    ProjectManagementAdapter,
    ProjectItem,
    ProjectItemComment,
    PRReviewComment,
    CreateIssueResult,
    CreatePRResult,
    ProjectField,
    ListItemsOptions,
    GitHubIssueDetails,
} from '@/server/template/project-management';
import { STATUSES, REVIEW_STATUSES } from '@/server/template/project-management/config';

interface StoredIssue {
    number: number;
    nodeId: string;
    title: string;
    body: string;
    labels: string[];
    url: string;
}

interface StoredPR {
    number: number;
    url: string;
    head: string;
    base: string;
    title: string;
    body: string;
    state: 'open' | 'closed';
    merged: boolean;
    issueNumber?: number;
    reviews: Array<{ event: string; body: string }>;
}

export class MockProjectAdapter implements ProjectManagementAdapter {
    private items = new Map<string, ProjectItem>();
    private issues = new Map<number, StoredIssue>();
    private issueComments = new Map<number, ProjectItemComment[]>();
    private prs = new Map<number, StoredPR>();
    private prComments = new Map<number, ProjectItemComment[]>();
    private prReviewComments = new Map<number, PRReviewComment[]>();
    private branches = new Set<string>();
    private phases = new Map<string, string>();
    private initialized = false;
    private nextIssueNumber = 1000;
    private nextPRNumber = 2000;
    private nextItemId = 1;
    private nextCommentId = 5000;

    // ------ Initialization ------
    async init(): Promise<void> {
        this.initialized = true;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    // ------ Project Items ------
    async listItems(options?: ListItemsOptions): Promise<ProjectItem[]> {
        let items = Array.from(this.items.values());
        if (options?.status) {
            items = items.filter(i => i.status === options.status);
        }
        if (options?.reviewStatus) {
            items = items.filter(i => i.reviewStatus === options.reviewStatus);
        }
        if (options?.limit) {
            items = items.slice(0, options.limit);
        }
        return items;
    }

    async getItem(itemId: string): Promise<ProjectItem | null> {
        return this.items.get(itemId) || null;
    }

    // ------ Status Management ------
    async getAvailableStatuses(): Promise<string[]> {
        return Object.values(STATUSES);
    }

    async getAvailableReviewStatuses(): Promise<string[]> {
        return Object.values(REVIEW_STATUSES);
    }

    hasReviewStatusField(): boolean {
        return true;
    }

    async updateItemStatus(itemId: string, status: string): Promise<void> {
        const item = this.items.get(itemId);
        if (item) {
            this.items.set(itemId, { ...item, status: status as ProjectItem['status'] });
        }
    }

    async updateItemReviewStatus(itemId: string, reviewStatus: string): Promise<void> {
        const item = this.items.get(itemId);
        if (item) {
            const rs = reviewStatus === '' ? null : reviewStatus as ProjectItem['reviewStatus'];
            this.items.set(itemId, { ...item, reviewStatus: rs });
        }
    }

    async clearItemReviewStatus(itemId: string): Promise<void> {
        const item = this.items.get(itemId);
        if (item) {
            this.items.set(itemId, { ...item, reviewStatus: null });
        }
    }

    // ------ Implementation Phase ------
    hasImplementationPhaseField(): boolean {
        return true;
    }

    async getImplementationPhase(itemId: string): Promise<string | null> {
        return this.phases.get(itemId) || null;
    }

    async setImplementationPhase(itemId: string, value: string): Promise<void> {
        this.phases.set(itemId, value);
    }

    async clearImplementationPhase(itemId: string): Promise<void> {
        this.phases.delete(itemId);
    }

    // ------ Issues ------
    async createIssue(title: string, body: string, labels?: string[]): Promise<CreateIssueResult> {
        const number = this.nextIssueNumber++;
        const nodeId = `issue-node-${number}`;
        const url = `https://github.com/test/repo/issues/${number}`;
        this.issues.set(number, { number, nodeId, title, body, labels: labels || [], url });
        this.issueComments.set(number, []);
        return { number, nodeId, url };
    }

    async updateIssueBody(issueNumber: number, body: string): Promise<void> {
        const issue = this.issues.get(issueNumber);
        if (issue) {
            issue.body = body;
        }
    }

    async addIssueComment(issueNumber: number, body: string): Promise<number> {
        const comments = this.issueComments.get(issueNumber) || [];
        const id = this.nextCommentId++;
        comments.push({ id, body, author: 'test-bot', createdAt: new Date().toISOString() });
        this.issueComments.set(issueNumber, comments);
        return id;
    }

    async getIssueComments(issueNumber: number): Promise<ProjectItemComment[]> {
        return this.issueComments.get(issueNumber) || [];
    }

    async getIssueDetails(issueNumber: number): Promise<GitHubIssueDetails | null> {
        const issue = this.issues.get(issueNumber);
        if (!issue) return null;
        return {
            number: issue.number,
            title: issue.title,
            body: issue.body,
            url: issue.url,
            state: 'OPEN',
            linkedPullRequests: [],
        };
    }

    async addIssueToProject(issueNodeId: string, context?: {
        type: 'feature' | 'bug' | 'task';
        mongoId: string;
        title: string;
        description?: string;
        labels?: string[];
        githubIssueNumber: number;
        githubIssueUrl: string;
    }): Promise<string> {
        const itemId = `item-${this.nextItemId++}`;
        const issueNumber = context?.githubIssueNumber;
        const issue = issueNumber ? this.issues.get(issueNumber) : null;

        const item: ProjectItem = {
            id: itemId,
            status: STATUSES.backlog,
            reviewStatus: null,
            content: {
                type: 'Issue',
                id: issueNodeId,
                number: issueNumber,
                title: context?.title || issue?.title || 'Unknown',
                body: context?.description || issue?.body || '',
                url: context?.githubIssueUrl || issue?.url,
                labels: context?.labels || issue?.labels,
            },
            fieldValues: [],
        };
        this.items.set(itemId, item);
        return itemId;
    }

    async findIssueCommentByMarker(issueNumber: number, marker: string): Promise<{ id: number; body: string } | null> {
        const comments = this.issueComments.get(issueNumber) || [];
        const found = comments.find(c => c.body.includes(marker));
        return found ? { id: found.id, body: found.body } : null;
    }

    async updateIssueComment(issueNumber: number, commentId: number, body: string): Promise<void> {
        const comments = this.issueComments.get(issueNumber) || [];
        const comment = comments.find(c => c.id === commentId);
        if (comment) {
            comment.body = body;
        }
    }

    // ------ Pull Requests ------
    async createPullRequest(head: string, base: string, title: string, body: string): Promise<CreatePRResult> {
        const number = this.nextPRNumber++;
        const url = `https://github.com/test/repo/pull/${number}`;
        this.prs.set(number, { number, url, head, base, title, body, state: 'open', merged: false, reviews: [] });
        this.prComments.set(number, []);
        this.prReviewComments.set(number, []);
        return { number, url };
    }

    async getPRReviewComments(prNumber: number): Promise<PRReviewComment[]> {
        return this.prReviewComments.get(prNumber) || [];
    }

    async getPRComments(prNumber: number): Promise<ProjectItemComment[]> {
        return this.prComments.get(prNumber) || [];
    }

    async getPRFiles(): Promise<string[]> {
        return ['src/file.ts'];
    }

    async addPRComment(prNumber: number, body: string): Promise<number> {
        const comments = this.prComments.get(prNumber) || [];
        const id = this.nextCommentId++;
        comments.push({ id, body, author: 'test-bot', createdAt: new Date().toISOString() });
        this.prComments.set(prNumber, comments);
        return id;
    }

    async requestPRReviewers(): Promise<void> {}

    async submitPRReview(prNumber: number, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', body: string): Promise<void> {
        const pr = this.prs.get(prNumber);
        if (pr) {
            pr.reviews.push({ event, body });
        }
    }

    async getPRDetails(prNumber: number): Promise<{ state: 'open' | 'closed'; merged: boolean; headBranch: string } | null> {
        const pr = this.prs.get(prNumber);
        if (!pr) return null;
        return { state: pr.state, merged: pr.merged, headBranch: pr.head };
    }

    async mergePullRequest(prNumber: number): Promise<string> {
        const pr = this.prs.get(prNumber);
        if (pr) {
            pr.state = 'closed';
            pr.merged = true;
        }
        return `merge-sha-${prNumber}`;
    }

    async getMergeCommitSha(prNumber: number): Promise<string | null> {
        const pr = this.prs.get(prNumber);
        return pr?.merged ? `merge-sha-${prNumber}` : null;
    }

    async createRevertPR(): Promise<{ prNumber: number; url: string } | null> {
        return null;
    }

    async findPRCommentByMarker(prNumber: number, marker: string): Promise<{ id: number; body: string } | null> {
        const comments = this.prComments.get(prNumber) || [];
        const found = comments.find(c => c.body.includes(marker));
        return found ? { id: found.id, body: found.body } : null;
    }

    async updatePRComment(prNumber: number, commentId: number, body: string): Promise<void> {
        const comments = this.prComments.get(prNumber) || [];
        const comment = comments.find(c => c.id === commentId);
        if (comment) {
            comment.body = body;
        }
    }

    async getPRInfo(prNumber: number): Promise<{ title: string; body: string; additions: number; deletions: number; changedFiles: number; commits: number } | null> {
        const pr = this.prs.get(prNumber);
        if (!pr) return null;
        return { title: pr.title, body: pr.body, additions: 10, deletions: 5, changedFiles: 2, commits: 1 };
    }

    async findOpenPRForIssue(issueNumber: number): Promise<{ prNumber: number; branchName: string } | null> {
        for (const pr of this.prs.values()) {
            if (pr.state === 'open' && pr.issueNumber === issueNumber) {
                return { prNumber: pr.number, branchName: pr.head };
            }
        }
        return null;
    }

    // ------ Branches ------
    async getDefaultBranch(): Promise<string> {
        return 'main';
    }

    async createBranch(branchName: string): Promise<void> {
        this.branches.add(branchName);
    }

    async branchExists(branchName: string): Promise<boolean> {
        return this.branches.has(branchName);
    }

    async deleteBranch(branchName: string): Promise<void> {
        this.branches.delete(branchName);
    }

    // ------ Project Fields ------
    async getProjectFields(): Promise<ProjectField[]> {
        return [];
    }

    // ------ File Operations ------
    async createOrUpdateFileContents(): Promise<void> {}

    // ====== Test Helpers ======

    /** Seed an issue directly into the mock */
    seedIssue(issueNumber: number, title: string, body: string, labels: string[] = []): void {
        const nodeId = `issue-node-${issueNumber}`;
        const url = `https://github.com/test/repo/issues/${issueNumber}`;
        this.issues.set(issueNumber, { number: issueNumber, nodeId, title, body, labels, url });
        this.issueComments.set(issueNumber, []);
    }

    /** Seed a project item directly */
    seedItem(issueNumber: number, status: string, reviewStatus: string | null = null, labels: string[] = []): string {
        const issue = this.issues.get(issueNumber);
        if (!issue) throw new Error(`Issue #${issueNumber} not seeded`);

        const itemId = `item-${this.nextItemId++}`;
        const item: ProjectItem = {
            id: itemId,
            status: status as ProjectItem['status'],
            reviewStatus: reviewStatus as ProjectItem['reviewStatus'],
            content: {
                type: 'Issue',
                id: issue.nodeId,
                number: issueNumber,
                title: issue.title,
                body: issue.body,
                url: issue.url,
                labels: labels.length > 0 ? labels : issue.labels,
            },
            fieldValues: [],
        };
        this.items.set(itemId, item);
        return itemId;
    }

    /** Link a PR to an issue number (for findOpenPRForIssue) */
    linkPRToIssue(prNumber: number, issueNumber: number): void {
        const pr = this.prs.get(prNumber);
        if (pr) {
            pr.issueNumber = issueNumber;
        }
    }

    /** Find item by issue number (test helper) */
    findItemByIssueNumber(issueNumber: number): ProjectItem | null {
        for (const item of this.items.values()) {
            if (item.content?.number === issueNumber) {
                return item;
            }
        }
        return null;
    }

    /** Get all comments on an issue (synchronous test helper) */
    getIssueCommentsSync(issueNumber: number): ProjectItemComment[] {
        return this.issueComments.get(issueNumber) || [];
    }

    /** Get all PRs (test helper) */
    getAllPRs(): StoredPR[] {
        return Array.from(this.prs.values());
    }

    /** Reset all state */
    reset(): void {
        this.items.clear();
        this.issues.clear();
        this.issueComments.clear();
        this.prs.clear();
        this.prComments.clear();
        this.prReviewComments.clear();
        this.branches.clear();
        this.phases.clear();
        this.initialized = false;
        this.nextIssueNumber = 1000;
        this.nextPRNumber = 2000;
        this.nextItemId = 1;
        this.nextCommentId = 5000;
    }
}
