/**
 * App Project Adapter
 *
 * Implements ProjectManagementAdapter using a dedicated workflow-items MongoDB collection
 * for workflow status tracking and GitHubClient for all GitHub operations.
 *
 * Status fields (status, reviewStatus, implementationPhase) are stored on WorkflowItemDocument.
 * Source collections (feature-requests, reports) remain as intake/detail storage.
 */

import { ObjectId } from 'mongodb';
import { GitHubClient } from '../github-client';
import { STATUSES, REVIEW_STATUSES, REVIEW_STATUS_FIELD, IMPLEMENTATION_PHASE_FIELD } from '../config';
import type {
    ProjectManagementAdapter,
    ProjectItem,
    ProjectItemContent,
    ProjectItemFieldValue,
    ProjectItemComment,
    PRReviewComment,
    CreateIssueResult,
    CreatePRResult,
    ProjectField,
    ListItemsOptions,
    GitHubIssueDetails,
} from '../types';
import type { Status, ReviewStatus } from '../config';
import {
    createWorkflowItem,
    findWorkflowItemById,
    findAllWorkflowItems,
    updateWorkflowFields,
} from '@/server/database/collections/template/workflow-items/workflow-items';
import type { WorkflowItemDocument } from '@/server/database/collections/template/workflow-items/types';
import { getProjectConfig } from '../config';

// ============================================================
// ADAPTER
// ============================================================

export class AppProjectAdapter implements ProjectManagementAdapter {
    private githubClient: GitHubClient;
    private _initialized = false;

    constructor() {
        this.githubClient = new GitHubClient(getProjectConfig());
    }

    // --------------------------------------------------------
    // Initialization
    // --------------------------------------------------------

    async init(): Promise<void> {
        if (this._initialized) return;
        await this.githubClient.init();
        this._initialized = true;
    }

    isInitialized(): boolean {
        return this._initialized;
    }

    // --------------------------------------------------------
    // Project Items (workflow-items collection)
    // --------------------------------------------------------

    async listItems(options?: ListItemsOptions): Promise<ProjectItem[]> {
        const docs = await findAllWorkflowItems(options?.status, options?.reviewStatus);

        const items = docs.map((doc) => this.workflowItemToProjectItem(doc));

        if (options?.limit && items.length > options.limit) {
            return items.slice(0, options.limit);
        }

        return items;
    }

    async getItem(itemId: string): Promise<ProjectItem | null> {
        const doc = await findWorkflowItemById(itemId);
        if (!doc) return null;
        return this.workflowItemToProjectItem(doc);
    }

