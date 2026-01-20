#!/usr/bin/env npx tsx
import '../src/agents/shared/loadEnv';

/**
 * GitHub PR Actions CLI
 *
 * A CLI tool for performing common GitHub PR actions using GITHUB_TOKEN.
 *
 * Usage:
 *   npx tsx scripts/github-pr.ts <command> [options]
 *
 * Commands:
 *   create      Create a new PR
 *   comment     Add a comment to a PR
 *   title       Update PR title
 *   body        Update PR description/body
 *   label       Add or remove labels
 *   reviewer    Request reviewers
 *   merge       Merge a PR
 *   close       Close a PR
 *   info        Get PR information
 *
 * Examples:
 *   npx tsx scripts/github-pr.ts create --title "feat: new feature" --body "Description"
 *   npx tsx scripts/github-pr.ts create --title "fix: bug" --head my-branch --base main --draft
 *   npx tsx scripts/github-pr.ts comment --pr 123 --message "LGTM!"
 *   npx tsx scripts/github-pr.ts title --pr 123 --text "feat: new feature"
 *   npx tsx scripts/github-pr.ts label --pr 123 --add bug,urgent
 *   npx tsx scripts/github-pr.ts merge --pr 123 --method squash
 */

import { Octokit } from '@octokit/rest';
import { Command } from 'commander';

// ============================================================================
// Cloud Proxy Support (for Claude Code Web environment)
// ============================================================================

/**
 * Sets up HTTP proxy for cloud environments.
 * Uses Node.js 18+'s built-in undici module to route requests through proxy.
 * Must be called before any HTTP requests (Octokit initialization).
 */
function setupCloudProxy(): void {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxyUrl) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ProxyAgent, setGlobalDispatcher } = require('undici');
        setGlobalDispatcher(new ProxyAgent(proxyUrl));
        console.log('☁️  Cloud proxy enabled');
    }
}

// ============================================================================
// Configuration
// ============================================================================

interface Config {
    token: string;
    owner: string;
    repo: string;
}

function getConfig(cloudProxy = false): Config {
    let token = process.env.GITHUB_TOKEN;

    // Cloud environments may add literal quotes around env values
    if (cloudProxy && token) {
        token = token.replace(/^["']|["']$/g, '');
    }

    if (!token) {
        console.error('Error: GITHUB_TOKEN environment variable is required');
        console.error('Set it with: export GITHUB_TOKEN=your_token');
        process.exit(1);
    }

    // Try to get owner/repo from git remote
    const { owner, repo } = getRepoFromGit();

    return { token, owner, repo };
}

function getRepoFromGit(): { owner: string; repo: string } {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { execSync } = require('child_process');
        const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();

        // Parse GitHub URL (supports HTTPS, SSH, and cloud proxy formats)
        // https://github.com/owner/repo.git
        // git@github.com:owner/repo.git
        // http://proxy@127.0.0.1:53824/git/owner/repo (cloud proxy format)
        const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
        const sshMatch = remoteUrl.match(/github\.com:([^/]+)\/([^/.]+)/);
        const proxyMatch = remoteUrl.match(/\/git\/([^/]+)\/([^/.]+)/);

        const match = httpsMatch || sshMatch || proxyMatch;
        if (match) {
            return { owner: match[1], repo: match[2] };
        }
    } catch {
        // Ignore errors
    }

    console.error('Error: Could not determine GitHub owner/repo from git remote');
    console.error('Use --owner and --repo options to specify manually');
    process.exit(1);
}

function createOctokit(token: string): Octokit {
    return new Octokit({ auth: token });
}

function getCurrentBranch(): string {
    try {
        const { execSync } = require('child_process');
        return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } catch {
        console.error('Error: Could not determine current git branch');
        process.exit(1);
    }
}

async function getDefaultBranch(octokit: Octokit, owner: string, repo: string): Promise<string> {
    const { data } = await octokit.repos.get({ owner, repo });
    return data.default_branch;
}

// ============================================================================
// PR Actions
// ============================================================================

async function createPR(
    octokit: Octokit,
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
    draft?: boolean
): Promise<number> {
    const { data } = await octokit.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body,
        draft,
    });
    console.log(`✓ PR #${data.number} created: ${data.html_url}`);
    return data.number;
}

