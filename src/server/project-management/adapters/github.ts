/**
 * GitHub Projects V2 Adapter
 *
 * Implements the ProjectManagementAdapter interface using GitHub's GraphQL and REST APIs.
 * Consolidates code from the previous implementations in:
 * - scripts/agents/shared/github.ts
 * - src/server/github/client.ts
 */

import { Octokit } from '@octokit/rest';
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
    ProjectFieldOption,
    ListItemsOptions,
} from '../types';
import { getProjectConfig, REVIEW_STATUS_FIELD, type ProjectConfig } from '../config';

/**
 * Execute with exponential backoff retry on rate limit
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000
): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            const isRateLimit =
                error instanceof Error &&
                'status' in error &&
                (error as { status: number }).status === 403;

            if (isRateLimit && attempt < maxRetries - 1) {
                const delay = baseDelayMs * Math.pow(2, attempt);
                console.warn(`  Rate limited, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error('Max retries exceeded');
}

/**
 * GitHub Projects V2 Adapter
 */
export class GitHubProjectsAdapter implements ProjectManagementAdapter {
    private octokit: Octokit | null = null; // Admin token for project operations
    private botOctokit: Octokit | null = null; // Bot token for PRs, issues, comments
    private config: ProjectConfig;
    private projectId: string | null = null;
    private statusFieldId: string | null = null;
    private reviewStatusFieldId: string | null = null;
    private statusOptions: Map<string, string> = new Map();
    private reviewStatusOptions: Map<string, string> = new Map();
    private _initialized = false;

