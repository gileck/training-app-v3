#!/usr/bin/env tsx
/**
 * GitHub CLI Helper Script
 *
 * Uses @octokit/rest to interact with GitHub API.
 * Requires GITHUB_TOKEN environment variable for authentication.
 *
 * Usage:
 *   yarn github pr:list [owner] [repo]
 *   yarn github pr:get [owner] [repo] [number]
 *   yarn github pr:create [owner] [repo] [title] [head] [base] [body]
 *   yarn github pr:update [owner] [repo] [number] [title] [body]
 *   yarn github issue:list [owner] [repo]
 *   yarn github issue:get [owner] [repo] [number]
 */

import { Octokit } from '@octokit/rest';

// Get token from environment
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

function requireToken(): void {
    if (!token) {
        console.error('Error: GITHUB_TOKEN or GH_TOKEN environment variable is required');
        console.error('');
        console.error('To use this script, set one of these environment variables:');
        console.error('  export GITHUB_TOKEN=your_personal_access_token');
        console.error('  export GH_TOKEN=your_personal_access_token');
        console.error('');
        console.error('You can create a token at: https://github.com/settings/tokens/new?scopes=repo');
        process.exit(1);
    }
}

// Lazy initialization of octokit
let _octokit: Octokit | null = null;
function getOctokit(): Octokit {
    requireToken();
    if (!_octokit) {
        _octokit = new Octokit({ auth: token });
    }
    return _octokit;
}

// Parse command line arguments
const [command, ...args] = process.argv.slice(2);

// Helper to extract owner/repo from git remote if not provided
async function getRepoInfo(): Promise<{ owner: string; repo: string }> {
    const { execSync } = await import('child_process');
    try {
        const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
        // Parse git@github.com:owner/repo.git or https://github.com/owner/repo.git
        const match = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
        if (match) {
            return { owner: match[1], repo: match[2] };
        }
    } catch {
        // Ignore errors
    }
    throw new Error('Could not determine repository. Please provide owner and repo arguments.');
}