    // --------------------------------------------------------
    // Status Management (workflow-items collection)
    // --------------------------------------------------------

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
        await updateWorkflowFields(itemId, { workflowStatus: status });
    }

    async updateItemReviewStatus(itemId: string, reviewStatus: string): Promise<void> {
        await updateWorkflowFields(itemId, { workflowReviewStatus: reviewStatus });
    }

    async clearItemReviewStatus(itemId: string): Promise<void> {
        await updateWorkflowFields(itemId, { workflowReviewStatus: null });
    }

    // --------------------------------------------------------
    // Implementation Phase (workflow-items collection)
    // --------------------------------------------------------

    hasImplementationPhaseField(): boolean {
        return true;
    }

    async getImplementationPhase(itemId: string): Promise<string | null> {
        const doc = await findWorkflowItemById(itemId);
        return doc?.implementationPhase || null;
    }

    async setImplementationPhase(itemId: string, value: string): Promise<void> {
        await updateWorkflowFields(itemId, { implementationPhase: value });
    }

    async clearImplementationPhase(itemId: string): Promise<void> {
        await updateWorkflowFields(itemId, { implementationPhase: null });
    }

    // --------------------------------------------------------
    // Issues (delegates to GitHubClient, except addIssueToProject)
    // --------------------------------------------------------

    async createIssue(title: string, body: string, labels?: string[]): Promise<CreateIssueResult> {
        return this.githubClient.createIssue(title, body, labels);
    }

    async updateIssueBody(issueNumber: number, body: string): Promise<void> {
        return this.githubClient.updateIssueBody(issueNumber, body);
    }

    async addIssueComment(issueNumber: number, body: string): Promise<number> {
        return this.githubClient.addIssueComment(issueNumber, body);
    }

    async getIssueComments(issueNumber: number): Promise<ProjectItemComment[]> {
        return this.githubClient.getIssueComments(issueNumber);
    }

    async getIssueDetails(issueNumber: number): Promise<GitHubIssueDetails | null> {
        return this.githubClient.getIssueDetails(issueNumber);
    }

    async addIssueToProject(
        _issueNodeId: string,
        context?: {
            type: 'feature' | 'bug' | 'task';
            mongoId: string;
            title: string;
            description?: string;
            labels?: string[];
            githubIssueNumber: number;
            githubIssueUrl: string;
        }
    ): Promise<string> {
        if (!context) {
            throw new Error('AppProjectAdapter.addIssueToProject requires context');
        }

        // Determine sourceRef based on type
        const sourceCollection = context.type === 'feature' ? 'feature-requests' as const
            : context.type === 'bug' ? 'reports' as const
            : undefined;

        const now = new Date();
        const doc = await createWorkflowItem({
            type: context.type,
            title: context.title,
            description: context.description,
            status: STATUSES.backlog,
            sourceRef: sourceCollection ? {
                collection: sourceCollection,
                id: new ObjectId(context.mongoId),
            } : undefined,
            githubIssueNumber: context.githubIssueNumber,
            githubIssueUrl: context.githubIssueUrl,
            githubIssueTitle: context.title,
            labels: context.labels,
            createdAt: now,
            updatedAt: now,
        });

        return doc._id.toHexString();
    }

    async findIssueCommentByMarker(issueNumber: number, marker: string): Promise<{
        id: number;
        body: string;
    } | null> {
        return this.githubClient.findIssueCommentByMarker(issueNumber, marker);
    }

    async updateIssueComment(issueNumber: number, commentId: number, body: string): Promise<void> {
        return this.githubClient.updateIssueComment(issueNumber, commentId, body);
    }

    // --------------------------------------------------------
    // Pull Requests (delegates to GitHubClient)
    // --------------------------------------------------------

    async createPullRequest(
        head: string,
        base: string,
        title: string,
        body: string,
        reviewers?: string[]
    ): Promise<CreatePRResult> {
        return this.githubClient.createPullRequest(head, base, title, body, reviewers);
    }

    async getPRReviewComments(prNumber: number): Promise<PRReviewComment[]> {
        return this.githubClient.getPRReviewComments(prNumber);
    }

    async getPRComments(prNumber: number): Promise<ProjectItemComment[]> {
        return this.githubClient.getPRComments(prNumber);
    }

    async getPRFiles(prNumber: number): Promise<string[]> {
        return this.githubClient.getPRFiles(prNumber);
    }

    async addPRComment(prNumber: number, body: string): Promise<number> {
        return this.githubClient.addPRComment(prNumber, body);
    }

    async requestPRReviewers(prNumber: number, reviewers: string[]): Promise<void> {
        return this.githubClient.requestPRReviewers(prNumber, reviewers);
    }

    async submitPRReview(
        prNumber: number,
        event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
        body: string
    ): Promise<void> {
        return this.githubClient.submitPRReview(prNumber, event, body);
    }

    async getPRDetails(prNumber: number): Promise<{ state: 'open' | 'closed'; merged: boolean; headBranch: string } | null> {
        return this.githubClient.getPRDetails(prNumber);
    }

    async mergePullRequest(
        prNumber: number,
        commitTitle: string,
        commitMessage: string
    ): Promise<string> {
        return this.githubClient.mergePullRequest(prNumber, commitTitle, commitMessage);
    }

    async getMergeCommitSha(prNumber: number): Promise<string | null> {
        return this.githubClient.getMergeCommitSha(prNumber);
    }

    async createRevertPR(
        mergeCommitSha: string,
        originalPrNumber: number,
        issueNumber: number
    ): Promise<{ prNumber: number; url: string } | null> {
        return this.githubClient.createRevertPR(mergeCommitSha, originalPrNumber, issueNumber);
    }

    async findPRCommentByMarker(prNumber: number, marker: string): Promise<{
        id: number;
        body: string;
    } | null> {
        return this.githubClient.findPRCommentByMarker(prNumber, marker);
    }

    async updatePRComment(prNumber: number, commentId: number, body: string): Promise<void> {
        return this.githubClient.updatePRComment(prNumber, commentId, body);
    }

    async getPRInfo(prNumber: number): Promise<{
        title: string;
        body: string;
        additions: number;
        deletions: number;
        changedFiles: number;
        commits: number;
    } | null> {
        return this.githubClient.getPRInfo(prNumber);
    }

    async findOpenPRForIssue(issueNumber: number): Promise<{ prNumber: number; branchName: string } | null> {
        return this.githubClient.findOpenPRForIssue(issueNumber);
    }

    // --------------------------------------------------------
    // Branches (delegates to GitHubClient)
    // --------------------------------------------------------

    async getDefaultBranch(): Promise<string> {
        return this.githubClient.getDefaultBranch();
    }

    async createBranch(branchName: string, baseBranch?: string): Promise<void> {
        return this.githubClient.createBranch(branchName, baseBranch);
    }

    async branchExists(branchName: string): Promise<boolean> {
        return this.githubClient.branchExists(branchName);
    }

    async deleteBranch(branchName: string): Promise<void> {
        return this.githubClient.deleteBranch(branchName);
    }

    // --------------------------------------------------------
    // Project Fields (static definitions)
    // --------------------------------------------------------

    async getProjectFields(): Promise<ProjectField[]> {
        return [
            {
                id: 'status',
                name: 'Status',
                dataType: 'SINGLE_SELECT',
                options: Object.values(STATUSES).map((name, i) => ({
                    id: `status-${i}`,
                    name,
                })),
            },
            {
                id: 'review-status',
                name: REVIEW_STATUS_FIELD,
                dataType: 'SINGLE_SELECT',
                options: Object.values(REVIEW_STATUSES).map((name, i) => ({
                    id: `review-${i}`,
                    name,
                })),
            },
            {
                id: 'implementation-phase',
                name: IMPLEMENTATION_PHASE_FIELD,
                dataType: 'TEXT',
            },
        ];
    }

    // --------------------------------------------------------
    // File Operations (delegates to GitHubClient)
    // --------------------------------------------------------

    async createOrUpdateFileContents(path: string, content: string, message: string): Promise<void> {
        return this.githubClient.createOrUpdateFileContents(path, content, message);
    }

    // ============================================================
    // PRIVATE: WorkflowItemDocument -> ProjectItem Conversion
    // ============================================================

    private workflowItemToProjectItem(doc: WorkflowItemDocument): ProjectItem {
        const itemId = doc._id.toHexString();
        const { owner, repo } = getProjectConfig().github;

        const fieldValues: ProjectItemFieldValue[] = [];
        if (doc.status) {
            fieldValues.push({ fieldId: 'status', fieldName: 'Status', value: doc.status });
        }
        if (doc.reviewStatus) {
            fieldValues.push({ fieldId: 'review-status', fieldName: REVIEW_STATUS_FIELD, value: doc.reviewStatus });
        }
        if (doc.implementationPhase) {
            fieldValues.push({ fieldId: 'implementation-phase', fieldName: IMPLEMENTATION_PHASE_FIELD, value: doc.implementationPhase });
        }

        const labels = doc.labels || (doc.type === 'feature' ? ['feature'] : doc.type === 'bug' ? ['bug'] : ['task']);

        const content: ProjectItemContent = {
            type: 'Issue',
            id: itemId,
            number: doc.githubIssueNumber,
            title: doc.githubIssueTitle || doc.title,
            body: doc.description || '',
            url: doc.githubIssueUrl,
            state: 'OPEN',
            labels,
            repoOwner: owner,
            repoName: repo,
        };

        return {
            id: itemId,
            status: (doc.status as Status) || null,
            reviewStatus: (doc.reviewStatus as ReviewStatus) || null,
            content,
            fieldValues,
        };
    }
}
