/**
 * GitHub Client
 *
 * Shared Octokit-based operations for GitHub Issues, PRs, Branches, and Files.
 * Used by AppProjectAdapter (and potentially other adapters) to interact with GitHub
 * without the GitHub Projects V2 dependency.
 */

import { Octokit } from '@octokit/rest';
import type {
    ProjectItemComment,
    PRReviewComment,
    CreateIssueResult,
    CreatePRResult,
    GitHubIssueDetails,
    LinkedPullRequest,
} from './types';
import { getProjectConfig, type ProjectConfig } from './config';

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
 * Shared GitHub Client for Issues, PRs, Branches, and Files.
 * Does NOT include GitHub Projects V2 operations.
 */
export class GitHubClient {
    private octokit: Octokit | null = null;
    private botOctokit: Octokit | null = null;
    private config: ProjectConfig;
    private _initialized = false;

    constructor(config?: ProjectConfig) {
        this.config = config || getProjectConfig();
    }

    async init(): Promise<void> {
        if (this._initialized) return;

        const adminToken = this.getAdminToken();
        const botToken = this.getBotToken();

        this.octokit = new Octokit({ auth: adminToken });
        this.botOctokit = new Octokit({ auth: botToken });

        this._initialized = true;
    }

    isInitialized(): boolean {
        return this._initialized;
    }

    // ============================================================
    // TOKEN MANAGEMENT
    // ============================================================

    private getAdminToken(): string {
        let token = process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('GITHUB_TOKEN environment variable is required');
        }
        token = token.replace(/^["']|["']$/g, '');
        return token;
    }

    private getBotToken(): string {
        let token = process.env.GITHUB_BOT_TOKEN;
        if (!token) {
            console.warn('⚠️  WARNING: GITHUB_BOT_TOKEN not set. PRs will be created by admin account.');
            token = process.env.GITHUB_TOKEN;
        }
        if (!token) {
            throw new Error('GITHUB_BOT_TOKEN or GITHUB_TOKEN environment variable is required');
        }
        token = token.replace(/^["']|["']$/g, '');
        return token;
    }

    private getOctokit(): Octokit {
        if (!this.octokit) {
            throw new Error('GitHub client not initialized. Call init() first.');
        }
        return this.octokit;
    }

    private getAdminOctokit(): Octokit {
        return this.getOctokit();
    }

    private getBotOctokit(): Octokit {
        if (!this.botOctokit) {
            throw new Error('GitHub bot client not initialized. Call init() first.');
        }
        return this.botOctokit;
    }

    // ============================================================
    // ISSUES
    // ============================================================

    async createIssue(title: string, body: string, labels?: string[]): Promise<CreateIssueResult> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        const { data } = await oc.issues.create({
            owner, repo, title, body, labels,
        });

        return {
            number: data.number,
            nodeId: data.node_id,
            url: data.html_url,
        };
    }

    async updateIssueBody(issueNumber: number, body: string): Promise<void> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;
        await oc.issues.update({ owner, repo, issue_number: issueNumber, body });
    }

    async addIssueComment(issueNumber: number, body: string): Promise<number> {
        return withRetry(async () => {
            const oc = this.getBotOctokit();
            const { owner, repo } = this.config.github;
            const { data } = await oc.issues.createComment({
                owner, repo, issue_number: issueNumber, body,
            });
            return data.id;
        });
    }

    async getIssueComments(issueNumber: number): Promise<ProjectItemComment[]> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        const { data } = await oc.issues.listComments({
            owner, repo, issue_number: issueNumber, per_page: 100,
        });

        return data.map((comment) => ({
            id: comment.id,
            body: comment.body || '',
            author: comment.user?.login || 'unknown',
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
        }));
    }

    async findIssueCommentByMarker(issueNumber: number, marker: string): Promise<{
        id: number;
        body: string;
    } | null> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        const { data: comments } = await oc.issues.listComments({
            owner, repo, issue_number: issueNumber, per_page: 100,
        });

        const comment = comments.find(c => c.body?.includes(marker));
        if (!comment) return null;