// Commands
const commands: Record<string, () => Promise<void>> = {
    'pr:list': async () => {
        const owner = args[0];
        const repo = args[1];
        const { owner: o, repo: r } = owner && repo ? { owner, repo } : await getRepoInfo();

        const { data: pulls } = await getOctokit().rest.pulls.list({
            owner: o,
            repo: r,
            state: 'open',
        });

        if (pulls.length === 0) {
            console.log('No open pull requests found.');
            return;
        }

        console.log(`Open Pull Requests (${pulls.length}):\n`);
        for (const pr of pulls) {
            console.log(`#${pr.number} - ${pr.title}`);
            console.log(`  Author: ${pr.user?.login}`);
            console.log(`  Branch: ${pr.head.ref} -> ${pr.base.ref}`);
            console.log(`  URL: ${pr.html_url}`);
            console.log('');
        }
    },

    'pr:get': async () => {
        const [owner, repo, number] = args;
        if (!number) {
            console.error('Usage: yarn github pr:get [owner] [repo] <number>');
            process.exit(1);
        }
        const { owner: o, repo: r } = owner && repo ? { owner, repo } : await getRepoInfo();

        const { data: pr } = await getOctokit().rest.pulls.get({
            owner: o,
            repo: r,
            pull_number: parseInt(number),
        });

        console.log(`PR #${pr.number}: ${pr.title}`);
        console.log(`State: ${pr.state}`);
        console.log(`Author: ${pr.user?.login}`);
        console.log(`Branch: ${pr.head.ref} -> ${pr.base.ref}`);
        console.log(`URL: ${pr.html_url}`);
        console.log(`\nDescription:\n${pr.body || '(no description)'}`);
    },

    'pr:create': async () => {
        const [owner, repo, title, head, base, ...bodyParts] = args;
        if (!title || !head || !base) {
            console.error('Usage: yarn github pr:create [owner] [repo] <title> <head> <base> [body]');
            process.exit(1);
        }
        const { owner: o, repo: r } = owner && repo ? { owner, repo } : await getRepoInfo();
        const body = bodyParts.join(' ');

        const { data: pr } = await getOctokit().rest.pulls.create({
            owner: o,
            repo: r,
            title,
            head,
            base,
            body: body || undefined,
        });

        console.log(`Created PR #${pr.number}: ${pr.title}`);
        console.log(`URL: ${pr.html_url}`);
    },

    'pr:update': async () => {
        const [owner, repo, number, title, ...bodyParts] = args;
        if (!number) {
            console.error('Usage: yarn github pr:update [owner] [repo] <number> [title] [body]');
            process.exit(1);
        }
        const { owner: o, repo: r } = owner && repo ? { owner, repo } : await getRepoInfo();
        const body = bodyParts.join(' ');

        const updateData: { owner: string; repo: string; pull_number: number; title?: string; body?: string } = {
            owner: o,
            repo: r,
            pull_number: parseInt(number),
        };

        if (title) updateData.title = title;
        if (body) updateData.body = body;

        const { data: pr } = await getOctokit().rest.pulls.update(updateData);

        console.log(`Updated PR #${pr.number}: ${pr.title}`);
        console.log(`URL: ${pr.html_url}`);
    },

    'issue:list': async () => {
        const owner = args[0];
        const repo = args[1];
        const { owner: o, repo: r } = owner && repo ? { owner, repo } : await getRepoInfo();

        const { data: issues } = await getOctokit().rest.issues.listForRepo({
            owner: o,
            repo: r,
            state: 'open',
        });

        // Filter out pull requests (they show up in issues API too)
        const realIssues = issues.filter(issue => !issue.pull_request);

        if (realIssues.length === 0) {
            console.log('No open issues found.');
            return;
        }

        console.log(`Open Issues (${realIssues.length}):\n`);
        for (const issue of realIssues) {
            console.log(`#${issue.number} - ${issue.title}`);
            console.log(`  Author: ${issue.user?.login}`);
            console.log(`  Labels: ${issue.labels.map(l => typeof l === 'string' ? l : l.name).join(', ') || '(none)'}`);
            console.log(`  URL: ${issue.html_url}`);
            console.log('');
        }
    },

    'issue:get': async () => {
        const [owner, repo, number] = args;
        if (!number) {
            console.error('Usage: yarn github issue:get [owner] [repo] <number>');
            process.exit(1);
        }
        const { owner: o, repo: r } = owner && repo ? { owner, repo } : await getRepoInfo();

        const { data: issue } = await getOctokit().rest.issues.get({
            owner: o,
            repo: r,
            issue_number: parseInt(number),
        });

        console.log(`Issue #${issue.number}: ${issue.title}`);
        console.log(`State: ${issue.state}`);
        console.log(`Author: ${issue.user?.login}`);
        console.log(`Labels: ${issue.labels.map(l => typeof l === 'string' ? l : l.name).join(', ') || '(none)'}`);
        console.log(`URL: ${issue.html_url}`);
        console.log(`\nDescription:\n${issue.body || '(no description)'}`);
    },

    'help': async () => {
        console.log('GitHub CLI Helper - Uses @octokit/rest with GITHUB_TOKEN');
        console.log('');
        console.log('Usage: yarn github <command> [args]');
        console.log('');
        console.log('Commands:');
        console.log('  pr:list [owner] [repo]                    List open pull requests');
        console.log('  pr:get [owner] [repo] <number>            Get pull request details');
        console.log('  pr:create [owner] [repo] <title> <head> <base> [body]');
        console.log('                                            Create a pull request');
        console.log('  pr:update [owner] [repo] <number> [title] [body]');
        console.log('                                            Update a pull request');
        console.log('  issue:list [owner] [repo]                 List open issues');
        console.log('  issue:get [owner] [repo] <number>         Get issue details');
        console.log('  help                                      Show this help');
        console.log('');
        console.log('Note: owner/repo are optional if running from a git repository');
        console.log('');
        console.log('Environment:');
        console.log('  GITHUB_TOKEN or GH_TOKEN must be set for authentication');
    },
};

// Run command
async function main() {
    if (!command || command === 'help' || command === '--help' || command === '-h') {
        await commands.help();
        return;
    }

    const handler = commands[command];
    if (!handler) {
        console.error(`Unknown command: ${command}`);
        console.error('Run "yarn github help" for usage information.');
        process.exit(1);
    }

    try {
        await handler();
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`);
        } else {
            console.error('An unknown error occurred');
        }
        process.exit(1);
    }
}

main();