    constructor(config?: ProjectConfig) {
        this.config = config || getProjectConfig();
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    async init(): Promise<void> {
        if (this._initialized) return;

        const adminToken = this.getAdminToken();
        const botToken = this.getBotToken();

        this.octokit = new Octokit({ auth: adminToken });
        this.botOctokit = new Octokit({ auth: botToken });

        await this.fetchProjectInfo();
        this._initialized = true;
    }

    isInitialized(): boolean {
        return this._initialized;
    }

    /**
     * Get admin token for GitHub Projects operations
     */
    private getAdminToken(): string {
        let token = process.env.GITHUB_TOKEN;

        if (!token) {
            throw new Error('GITHUB_TOKEN environment variable is required (admin token for GitHub Projects)');
        }

        // Strip quotes that may be added in cloud environments
        token = token.replace(/^["']|["']$/g, '');

        return token;
    }

    /**
     * Get bot token for PRs, issues, and comments
     * Falls back to admin token if bot token not provided
     */
    private getBotToken(): string {
        let token = process.env.GITHUB_BOT_TOKEN || process.env.GITHUB_TOKEN;

        if (!token) {
            throw new Error('GITHUB_BOT_TOKEN or GITHUB_TOKEN environment variable is required');
        }

        // Strip quotes that may be added in cloud environments
        token = token.replace(/^["']|["']$/g, '');

        return token;
    }

    /**
     * Get Octokit client for admin operations (GitHub Projects)
     */
    private getOctokit(): Octokit {
        if (!this.octokit) {
            throw new Error('GitHub client not initialized. Call init() first.');
        }
        return this.octokit;
    }

    /**
     * Get Octokit client for bot operations (PRs, issues, comments)
     */
    private getBotOctokit(): Octokit {
        if (!this.botOctokit) {
            throw new Error('GitHub bot client not initialized. Call init() first.');
        }
        return this.botOctokit;
    }

    private async fetchProjectInfo(): Promise<void> {
        const oc = this.getOctokit();
        const { owner, projectNumber, ownerType } = this.config.github;

        const projectQuery =
            ownerType === 'user'
                ? `query($login: String!, $number: Int!) {
                    user(login: $login) {
                        projectV2(number: $number) {
                            id
                            title
                        }
                    }
                }`
                : `query($login: String!, $number: Int!) {
                    organization(login: $login) {
                        projectV2(number: $number) {
                            id
                            title
                        }
                    }
                }`;

        const projectResult = await oc.graphql<{
            user?: { projectV2: { id: string; title: string } };
            organization?: { projectV2: { id: string; title: string } };
        }>(projectQuery, {
            login: owner,
            number: projectNumber,
        });

        const project =
            ownerType === 'user' ? projectResult.user?.projectV2 : projectResult.organization?.projectV2;

        if (!project) {
            throw new Error(`Project not found: ${owner}/projects/${projectNumber}`);
        }

        this.projectId = project.id;
        await this.fetchProjectFields();
    }

    private async fetchProjectFields(): Promise<void> {
        const oc = this.getOctokit();

        const fieldsQuery = `query($projectId: ID!) {
            node(id: $projectId) {
                ... on ProjectV2 {
                    fields(first: 50) {
                        nodes {
                            ... on ProjectV2Field {
                                id
                                name
                                dataType
                            }
                            ... on ProjectV2SingleSelectField {
                                id
                                name
                                options {
                                    id
                                    name
                                }
                            }
                        }
                    }
                }
            }
        }`;

        const result = await oc.graphql<{
            node: {
                fields: {
                    nodes: Array<{
                        id: string;
                        name: string;
                        dataType?: string;
                        options?: Array<{ id: string; name: string }>;
                    }>;
                };
            };
        }>(fieldsQuery, {
            projectId: this.projectId,
        });

        for (const field of result.node.fields.nodes) {
            if (field.name === 'Status' && field.options) {
                this.statusFieldId = field.id;
                for (const option of field.options) {
                    this.statusOptions.set(option.name, option.id);
                }
            }

            if (field.name === REVIEW_STATUS_FIELD && field.options) {
                this.reviewStatusFieldId = field.id;
                for (const option of field.options) {
                    this.reviewStatusOptions.set(option.name, option.id);
                }
            }
        }

        if (!this.statusFieldId) {
            throw new Error('Status field not found in project');
        }
    }

    // ============================================================
    // PROJECT ITEMS
    // ============================================================

    async listItems(options?: ListItemsOptions): Promise<ProjectItem[]> {
        return withRetry(async () => {
            const oc = this.getOctokit();
            const limit = options?.limit || 50;

            const query = `query($projectId: ID!, $first: Int!) {
            node(id: $projectId) {
                ... on ProjectV2 {
                    items(first: $first) {
                        nodes {
                            id
                            content {
                                ... on Issue {
                                    id
                                    number
                                    title
                                    body
                                    url
                                    state
                                    labels(first: 10) {
                                        nodes {
                                            name
                                        }
                                    }
                                    repository {
                                        owner {
                                            login
                                        }
                                        name
                                    }
                                }
                                ... on DraftIssue {
                                    id
                                    title
                                    body
                                }
                                ... on PullRequest {
                                    id
                                    number
                                    title
                                    body
                                    url
                                    state
                                    repository {
                                        owner {
                                            login
                                        }
                                        name
                                    }
                                }
                            }
                            fieldValues(first: 20) {
                                nodes {
                                    ... on ProjectV2ItemFieldSingleSelectValue {
                                        name
                                        optionId
                                        field {
                                            ... on ProjectV2SingleSelectField {
                                                id
                                                name
                                            }
                                        }
                                    }
                                    ... on ProjectV2ItemFieldTextValue {
                                        text
                                        field {
                                            ... on ProjectV2Field {
                                                id
                                                name
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }`;

        const result = await oc.graphql<{
            node: {
                items: {
                    nodes: Array<{
                        id: string;
                        content: {
                            id: string;
                            number?: number;
                            title: string;
                            body: string;
                            url?: string;
                            state?: string;
                            labels?: { nodes: Array<{ name: string }> };
                            repository?: { owner: { login: string }; name: string };
                        } | null;
                        fieldValues: {
                            nodes: Array<{
                                name?: string;
                                text?: string;
                                optionId?: string;
                                field?: { id: string; name: string };
                            }>;
                        };
                    }>;
                };
            };
        }>(query, {
            projectId: this.projectId,
            first: limit,
        });

        const items: ProjectItem[] = [];

        for (const node of result.node.items.nodes) {
            const item = this.parseProjectItemNode(node);

            // Apply filters
            if (options?.status && item.status !== options.status) continue;
            if (options?.reviewStatus && item.reviewStatus !== options.reviewStatus) continue;

            items.push(item);
        }

        return items;
        });
    }

    async getItem(itemId: string): Promise<ProjectItem | null> {
        const oc = this.getOctokit();

        const query = `query($itemId: ID!) {
            node(id: $itemId) {
                ... on ProjectV2Item {
                    id
                    content {
                        ... on Issue {
                            id
                            number
                            title
                            body
                            url
                            state
                            labels(first: 10) {
                                nodes {
                                    name
                                }
                            }
                            repository {
                                owner {
                                    login
                                }
                                name
                            }
                        }
                        ... on DraftIssue {
                            id
                            title
                            body
                        }
                    }
                    fieldValues(first: 20) {
                        nodes {
                            ... on ProjectV2ItemFieldSingleSelectValue {
                                name
                                optionId
                                field {
                                    ... on ProjectV2SingleSelectField {
                                        id
                                        name
                                    }
                                }
                            }
                            ... on ProjectV2ItemFieldTextValue {
                                text
                                field {
                                    ... on ProjectV2Field {
                                        id
                                        name
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }`;

        const result = await oc.graphql<{
            node: {
                id: string;
                content: {
                    id: string;
                    number?: number;
                    title: string;
                    body: string;
                    url?: string;
                    state?: string;
                    labels?: { nodes: Array<{ name: string }> };
                    repository?: { owner: { login: string }; name: string };
                } | null;
                fieldValues: {
                    nodes: Array<{
                        name?: string;
                        text?: string;
                        optionId?: string;
                        field?: { id: string; name: string };
                    }>;
                };
            } | null;
        }>(query, {
            itemId,
        });

        if (!result.node) return null;

        return this.parseProjectItemNode(result.node);
    }

    private parseProjectItemNode(node: {
        id: string;
        content: {
            id: string;
            number?: number;
            title: string;
            body: string;
            url?: string;
            state?: string;
            labels?: { nodes: Array<{ name: string }> };
            repository?: { owner: { login: string }; name: string };
        } | null;
        fieldValues: {
            nodes: Array<{
                name?: string;
                text?: string;
                optionId?: string;
                field?: { id: string; name: string };
            }>;
        };
    }): ProjectItem {
        let status: string | null = null;
        let reviewStatus: string | null = null;
        const fieldValues: ProjectItemFieldValue[] = [];

        for (const fv of node.fieldValues.nodes) {
            if (fv.field?.name === 'Status' && fv.name) {
                status = fv.name;
            }
            if (fv.field?.name === REVIEW_STATUS_FIELD && fv.name) {
                reviewStatus = fv.name;
            }
            if (fv.field) {
                fieldValues.push({
                    fieldId: fv.field.id,
                    fieldName: fv.field.name,
                    value: fv.name || fv.text || null,
                    optionId: fv.optionId,
                });
            }
        }

        let content: ProjectItemContent | null = null;
        if (node.content) {
            const c = node.content;
            content = {
                type: c.url?.includes('/pull/') ? 'PullRequest' : c.number ? 'Issue' : 'DraftIssue',
                id: c.id,
                number: c.number,
                title: c.title,
                body: c.body,
                url: c.url,
                state: c.state as 'OPEN' | 'CLOSED' | undefined,
                labels: c.labels?.nodes.map((l) => l.name),
                repoOwner: c.repository?.owner.login,
                repoName: c.repository?.name,
            };
        }

        return {
            id: node.id,
            status: status as ProjectItem['status'],
            reviewStatus: reviewStatus as ProjectItem['reviewStatus'],
            content,
            fieldValues,
        };
    }

    // ============================================================
    // STATUS MANAGEMENT
    // ============================================================

    async getAvailableStatuses(): Promise<string[]> {
        return Array.from(this.statusOptions.keys());
    }

    async getAvailableReviewStatuses(): Promise<string[]> {
        return Array.from(this.reviewStatusOptions.keys());
    }

    hasReviewStatusField(): boolean {
        return this.reviewStatusFieldId !== null;
    }

    async updateItemStatus(itemId: string, status: string): Promise<void> {
        return withRetry(async () => {
            const oc = this.getOctokit();

            const optionId = this.statusOptions.get(status);
            if (!optionId) {
                throw new Error(
                    `Unknown status: ${status}. Available: ${Array.from(this.statusOptions.keys()).join(', ')}`
                );
            }

            const mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
                updateProjectV2ItemFieldValue(
                    input: {
                        projectId: $projectId
                        itemId: $itemId
                        fieldId: $fieldId
                        value: { singleSelectOptionId: $optionId }
                    }
                ) {
                    projectV2Item {
                        id
                    }
                }
            }`;

            await oc.graphql(mutation, {
                projectId: this.projectId,
                itemId,
                fieldId: this.statusFieldId,
                optionId,
            });
        });
    }

    async updateItemReviewStatus(itemId: string, reviewStatus: string): Promise<void> {
        return withRetry(async () => {
            const oc = this.getOctokit();

            if (!this.reviewStatusFieldId) {
                throw new Error(`Review Status field "${REVIEW_STATUS_FIELD}" not found in project`);
            }

            const optionId = this.reviewStatusOptions.get(reviewStatus);
            if (!optionId) {
                throw new Error(
                    `Unknown review status: ${reviewStatus}. Available: ${Array.from(this.reviewStatusOptions.keys()).join(', ')}`
                );
            }

            const mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
                updateProjectV2ItemFieldValue(
                    input: {
                        projectId: $projectId
                        itemId: $itemId
                        fieldId: $fieldId
                        value: { singleSelectOptionId: $optionId }
                    }
                ) {
                    projectV2Item {
                        id
                    }
                }
            }`;

            await oc.graphql(mutation, {
                projectId: this.projectId,
                itemId,
                fieldId: this.reviewStatusFieldId,
                optionId,
            });
        });
    }

    async clearItemReviewStatus(itemId: string): Promise<void> {
        const oc = this.getOctokit();

        if (!this.reviewStatusFieldId) {
            throw new Error(`Review Status field "${REVIEW_STATUS_FIELD}" not found in project`);
        }

        const mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
            clearProjectV2ItemFieldValue(
                input: {
                    projectId: $projectId
                    itemId: $itemId
                    fieldId: $fieldId
                }
            ) {
                projectV2Item {
                    id
                }
            }
        }`;

        await oc.graphql(mutation, {
            projectId: this.projectId,
            itemId,
            fieldId: this.reviewStatusFieldId,
        });
    }

    // ============================================================
    // ISSUES
    // ============================================================

    async createIssue(title: string, body: string, labels?: string[]): Promise<CreateIssueResult> {
        const oc = this.getBotOctokit(); // Use bot token for creating issues
        const { owner, repo } = this.config.github;

        const { data } = await oc.issues.create({
            owner,
            repo,
            title,
            body,
            labels,
        });

        return {
            number: data.number,
            nodeId: data.node_id,
            url: data.html_url,
        };
    }

    async updateIssueBody(issueNumber: number, body: string): Promise<void> {
        const oc = this.getBotOctokit(); // Use bot token for updating issues
        const { owner, repo } = this.config.github;

        await oc.issues.update({
            owner,
            repo,
            issue_number: issueNumber,
            body,
        });
    }

    async addIssueComment(issueNumber: number, body: string): Promise<number> {
        return withRetry(async () => {
            const oc = this.getBotOctokit(); // Use bot token for creating comments
            const { owner, repo } = this.config.github;

            const { data } = await oc.issues.createComment({
                owner,
                repo,
                issue_number: issueNumber,
                body,
            });

            return data.id;
        });
    }

    async getIssueComments(issueNumber: number): Promise<ProjectItemComment[]> {
        const oc = this.getBotOctokit(); // Use bot token for reading comments
        const { owner, repo } = this.config.github;

        const { data } = await oc.issues.listComments({
            owner,
            repo,
            issue_number: issueNumber,
            per_page: 100,
        });

        return data.map((comment) => ({
            id: comment.id,
            body: comment.body || '',
            author: comment.user?.login || 'unknown',
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
        }));
    }

    async addIssueToProject(issueNodeId: string): Promise<string> {
        const oc = this.getOctokit();

        const mutation = `mutation($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(
                input: {
                    projectId: $projectId
                    contentId: $contentId
                }
            ) {
                item {
                    id
                }
            }
        }`;

        const result = await oc.graphql<{
            addProjectV2ItemById: { item: { id: string } };
        }>(mutation, {
            projectId: this.projectId,
            contentId: issueNodeId,
        });

        return result.addProjectV2ItemById.item.id;
    }

    // ============================================================
    // PULL REQUESTS
    // ============================================================

    async createPullRequest(
        head: string,
        base: string,
        title: string,
        body: string
    ): Promise<CreatePRResult> {
        const oc = this.getBotOctokit(); // Use bot token for creating PRs
        const { owner, repo } = this.config.github;

        const { data } = await oc.pulls.create({
            owner,
            repo,
            head,
            base,
            title,
            body,
        });

        return {
            number: data.number,
            url: data.html_url,
        };
    }

    async getPRReviewComments(prNumber: number): Promise<PRReviewComment[]> {
        const oc = this.getBotOctokit(); // Use bot token for reading PR comments
        const { owner, repo } = this.config.github;

        const { data } = await oc.pulls.listReviewComments({
            owner,
            repo,
            pull_number: prNumber,
            per_page: 100,
        });

        return data.map((comment) => ({
            id: comment.id,
            body: comment.body,
            author: comment.user?.login || 'unknown',
            path: comment.path,
            line: comment.line || undefined,
            createdAt: comment.created_at,
        }));
    }

    async getPRComments(prNumber: number): Promise<ProjectItemComment[]> {
        const oc = this.getBotOctokit(); // Use bot token for reading PR comments
        const { owner, repo } = this.config.github;

        // PRs are issues in GitHub, so we use the issues API
        const { data } = await oc.issues.listComments({
            owner,
            repo,
            issue_number: prNumber,
            per_page: 100,
        });

        return data.map((comment) => ({
            id: comment.id,
            body: comment.body || '',
            author: comment.user?.login || 'unknown',
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
        }));
    }

    async addPRComment(prNumber: number, body: string): Promise<number> {
        return withRetry(async () => {
            const oc = this.getBotOctokit(); // Use bot token for creating PR comments
            const { owner, repo } = this.config.github;

            // PR comments are actually issue comments
            const { data } = await oc.issues.createComment({
                owner,
                repo,
                issue_number: prNumber,
                body,
            });

            return data.id;
        });
    }

    // ============================================================
    // BRANCHES
    // ============================================================

    async getDefaultBranch(): Promise<string> {
        const oc = this.getOctokit();
        const { owner, repo } = this.config.github;

        const { data } = await oc.repos.get({ owner, repo });
        return data.default_branch;
    }

    async createBranch(branchName: string): Promise<void> {
        const oc = this.getOctokit();
        const { owner, repo } = this.config.github;

        const defaultBranch = await this.getDefaultBranch();
        const { data: refData } = await oc.git.getRef({
            owner,
            repo,
            ref: `heads/${defaultBranch}`,
        });

        await oc.git.createRef({
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: refData.object.sha,
        });
    }

    async branchExists(branchName: string): Promise<boolean> {
        const oc = this.getOctokit();
        const { owner, repo } = this.config.github;

        try {
            await oc.git.getRef({
                owner,
                repo,
                ref: `heads/${branchName}`,
            });
            return true;
        } catch {
            return false;
        }
    }

    // ============================================================
    // PROJECT FIELDS
    // ============================================================

    async getProjectFields(): Promise<ProjectField[]> {
        const oc = this.getOctokit();

        const query = `query($projectId: ID!) {
            node(id: $projectId) {
                ... on ProjectV2 {
                    fields(first: 50) {
                        nodes {
                            ... on ProjectV2Field {
                                id
                                name
                                dataType
                            }
                            ... on ProjectV2SingleSelectField {
                                id
                                name
                                options {
                                    id
                                    name
                                    description
                                    color
                                }
                            }
                        }
                    }
                }
            }
        }`;

        const result = await oc.graphql<{
            node: {
                fields: {
                    nodes: Array<{
                        id: string;
                        name: string;
                        dataType?: string;
                        options?: ProjectFieldOption[];
                    }>;
                };
            };
        }>(query, {
            projectId: this.projectId,
        });

        return result.node.fields.nodes.map((field) => ({
            id: field.id,
            name: field.name,
            dataType: field.dataType || 'SINGLE_SELECT',
            options: field.options,
        }));
    }
}