async function addComment(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    body: string
): Promise<void> {
    const { data } = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
    });
    console.log(`✓ Comment added: ${data.html_url}`);
}

async function updateTitle(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    title: string
): Promise<void> {
    await octokit.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        title,
    });
    console.log(`✓ PR #${prNumber} title updated to: "${title}"`);
}

async function updateBody(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    body: string
): Promise<void> {
    await octokit.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        body,
    });
    console.log(`✓ PR #${prNumber} description updated`);
}

async function addLabels(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    labels: string[]
): Promise<void> {
    await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels,
    });
    console.log(`✓ Labels added to PR #${prNumber}: ${labels.join(', ')}`);
}

async function removeLabels(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    labels: string[]
): Promise<void> {
    for (const label of labels) {
        try {
            await octokit.issues.removeLabel({
                owner,
                repo,
                issue_number: prNumber,
                name: label,
            });
            console.log(`✓ Label removed from PR #${prNumber}: ${label}`);
        } catch (error) {
            console.warn(`⚠ Could not remove label "${label}" (may not exist)`);
        }
    }
}

async function requestReviewers(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    reviewers: string[],
    teamReviewers: string[]
): Promise<void> {
    await octokit.pulls.requestReviewers({
        owner,
        repo,
        pull_number: prNumber,
        reviewers: reviewers.length > 0 ? reviewers : undefined,
        team_reviewers: teamReviewers.length > 0 ? teamReviewers : undefined,
    });
    const all = [...reviewers, ...teamReviewers.map(t => `team:${t}`)];
    console.log(`✓ Reviewers requested for PR #${prNumber}: ${all.join(', ')}`);
}

async function mergePR(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number,
    method: 'merge' | 'squash' | 'rebase',
    commitTitle?: string,
    commitMessage?: string
): Promise<void> {
    await octokit.pulls.merge({
        owner,
        repo,
        pull_number: prNumber,
        merge_method: method,
        commit_title: commitTitle,
        commit_message: commitMessage,
    });
    console.log(`✓ PR #${prNumber} merged using ${method} method`);
}

async function closePR(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number
): Promise<void> {
    await octokit.pulls.update({
        owner,
        repo,
        pull_number: prNumber,
        state: 'closed',
    });
    console.log(`✓ PR #${prNumber} closed`);
}

async function getPRInfo(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number
): Promise<void> {
    const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });

    console.log('\n📋 Pull Request Information');
    console.log('═'.repeat(50));
    console.log(`Title:    ${pr.title}`);
    console.log(`Number:   #${pr.number}`);
    console.log(`State:    ${pr.state}`);
    console.log(`Author:   ${pr.user?.login}`);
    console.log(`Branch:   ${pr.head.ref} → ${pr.base.ref}`);
    console.log(`URL:      ${pr.html_url}`);
    console.log(`Created:  ${new Date(pr.created_at).toLocaleString()}`);
    console.log(`Updated:  ${new Date(pr.updated_at).toLocaleString()}`);

    if (pr.labels.length > 0) {
        console.log(`Labels:   ${pr.labels.map(l => l.name).join(', ')}`);
    }

    if (pr.requested_reviewers && pr.requested_reviewers.length > 0) {
        console.log(`Reviewers: ${pr.requested_reviewers.map(r => r.login).join(', ')}`);
    }

    console.log(`Mergeable: ${pr.mergeable ?? 'unknown'}`);
    console.log(`Commits:  ${pr.commits}`);
    console.log(`Changed:  +${pr.additions} -${pr.deletions} in ${pr.changed_files} files`);

    if (pr.body) {
        console.log('\n📝 Description:');
        console.log('─'.repeat(50));
        console.log(pr.body);
    }
    console.log('');
}

async function listPRs(
    octokit: Octokit,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all'
): Promise<void> {
    const { data: prs } = await octokit.pulls.list({
        owner,
        repo,
        state,
        per_page: 20,
    });

    if (prs.length === 0) {
        console.log(`No ${state} pull requests found.`);
        return;
    }

    console.log(`\n📋 ${state.charAt(0).toUpperCase() + state.slice(1)} Pull Requests`);
    console.log('═'.repeat(70));

    for (const pr of prs) {
        const labels = pr.labels.map(l => l.name).join(', ');
        console.log(`#${pr.number.toString().padEnd(5)} ${pr.title.slice(0, 50).padEnd(50)} @${pr.user?.login}`);
        if (labels) {
            console.log(`       Labels: ${labels}`);
        }
    }
    console.log('');
}

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
    .name('github-pr')
    .description('CLI tool for GitHub PR actions')
    .version('1.0.0');

