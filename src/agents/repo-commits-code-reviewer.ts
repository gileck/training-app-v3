#!/usr/bin/env tsx
/**
 * Repo Commits Code Reviewer Agent
 *
 * Standalone agent that reviews current source code guided by recent commits.
 * Each run walks commits chronologically from the last-reviewed SHA, accumulating
 * diff lines until hitting a budget (~1500 lines). Commit metadata (title, files
 * changed, diffstat) is used as a pointer to what changed — the actual review is
 * done against the current source code.
 *
 * Runs every few hours. Busy days with many commits simply take more runs to
 * catch up — each run is bounded and high-quality.
 *
 * NOT part of the GitHub Projects workflow pipeline (not in ALL_ORDER).
 *
 * Usage:
 *   yarn github-workflows-agent --repo-commits-code-reviewer [options]
 *
 * Options:
 *   --dry-run              Preview findings without creating issues
 *   --stream               Stream Claude output
 *   --max-diff-lines <n>   Diff-line budget per run (default: 1500)
 *   --days <n>             Seed lookback for first run only (default: 3)
 */

import './shared/loadEnv';
import { runAgentMain } from './shared/main-factory';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { runAgent } from './lib';
import { git as sharedGit, CODE_REVIEW_OUTPUT_FORMAT } from './shared';
import type { CodeReviewOutput, CodeReviewFinding } from './shared';

// ============================================================
// CONFIGURATION
// ============================================================

const STATE_DIR = resolve(__dirname, '../../agent-tasks/repo-commits-code-reviewer');
const STATE_FILE = resolve(STATE_DIR, 'state.json');
const DEFAULT_DIFF_BUDGET = 1500;
const SKIP_PATTERNS = [
    /^docs\//,
    /^agent-logs\//,
    /^agent-tasks\//,
    /^\.ai\//,
    /^task-manager\//,
];

/** Commit messages matching these patterns are skipped entirely */
const SKIP_COMMIT_MESSAGES = [
    /sync.?template/i,
    /template.?sync/i,
];

interface State {
    lastCommitSha: string;
    lastRunAt: string;
}

// ============================================================
// CLI PARSING
// ============================================================

function parseCLIOptions() {
    const args = process.argv.slice(2);
    let dryRun = false;
    let stream = false;
    let maxDiffLines = DEFAULT_DIFF_BUDGET;
    let days = 3;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--dry-run') {
            dryRun = true;
        } else if (arg === '--stream') {
            stream = true;
        } else if (arg === '--max-diff-lines' && args[i + 1]) {
            maxDiffLines = parseInt(args[i + 1], 10);
            i++;
        } else if (arg === '--days' && args[i + 1]) {
            days = parseInt(args[i + 1], 10);
            i++;
        }
    }

    return { dryRun, stream, maxDiffLines, days };
}

// ============================================================
// GIT UTILITIES
// ============================================================

function git(command: string): string {
    return sharedGit(command, { silent: true });
}

/**
 * Get all commits since a given SHA, oldest first (chronological order).
 */
function getCommitsSince(sha: string): Array<{ hash: string; subject: string; author: string }> {
    const log = git(`log ${sha}..HEAD --format=%H%x09%s%x09%an --no-merges --reverse`);
    if (!log) return [];

    return log.split('\n').filter(Boolean).map(line => {
        const [hash, subject, author] = line.split('\t');
        return { hash, subject, author };
    });
}

/**
 * Get all commits from the last N days, oldest first (chronological order).
 * Used only on first run to seed state.
 */
function getCommitsSinceDays(days: number): Array<{ hash: string; subject: string; author: string }> {
    const log = git(`log --since="${days} days ago" --format=%H%x09%s%x09%an --no-merges --reverse`);
    if (!log) return [];

    return log.split('\n').filter(Boolean).map(line => {
        const [hash, subject, author] = line.split('\t');
        return { hash, subject, author };
    });
}

function getCommitDiffLineCount(hash: string): number {
    try {
        const stat = git(`diff-tree --no-commit-id --shortstat ${hash}`);
        // Format: " 3 files changed, 45 insertions(+), 12 deletions(-)"
        const insertions = stat.match(/(\d+) insertion/);
        const deletions = stat.match(/(\d+) deletion/);
        return (insertions ? parseInt(insertions[1], 10) : 0) + (deletions ? parseInt(deletions[1], 10) : 0);
    } catch {
        return 0;
    }
}