        return { id: comment.id, body: comment.body || '' };
    }

    async updateIssueComment(_issueNumber: number, commentId: number, body: string): Promise<void> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;
        await oc.issues.updateComment({ owner, repo, comment_id: commentId, body });
    }

    async getIssueDetails(issueNumber: number): Promise<GitHubIssueDetails | null> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        const query = `query($owner: String!, $repo: String!, $issueNumber: Int!) {
            repository(owner: $owner, name: $repo) {
                issue(number: $issueNumber) {
                    number
                    title
                    body
                    url
                    state
                    timelineItems(itemTypes: [CONNECTED_EVENT], last: 10) {
                        nodes {
                            ... on ConnectedEvent {
                                subject {
                                    ... on PullRequest {
                                        number
                                        url
                                        title
                                        state
                                        mergedAt
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }`;

        try {
            const result = await oc.graphql<{
                repository: {
                    issue: {
                        number: number;
                        title: string;
                        body: string;
                        url: string;
                        state: 'OPEN' | 'CLOSED';
                        timelineItems: {
                            nodes: Array<{
                                subject?: {
                                    number?: number;
                                    url?: string;
                                    title?: string;
                                    state?: string;
                                    mergedAt?: string;
                                };
                            }>;
                        };
                    } | null;
                };
            }>(query, { owner, repo, issueNumber });

            if (!result.repository.issue) return null;

            const issue = result.repository.issue;
            const linkedPullRequests: LinkedPullRequest[] = [];

            for (const item of issue.timelineItems.nodes) {
                if (item.subject && item.subject.number && item.subject.url && item.subject.title) {
                    linkedPullRequests.push({
                        number: item.subject.number,
                        url: item.subject.url,
                        title: item.subject.title,
                        state: item.subject.state as 'OPEN' | 'CLOSED' | 'MERGED',
                        mergedAt: item.subject.mergedAt,
                    });
                }
            }

            return {
                number: issue.number,
                title: issue.title,
                body: issue.body || '',
                url: issue.url,
                state: issue.state,
                linkedPullRequests,
            };
        } catch (error: unknown) {
            console.error('Error fetching issue details:', error);
            return null;
        }
    }

    // ============================================================
    // PULL REQUESTS
    // ============================================================

    async createPullRequest(
        head: string,
        base: string,
        title: string,
        body: string,
        reviewers?: string[]
    ): Promise<CreatePRResult> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        try {
            const { data } = await oc.pulls.create({ owner, repo, head, base, title, body });

            if (reviewers && reviewers.length > 0) {
                await oc.pulls.requestReviewers({
                    owner, repo, pull_number: data.number, reviewers,
                });
            }

            return { number: data.number, url: data.html_url };
        } catch (error: unknown) {
            const isAlreadyExistsError = error instanceof Error &&
                'status' in error &&
                (error as { status: number }).status === 422 &&
                error.message.includes('pull request already exists');

            if (isAlreadyExistsError) {
                const existingPR = await this.findOpenPRForBranch(head);
                if (existingPR) {
                    console.log(`  ℹ️  PR #${existingPR.prNumber} already exists for branch ${head}, using existing PR`);
                    return {
                        number: existingPR.prNumber,
                        url: `https://github.com/${owner}/${repo}/pull/${existingPR.prNumber}`,
                    };
                }
            }
            throw error;
        }
    }

    private async findOpenPRForBranch(branchName: string): Promise<{ prNumber: number; branchName: string } | null> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        try {
            const { data: prs } = await oc.pulls.list({
                owner, repo, head: `${owner}:${branchName}`, state: 'open', per_page: 1,
            });

            if (prs.length > 0) {
                return { prNumber: prs[0].number, branchName: prs[0].head.ref };
            }
            return null;
        } catch {
            return null;
        }
    }

    async getPRReviewComments(prNumber: number): Promise<PRReviewComment[]> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        const { data } = await oc.pulls.listReviewComments({
            owner, repo, pull_number: prNumber, per_page: 100,
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
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        const { data } = await oc.issues.listComments({
            owner, repo, issue_number: prNumber, per_page: 100,
        });

        return data.map((comment) => ({
            id: comment.id,
            body: comment.body || '',
            author: comment.user?.login || 'unknown',
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
        }));
    }

    async getPRFiles(prNumber: number): Promise<string[]> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        const { data } = await oc.pulls.listFiles({
            owner, repo, pull_number: prNumber, per_page: 100,
        });

        return data.map((file) => file.filename);
    }

    async addPRComment(prNumber: number, body: string): Promise<number> {
        return withRetry(async () => {
            const oc = this.getBotOctokit();
            const { owner, repo } = this.config.github;

            const { data } = await oc.issues.createComment({
                owner, repo, issue_number: prNumber, body,
            });

            return data.id;
        });
    }

    async requestPRReviewers(prNumber: number, reviewers: string[]): Promise<void> {
        return withRetry(async () => {
            const oc = this.getBotOctokit();
            const { owner, repo } = this.config.github;
            await oc.pulls.requestReviewers({ owner, repo, pull_number: prNumber, reviewers });
        });
    }

    async submitPRReview(
        prNumber: number,
        event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
        body: string
    ): Promise<void> {
        return withRetry(async () => {
            const oc = this.getAdminOctokit();
            const { owner, repo } = this.config.github;
            await oc.pulls.createReview({ owner, repo, pull_number: prNumber, event, body });
        });
    }

    async getPRDetails(prNumber: number): Promise<{ state: 'open' | 'closed'; merged: boolean; headBranch: string } | null> {
        try {
            const oc = this.getOctokit();
            const { owner, repo } = this.config.github;
            const { data } = await oc.pulls.get({ owner, repo, pull_number: prNumber });
            return {
                state: data.state as 'open' | 'closed',
                merged: data.merged || false,
                headBranch: data.head.ref,
            };
        } catch {
            return null;
        }
    }

    async mergePullRequest(
        prNumber: number,
        commitTitle: string,
        commitMessage: string
    ): Promise<string> {
        return withRetry(async () => {
            const oc = this.getOctokit();
            const { owner, repo } = this.config.github;

            const result = await oc.pulls.merge({
                owner, repo, pull_number: prNumber,
                merge_method: 'squash',
                commit_title: commitTitle,
                commit_message: commitMessage,
            });

            return result.data.sha;
        });
    }

    async getMergeCommitSha(prNumber: number): Promise<string | null> {
        try {
            const oc = this.getOctokit();
            const { owner, repo } = this.config.github;
            const { data: pr } = await oc.pulls.get({ owner, repo, pull_number: prNumber });
            return pr.merge_commit_sha || null;
        } catch {
            return null;
        }
    }

    async createRevertPR(
        mergeCommitSha: string,
        originalPrNumber: number,
        issueNumber: number
    ): Promise<{ prNumber: number; url: string } | null> {
        try {
            const oc = this.getOctokit();
            const botOc = this.getBotOctokit();
            const { owner, repo } = this.config.github;

            const { data: originalPr } = await oc.pulls.get({ owner, repo, pull_number: originalPrNumber });
            const defaultBranch = await this.getDefaultBranch();
            const revertBranchName = `revert-${originalPrNumber}-${mergeCommitSha.slice(0, 7)}`;

            const { data: defaultBranchRef } = await oc.git.getRef({
                owner, repo, ref: `heads/${defaultBranch}`,
            });

            try {
                await oc.git.createRef({
                    owner, repo, ref: `refs/heads/${revertBranchName}`, sha: defaultBranchRef.object.sha,
                });
            } catch (error: unknown) {
                const isRefExists = error instanceof Error &&
                    'status' in error &&
                    (error as { status: number }).status === 422;
                if (!isRefExists) throw error;
            }

            const { data: mergeCommit } = await oc.git.getCommit({ owner, repo, commit_sha: mergeCommitSha });
            const parentSha = mergeCommit.parents[0]?.sha;
            if (!parentSha) {
                console.error('Cannot revert: merge commit has no parent');
                return null;
            }

            const { data: parentCommit } = await oc.git.getCommit({ owner, repo, commit_sha: parentSha });

            const { data: revertCommit } = await oc.git.createCommit({
                owner, repo,
                message: `Revert "${originalPr.title}"\n\nThis reverts commit ${mergeCommitSha}.\n\nPart of #${issueNumber}`,
                tree: parentCommit.tree.sha,
                parents: [defaultBranchRef.object.sha],
            });

            await oc.git.updateRef({
                owner, repo, ref: `heads/${revertBranchName}`, sha: revertCommit.sha, force: true,
            });

            const { data: revertPr } = await botOc.pulls.create({
                owner, repo,
                title: `Revert: ${originalPr.title}`,
                head: revertBranchName,
                base: defaultBranch,
                body: `This reverts PR #${originalPrNumber} (commit ${mergeCommitSha}).\n\nPart of #${issueNumber}`,
            });

            console.log(`Created revert PR #${revertPr.number} for PR #${originalPrNumber}`);
            return { prNumber: revertPr.number, url: revertPr.html_url };
        } catch (error) {
            console.error('Failed to create revert PR:', error);
            return null;
        }
    }

    async findPRCommentByMarker(prNumber: number, marker: string): Promise<{
        id: number;
        body: string;
    } | null> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        const { data: comments } = await oc.issues.listComments({
            owner, repo, issue_number: prNumber, per_page: 100,
        });

        const comment = comments.find(c => c.body?.includes(marker));
        if (!comment) return null;

        return { id: comment.id, body: comment.body || '' };
    }

    async updatePRComment(_prNumber: number, commentId: number, body: string): Promise<void> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;
        await oc.issues.updateComment({ owner, repo, comment_id: commentId, body });
    }

    async getPRInfo(prNumber: number): Promise<{
        title: string;
        body: string;
        additions: number;
        deletions: number;
        changedFiles: number;
        commits: number;
    } | null> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        try {
            const { data: pr } = await oc.pulls.get({ owner, repo, pull_number: prNumber });
            return {
                title: pr.title,
                body: pr.body || '',
                additions: pr.additions,
                deletions: pr.deletions,
                changedFiles: pr.changed_files,
                commits: pr.commits,
            };
        } catch {
            return null;
        }
    }

    async findOpenPRForIssue(issueNumber: number): Promise<{ prNumber: number; branchName: string } | null> {
        try {
            const oc = this.getOctokit();
            const { owner, repo } = this.config.github;

            const { data: prs } = await oc.pulls.list({
                owner, repo, state: 'open', per_page: 100,
            });

            const issuePatterns = [
                new RegExp(`Closes\\s+#${issueNumber}\\b`, 'i'),
                new RegExp(`Part of\\s+#${issueNumber}\\b`, 'i'),
                new RegExp(`#${issueNumber}\\b`),
            ];

            for (const pr of prs) {
                const body = pr.body || '';
                const matchesIssue = issuePatterns.some(pattern => pattern.test(body));
                if (matchesIssue) {
                    return { prNumber: pr.number, branchName: pr.head.ref };
                }
            }

            return null;
        } catch {
            return null;
        }
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

    async createBranch(branchName: string, baseBranch?: string): Promise<void> {
        const oc = this.getOctokit();
        const { owner, repo } = this.config.github;

        const sourceBranch = baseBranch || await this.getDefaultBranch();
        const { data: refData } = await oc.git.getRef({ owner, repo, ref: `heads/${sourceBranch}` });

        await oc.git.createRef({
            owner, repo, ref: `refs/heads/${branchName}`, sha: refData.object.sha,
        });
    }

    async branchExists(branchName: string): Promise<boolean> {
        const oc = this.getOctokit();
        const { owner, repo } = this.config.github;

        console.log(`  🔍 Checking if branch exists on GitHub: ${branchName}`);
        try {
            await oc.git.getRef({ owner, repo, ref: `heads/${branchName}` });
            console.log(`  ✅ Branch exists on GitHub`);
            return true;
        } catch {
            console.log(`  ℹ️  Branch not found on GitHub (404 is expected - will create it)`);
            return false;
        }
    }

    async deleteBranch(branchName: string): Promise<void> {
        const oc = this.getOctokit();
        const { owner, repo } = this.config.github;
        const defaultBranch = await this.getDefaultBranch();

        if (branchName === defaultBranch) {
            console.warn(`  ⚠️ Refusing to delete default branch: ${branchName}`);
            return;
        }

        try {
            await oc.git.deleteRef({ owner, repo, ref: `heads/${branchName}` });
            console.log(`  🗑️ Deleted branch: ${branchName}`);
        } catch (error: unknown) {
            const is404 = error instanceof Error &&
                'status' in error &&
                (error as { status: number }).status === 404;
            if (is404) {
                console.log(`  ℹ️ Branch already deleted or doesn't exist: ${branchName}`);
            } else {
                throw error;
            }
        }
    }

    // ============================================================
    // FILE OPERATIONS
    // ============================================================

    async createOrUpdateFileContents(
        path: string,
        content: string,
        message: string
    ): Promise<void> {
        const oc = this.getBotOctokit();
        const { owner, repo } = this.config.github;

        const base64Content = Buffer.from(content, 'utf-8').toString('base64');

        let sha: string | undefined;
        try {
            const { data: existingFile } = await oc.repos.getContent({ owner, repo, path });
            if (!Array.isArray(existingFile) && existingFile.type === 'file') {
                sha = existingFile.sha;
            }
        } catch (error: unknown) {
            const is404 = error instanceof Error &&
                'status' in error &&
                (error as { status: number }).status === 404;
            if (!is404) {
                throw error;
            }
        }

        await oc.repos.createOrUpdateFileContents({
            owner, repo, path, message, content: base64Content, sha,
        });

        console.log(`  [LOG:GITHUB] File ${sha ? 'updated' : 'created'}: ${path}`);
    }
}