// Global options
program
    .option('--owner <owner>', 'Repository owner (auto-detected from git)')
    .option('--repo <repo>', 'Repository name (auto-detected from git)')
    .option('--cloud-proxy', 'Enable Claude Code cloud environment support (proxy, quote stripping)', false);

// Create command
program
    .command('create')
    .description('Create a new pull request')
    .requiredOption('--title <title>', 'PR title')
    .option('--body <body>', 'PR description')
    .option('--head <branch>', 'Branch to merge from (default: current branch)')
    .option('--base <branch>', 'Branch to merge into (default: repo default branch)')
    .option('--draft', 'Create as draft PR', false)
    .action(async (options) => {
        const globalOpts = program.opts();
        if (globalOpts.cloudProxy) setupCloudProxy();
        const config = getConfig(globalOpts.cloudProxy);
        const owner = globalOpts.owner || config.owner;
        const repo = globalOpts.repo || config.repo;
        const octokit = createOctokit(config.token);

        const head = options.head || getCurrentBranch();
        const base = options.base || await getDefaultBranch(octokit, owner, repo);

        if (head === base) {
            console.error(`Error: Head branch "${head}" is the same as base branch "${base}"`);
            process.exit(1);
        }

        await createPR(octokit, owner, repo, options.title, head, base, options.body, options.draft);
    });

// Comment command
program
    .command('comment')
    .description('Add a comment to a PR')
    .requiredOption('--pr <number>', 'PR number')
    .requiredOption('--message <text>', 'Comment message')
    .action(async (options) => {
        const globalOpts = program.opts();
        if (globalOpts.cloudProxy) setupCloudProxy();
        const config = getConfig(globalOpts.cloudProxy);
        const owner = globalOpts.owner || config.owner;
        const repo = globalOpts.repo || config.repo;
        const octokit = createOctokit(config.token);
        await addComment(octokit, owner, repo, parseInt(options.pr), options.message);
    });

// Title command
program
    .command('title')
    .description('Update PR title')
    .requiredOption('--pr <number>', 'PR number')
    .requiredOption('--text <title>', 'New title')
    .action(async (options) => {
        const globalOpts = program.opts();
        if (globalOpts.cloudProxy) setupCloudProxy();
        const config = getConfig(globalOpts.cloudProxy);
        const owner = globalOpts.owner || config.owner;
        const repo = globalOpts.repo || config.repo;
        const octokit = createOctokit(config.token);
        await updateTitle(octokit, owner, repo, parseInt(options.pr), options.text);
    });

// Body command
program
    .command('body')
    .description('Update PR description/body')
    .requiredOption('--pr <number>', 'PR number')
    .requiredOption('--text <body>', 'New description')
    .action(async (options) => {
        const globalOpts = program.opts();
        if (globalOpts.cloudProxy) setupCloudProxy();
        const config = getConfig(globalOpts.cloudProxy);
        const owner = globalOpts.owner || config.owner;
        const repo = globalOpts.repo || config.repo;
        const octokit = createOctokit(config.token);
        await updateBody(octokit, owner, repo, parseInt(options.pr), options.text);
    });

// Label command
program
    .command('label')
    .description('Add or remove labels')
    .requiredOption('--pr <number>', 'PR number')
    .option('--add <labels>', 'Labels to add (comma-separated)')
    .option('--remove <labels>', 'Labels to remove (comma-separated)')
    .action(async (options) => {
        const globalOpts = program.opts();
        if (globalOpts.cloudProxy) setupCloudProxy();
        const config = getConfig(globalOpts.cloudProxy);
        const owner = globalOpts.owner || config.owner;
        const repo = globalOpts.repo || config.repo;
        const octokit = createOctokit(config.token);

        if (options.add) {
            const labels = options.add.split(',').map((l: string) => l.trim());
            await addLabels(octokit, owner, repo, parseInt(options.pr), labels);
        }

        if (options.remove) {
            const labels = options.remove.split(',').map((l: string) => l.trim());
            await removeLabels(octokit, owner, repo, parseInt(options.pr), labels);
        }

        if (!options.add && !options.remove) {
            console.error('Error: Specify --add or --remove labels');
            process.exit(1);
        }
    });