function getCommitStat(hash: string): string {
    return git(`show ${hash} --stat --no-patch --no-color`);
}

function getCommitFiles(hash: string): string[] {
    const files = git(`diff-tree --no-commit-id --name-only -r ${hash}`);
    return files.split('\n').filter(Boolean);
}

function isRelevantCommit(hash: string, subject: string): boolean {
    // Skip commits with messages matching skip patterns (e.g., template sync)
    if (SKIP_COMMIT_MESSAGES.some(pattern => pattern.test(subject))) {
        return false;
    }

    const files = getCommitFiles(hash);
    // A commit is relevant if at least one file does NOT match skip patterns
    return files.some(file => !SKIP_PATTERNS.some(pattern => pattern.test(file)));
}

// ============================================================
// DIFF BUDGET
// ============================================================

interface BudgetResult {
    /** Commits selected for this review batch */
    selected: Array<{ hash: string; subject: string; author: string; diffLines: number }>;
    /** Total diff lines in this batch */
    totalDiffLines: number;
    /** Whether there are remaining commits not yet reviewed */
    hasMore: boolean;
    /** Total number of pending commits (selected + remaining) */
    totalPending: number;
}

/**
 * Walk commits chronologically, accumulating diff lines until budget is reached.
 * Always includes at least one commit (even if it exceeds the budget by itself).
 */
function selectCommitsWithinBudget(
    commits: Array<{ hash: string; subject: string; author: string }>,
    budget: number,
): BudgetResult {
    const selected: BudgetResult['selected'] = [];
    let totalDiffLines = 0;

    for (const commit of commits) {
        const diffLines = getCommitDiffLineCount(commit.hash);

        // Always include at least one commit so we make progress
        if (selected.length > 0 && totalDiffLines + diffLines > budget) {
            break;
        }

        selected.push({ ...commit, diffLines });
        totalDiffLines += diffLines;
    }

    return {
        selected,
        totalDiffLines,
        hasMore: selected.length < commits.length,
        totalPending: commits.length,
    };
}

// ============================================================
// STATE MANAGEMENT
// ============================================================

function loadState(): State | null {
    if (!existsSync(STATE_FILE)) return null;
    try {
        return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    } catch {
        return null;
    }
}

function saveState(state: State): void {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

// ============================================================
// PROMPT BUILDING
// ============================================================

function buildReviewPrompt(commits: Array<{ hash: string; subject: string; author: string; stat: string }>): string {
    const commitSections = commits.map(c =>
        `### Commit: ${c.hash.slice(0, 8)} — ${c.subject} (${c.author})\nFiles changed:\n${c.stat}`
    ).join('\n\n');

    return `You are a senior code reviewer analyzing recent changes to a Next.js TypeScript application.

## Your Task
The commits below tell you WHAT changed recently and WHERE. Your job is to review the CURRENT source code of the affected files for bugs, issues, and improvements.

## CRITICAL: Review Current Source Code, Not Commit Diffs

Your findings must reflect the **current state of the code**, not the state at the time of any specific commit. If an issue you notice in the commit history has already been fixed in a later commit, DO NOT report it. The commits are pointers to areas of recent change — the actual review target is the current source code.

You have read-only tools (Read, Glob, Grep) available. **You MUST use them before making any judgments.**

### Step 1: Read Project Guidelines
Start by reading the project's guidelines and architecture docs:
- Read \`CLAUDE.md\` in the project root — this is the source of truth for all coding standards, patterns, and architectural decisions.
- Based on the files changed in the commits, read the relevant docs from \`docs/\` and project guidelines from \`docs/template/project-guidelines/\` that apply (e.g., if the commit touches React components, read the React component organization rules; if it touches API code, read the client-server communication docs).

### Step 2: Read the Full Current Source Files
For each file mentioned in the commits, **read the full current file**. You need the complete current source to understand:
- Whether the code is consistent with existing patterns in that file
- Whether error handling exists elsewhere that covers the code
- Whether there are logic errors or conflicts with nearby code

### Step 3: Read Related Code
Use Grep and Glob to explore code related to the changes:
- If a function signature changed, find all callers
- If a type was modified, find all usages
- If a hook or store was changed, find all consumers

### Step 4: Form Findings Based on Current Source
Only after reading the current source files should you form your findings. Each finding must be verifiable against the current code — not against an outdated diff.

## What to Look For
- **Bugs**: Missing error handling, null/undefined access, race conditions, logic errors, off-by-one errors
- **Security Issues**: Injection vulnerabilities, exposed secrets, insecure patterns
- **Performance**: Unnecessary re-renders, missing memoization on hot paths, N+1 queries
- **Architectural Violations**: Patterns that contradict the project guidelines in CLAUDE.md and docs/
- **Missing Edge Cases**: Unhandled empty states, missing loading states, missing offline handling

## What to Ignore
- Formatting and naming preferences
- Trivial optimizations that don't matter in practice
- Subjective style choices
- Files in docs/, agent-logs/, .ai/ directories (already filtered)
- Issues that are consistent with the project's established patterns (even if you'd do it differently)

## Guidelines
- Be conservative — better to miss a minor issue than create noise
- Consolidate related findings (don't create 3 issues for the same underlying problem)
- Focus on things that could cause real problems in production
- If the project docs explicitly endorse a pattern or document it as an acceptable exception, it is NOT an issue — do not include it in findings at all. Every finding you report must be something genuinely wrong, not something that looks unusual but is documented as acceptable.

## Title and Description Format

**Title format:** Use a prefix indicating the feature/area affected, similar to commit message conventions:
- \`bug(feature-name): short description\` for bugs
- \`improvement(feature-name): short description\` for improvements

Examples:
- \`bug(telegram-agent): session not persisted after restart\`
- \`bug(auth): missing null check in JWT validation\`
- \`improvement(settings): add validation for theme preference\`

**Description format:** Start with context explaining WHERE the issue is, then WHAT it does wrong:
\`\`\`
In the [FEATURE NAME], there is a [bug/issue] in [FILE NAME] that [DOES SOMETHING WRONG].

[Additional details about the problem and suggested fix]
\`\`\`

Examples:
- "In the telegram-agent feature, there is a bug in telegram-claude-code/sessions.ts that fails to persist sessions when the bot restarts because the file write happens after the process exits."
- "In the auth feature, there is a missing null check in src/server/auth/jwt.ts that causes a crash when the token payload is malformed."

This context helps readers quickly understand which part of the codebase is affected without reading the full description.

## Recent Commits (use as pointers to what changed)

${commitSections}

## Output
Return your findings as structured JSON matching the output schema.
IMPORTANT: Every finding you mention in your reasoning MUST appear in the findings array. Do not describe issues in text without including them in the structured output.`;
}

// ============================================================
// ISSUE CREATION
// ============================================================

function createIssue(finding: CodeReviewFinding, dryRun: boolean): void {
    const type = finding.type === 'bug' ? 'bug' : 'feature';
    const description = formatIssueDescription(finding);

    if (dryRun) {
        console.log(`\n  [DRY RUN] Would create ${type}: ${finding.title}`);
        console.log(`    Priority: ${finding.priority} | Size: ${finding.size} | Complexity: ${finding.complexity}`);
        console.log(`    Files: ${finding.affectedFiles.join(', ')}`);
        return;
    }

    try {
        const args = [
            'agent-workflow', 'create',
            '--type', type,
            '--title', finding.title,
            '--priority', finding.priority,
            '--description', description,
        ];

        if (finding.size) args.push('--size', finding.size);
        if (finding.complexity) args.push('--complexity', finding.complexity);
        args.push('--created-by', 'repo-commits-code-reviewer');

        // Add client page route if the finding is route-specific
        if (finding.route) {
            args.push('--client-page-route', finding.route);
        }

        const result = spawnSync('yarn', args, { cwd: process.cwd(), encoding: 'utf-8', stdio: 'pipe' });

        if (result.status !== 0) {
            throw new Error(result.stderr || result.stdout || `Exit code ${result.status}`);
        }
        console.log(`  Created ${type}: ${finding.title}`);
    } catch (error) {
        console.error(`  Failed to create issue: ${finding.title}`);
        console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function formatIssueDescription(finding: CodeReviewFinding): string {
    const filesSection = finding.affectedFiles
        .map(f => `- \`${f}\``)
        .join('\n');

    return `**Priority:** ${capitalize(finding.priority)} | **Size:** ${finding.size} | **Complexity:** ${finding.complexity} | **Risk:** ${finding.riskLevel}

> ${finding.riskDescription}

## Description
${finding.description}

## Affected Files
${filesSection}

**Related Commit:** ${finding.relatedCommit.slice(0, 8)}

---
_Detected by repo-commits-code-reviewer agent_`;
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    const options = parseCLIOptions();

    console.log('\n🔍 Repo Commits Code Reviewer');
    console.log('='.repeat(50));
    console.log(`  Diff-line budget: ${options.maxDiffLines}`);

    // Load state
    const state = loadState();

    // Get all pending commits (oldest first)
    let allCommits: Array<{ hash: string; subject: string; author: string }>;

    if (state) {
        console.log(`  Last reviewed commit: ${state.lastCommitSha.slice(0, 8)}`);
        console.log(`  Last run: ${state.lastRunAt}`);
        allCommits = getCommitsSince(state.lastCommitSha);
    } else {
        console.log(`  First run — seeding from last ${options.days} day(s)`);
        allCommits = getCommitsSinceDays(options.days);
    }

    // Filter irrelevant commits (by files and commit message)
    const relevantCommits = allCommits.filter(c => isRelevantCommit(c.hash, c.subject));

    console.log(`  Total new commits: ${allCommits.length}`);
    console.log(`  Relevant commits: ${relevantCommits.length}`);

    if (relevantCommits.length === 0) {
        console.log('\n  No commits to review. Exiting.');

        // Still update state to current HEAD if not dry-run
        if (!options.dryRun) {
            saveState({ lastCommitSha: allCommits.length > 0 ? allCommits[allCommits.length - 1].hash : (state?.lastCommitSha ?? git('rev-parse HEAD')), lastRunAt: new Date().toISOString() });
        }
        process.exit(0);
    }

    // Select commits within diff budget
    const budget = selectCommitsWithinBudget(relevantCommits, options.maxDiffLines);

    console.log(`\n  Selected ${budget.selected.length}/${budget.totalPending} commits (${budget.totalDiffLines} diff lines)`);
    if (budget.hasMore) {
        console.log(`  ⏳ ${budget.totalPending - budget.selected.length} commits remaining for next run(s)`);
    }

    for (const c of budget.selected) {
        console.log(`    ${c.hash.slice(0, 8)} (${c.diffLines} lines) ${c.subject}`);
    }

    // Collect commit stats for selected commits
    console.log('\n  Collecting commit stats...');
    const commitsWithStats = budget.selected.map(c => ({
        ...c,
        stat: getCommitStat(c.hash),
    }));

    // Build prompt and run agent
    const prompt = buildReviewPrompt(commitsWithStats);

    console.log('\n  Running code review agent...\n');

    const result = await runAgent({
        prompt,
        stream: options.stream,
        timeout: 300,
        progressLabel: 'Reviewing commits',
        workflow: 'code-review',
        outputFormat: CODE_REVIEW_OUTPUT_FORMAT,
    });

    if (!result.success || !result.structuredOutput) {
        console.error('\n  Agent failed:', result.error || 'No structured output');
        process.exit(1);
    }

    const output = result.structuredOutput as CodeReviewOutput;

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Review Summary');
    console.log(`  Commits reviewed: ${output.summary.commitsReviewed}`);
    console.log(`  Total findings: ${output.findings.length}`);

    // Log all findings
    if (output.findings.length > 0) {
        console.log('\n  All findings:');
        for (const f of output.findings) {
            console.log(`    [${f.severity}] [${f.type}] [${f.size}] [Risk: ${f.riskLevel}] ${f.title}`);
        }
    }

    // Create issues for all findings — admin decides go/no-go via Telegram
    if (output.findings.length > 0) {
        console.log(`\n  📝 Creating ${output.findings.length} issue(s)...`);
        for (const finding of output.findings) {
            createIssue(finding, options.dryRun);
        }
    } else {
        console.log('\n  No issues to create.');
    }

    // Update state: advance to the last reviewed commit (not HEAD)
    // This way, commits after the selected batch will be picked up next run
    if (!options.dryRun) {
        const lastReviewedSha = budget.selected[budget.selected.length - 1].hash;
        saveState({ lastCommitSha: lastReviewedSha, lastRunAt: new Date().toISOString() });
        console.log(`\n  State updated to: ${lastReviewedSha.slice(0, 8)}`);
        if (budget.hasMore) {
            console.log(`  Next run will pick up remaining ${budget.totalPending - budget.selected.length} commits`);
        }
    }

    console.log('\nDone!');
}

runAgentMain(main);