// Reviewer command
program
    .command('reviewer')
    .description('Request reviewers for a PR')
    .requiredOption('--pr <number>', 'PR number')
    .option('--users <usernames>', 'User reviewers (comma-separated)')
    .option('--teams <teams>', 'Team reviewers (comma-separated)')
    .action(async (options) => {
        const globalOpts = program.opts();
        if (globalOpts.cloudProxy) setupCloudProxy();
        const config = getConfig(globalOpts.cloudProxy);
        const owner = globalOpts.owner || config.owner;
        const repo = globalOpts.repo || config.repo;
        const octokit = createOctokit(config.token);

        const users = options.users ? options.users.split(',').map((u: string) => u.trim()) : [];
        const teams = options.teams ? options.teams.split(',').map((t: string) => t.trim()) : [];

        if (users.length === 0 && teams.length === 0) {
            console.error('Error: Specify --users or --teams');
            process.exit(1);
        }

        await requestReviewers(octokit, owner, repo, parseInt(options.pr), users, teams);
    });

// Merge command
program
    .command('merge')
    .description('Merge a PR')
    .requiredOption('--pr <number>', 'PR number')
    .option('--method <method>', 'Merge method: merge, squash, rebase', 'squash')
    .option('--title <title>', 'Commit title (for squash/merge)')
    .option('--message <message>', 'Commit message (for squash/merge)')
    .action(async (options) => {
        const globalOpts = program.opts();
        if (globalOpts.cloudProxy) setupCloudProxy();
        const config = getConfig(globalOpts.cloudProxy);
        const owner = globalOpts.owner || config.owner;
        const repo = globalOpts.repo || config.repo;
        const octokit = createOctokit(config.token);

        const method = options.method as 'merge' | 'squash' | 'rebase';
        if (!['merge', 'squash', 'rebase'].includes(method)) {
            console.error('Error: --method must be merge, squash, or rebase');
            process.exit(1);
        }

        await mergePR(octokit, owner, repo, parseInt(options.pr), method, options.title, options.message);
    });

// Close command
program
    .command('close')
    .description('Close a PR')
    .requiredOption('--pr <number>', 'PR number')
    .action(async (options) => {
        const globalOpts = program.opts();
        if (globalOpts.cloudProxy) setupCloudProxy();
        const config = getConfig(globalOpts.cloudProxy);
        const owner = globalOpts.owner || config.owner;
        const repo = globalOpts.repo || config.repo;
        const octokit = createOctokit(config.token);
        await closePR(octokit, owner, repo, parseInt(options.pr));
    });

// Info command
program
    .command('info')
    .description('Get PR information')
    .requiredOption('--pr <number>', 'PR number')
    .action(async (options) => {
        const globalOpts = program.opts();
        if (globalOpts.cloudProxy) setupCloudProxy();
        const config = getConfig(globalOpts.cloudProxy);
        const owner = globalOpts.owner || config.owner;
        const repo = globalOpts.repo || config.repo;
        const octokit = createOctokit(config.token);
        await getPRInfo(octokit, owner, repo, parseInt(options.pr));
    });

// List command
program
    .command('list')
    .description('List pull requests')
    .option('--state <state>', 'PR state: open, closed, all', 'open')
    .action(async (options) => {
        const globalOpts = program.opts();
        if (globalOpts.cloudProxy) setupCloudProxy();
        const config = getConfig(globalOpts.cloudProxy);
        const owner = globalOpts.owner || config.owner;
        const repo = globalOpts.repo || config.repo;
        const octokit = createOctokit(config.token);

        const state = options.state as 'open' | 'closed' | 'all';
        if (!['open', 'closed', 'all'].includes(state)) {
            console.error('Error: --state must be open, closed, or all');
            process.exit(1);
        }

        await listPRs(octokit, owner, repo, state);
    });

// Parse and run
program.parseAsync(process.argv).catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
