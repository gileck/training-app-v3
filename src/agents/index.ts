#!/usr/bin/env tsx
/**
 * GitHub Workflows Agent - Master script for running all agent workflows
 *
 * IMPORTANT: By default, this script pulls the latest changes from master before running.
 * This ensures agents always run with the latest code and status configurations.
 *
 * Usage:
 *   yarn github-workflows-agent --product-dev [options]       # Run product development agent (OPTIONAL)
 *   yarn github-workflows-agent --product-design [options]    # Run product design agent
 *   yarn github-workflows-agent --tech-design [options]       # Run technical design agent
 *   yarn github-workflows-agent --implement [options]         # Run implementation agent
 *   yarn github-workflows-agent --pr-review [options]         # Run PR review agent
 *   yarn github-workflows-agent --auto-advance [options]      # Run auto-advance script
 *   yarn github-workflows-agent --all [options]               # Run all in sequence
 *
 * Options:
 *   --skip-pull       Skip pulling latest changes from master (not recommended)
 *   --reset           Reset to clean main branch (discards ALL local changes and switches to main)
 *   --dry-run         Preview without changes (passed to agents)
 *   --id <id>         Process specific item (passed to agents)
 *   --limit <n>       Limit items to process (passed to agents)
 *   --global-limit    Stop workflow after first agent processes items (only with --all)
 *   --stream          Stream Claude output (passed to agents only)
 *   --triggeredBy <s> Log what triggered this run (e.g. "task-manager", "manual")
 *   --stale-timeout <min> Minutes before a lock is considered stale (default: 20, 0 = force-clear)
 *
 * Examples:
 *   yarn github-workflows-agent --product-dev --dry-run
 *   yarn github-workflows-agent --product-design --dry-run
 *   yarn github-workflows-agent --tech-design --id PVTI_xxx
 *   yarn github-workflows-agent --all --dry-run
 *   yarn github-workflows-agent --all --global-limit          # Stop after first agent runs
 *   yarn github-workflows-agent --implement --skip-pull       # Run without pulling
 *   yarn github-workflows-agent --implement --reset           # Reset to clean main first
 */

import { spawn, execSync } from 'child_process';
import { resolve } from 'path';
import { acquireDirectoryLock, releaseDirectoryLock } from './shared/directory-lock';

const SCRIPTS = {
    'product-dev': resolve(__dirname, 'core-agents/productDevelopmentAgent/index.ts'),
    'product-design': resolve(__dirname, 'core-agents/productDesignAgent/index.ts'),
    'bug-investigator': resolve(__dirname, 'core-agents/bugInvestigatorAgent/index.ts'),
    'tech-design': resolve(__dirname, 'core-agents/technicalDesignAgent/index.ts'),
    'implement': resolve(__dirname, 'core-agents/implementAgent/index.ts'),
    'pr-review': resolve(__dirname, 'core-agents/prReviewAgent/index.ts'),
    'auto-advance': resolve(__dirname, 'auto-advance.ts'),
};

// Order for --all flag
const ALL_ORDER = ['auto-advance', 'product-dev', 'product-design', 'bug-investigator', 'tech-design', 'implement', 'pr-review'];

// ============================================================
// GIT UTILITIES
// ============================================================

/**
 * Execute a git command and return the output
 */
function git(command: string, options: { silent?: boolean } = {}): string {
    try {
        const result = execSync(`git ${command}`, {
            cwd: process.cwd(),
            encoding: 'utf-8',
            stdio: options.silent ? 'pipe' : ['pipe', 'pipe', 'pipe'],
        });
        return result.trim();
    } catch (error) {
        if (error instanceof Error && 'stderr' in error) {
            throw new Error((error as { stderr: string }).stderr || error.message);
        }
        throw error;
    }
}

/**
 * Check if there are uncommitted changes in the working directory
 */
function hasUncommittedChanges(): boolean {
    const status = git('status --porcelain', { silent: true });
    return status.length > 0;
}

/**
 * Reset to clean main branch
 * Discards ALL local changes (staged, unstaged, and untracked) and switches to main
 */
function resetToCleanMain(): void {
    console.log('\n🔄 Resetting to clean main branch...');

    try {
        // Get the default branch name
        const defaultBranch = git('symbolic-ref refs/remotes/origin/HEAD --short', { silent: true })
            .replace('origin/', '');

        // Fetch latest from remote
        console.log('  Fetching from remote...');
        git('fetch origin', { silent: true });

        // Reset to main branch, discarding all local changes
        console.log(`  Checking out ${defaultBranch}...`);
        git(`checkout ${defaultBranch}`, { silent: true });

        // Hard reset to origin/main (discards all committed changes not on remote)
        console.log(`  Hard reset to origin/${defaultBranch}...`);
        git(`reset --hard origin/${defaultBranch}`, { silent: true });

        // Clean untracked files and directories
        console.log('  Cleaning untracked files...');
        git('clean -fd', { silent: true });

        console.log(`✅ Reset to clean ${defaultBranch}\n`);
    } catch (error) {
        console.error('❌ Error: Failed to reset to clean main.');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

/**
 * Pull latest changes from the default branch
 */
function pullLatestChanges(): void {
    console.log('\n🔄 Pulling latest changes from master...');

    // Check for uncommitted changes first
    if (hasUncommittedChanges()) {
        const status = git('status --porcelain', { silent: true });
        console.error('❌ Error: Uncommitted changes in working directory.');
        console.error('Please commit or stash your changes before running agents.');
        console.error('Or use --skip-pull to run with current code (not recommended).');
        console.error('Or use --reset to discard all changes and reset to main.\n');
        console.error('Uncommitted files:\n' + status);
        process.exit(1);
    }

    try {
        // Get the default branch name
        const defaultBranch = git('symbolic-ref refs/remotes/origin/HEAD --short', { silent: true })
            .replace('origin/', '');

        // Checkout default branch
        git(`checkout ${defaultBranch}`, { silent: true });

        // Pull latest changes
        git(`pull origin ${defaultBranch}`, { silent: true });

        console.log(`✅ On latest ${defaultBranch}\n`);
    } catch (error) {
        console.error('❌ Error: Failed to pull latest changes.');
        console.error(error instanceof Error ? error.message : String(error));
        console.error('Use --skip-pull to bypass this check (not recommended).\n');
        process.exit(1);
    }
}

function printUsage() {
    console.log(`
GitHub Workflows Agent - Master script for running all agent workflows

Usage:
  yarn github-workflows-agent --product-dev [options]       Run product development agent (OPTIONAL)
  yarn github-workflows-agent --product-design [options]    Run product design agent
  yarn github-workflows-agent --bug-investigator [options]  Run bug investigator agent
  yarn github-workflows-agent --tech-design [options]       Run technical design agent
  yarn github-workflows-agent --implement [options]         Run implementation agent
  yarn github-workflows-agent --pr-review [options]         Run PR review agent
  yarn github-workflows-agent --auto-advance [options]      Run auto-advance script
  yarn github-workflows-agent --all [options]               Run all in sequence

Options:
  --skip-pull       Skip pulling latest changes from master (not recommended)
  --reset           Reset to clean main branch (discards ALL local changes and switches to main)
  --dry-run         Preview without changes (passed to agents)
  --id <id>         Process specific item (passed to agents)
  --limit <n>       Limit items to process (passed to agents)
  --global-limit    Stop workflow after first agent processes items (only with --all)
  --stream          Stream Claude output (passed to agents only)
  --triggeredBy <s> Log what triggered this run (e.g. "task-manager", "manual")
  --stale-timeout <min> Minutes before lock is stale (default: 20, 0 = force-clear)

Examples:
  yarn github-workflows-agent --product-dev --dry-run
  yarn github-workflows-agent --product-design --dry-run
  yarn github-workflows-agent --bug-investigator --dry-run
  yarn github-workflows-agent --tech-design --id PVTI_xxx
  yarn github-workflows-agent --all --dry-run
  yarn github-workflows-agent --all --global-limit          # Stop after first agent runs
  yarn github-workflows-agent --implement --skip-pull       # Run without pulling
  yarn github-workflows-agent --implement --reset           # Reset to clean main first
`);
}

function runScript(scriptPath: string, args: string[]): Promise<{ exitCode: number; processedItems: boolean }> {
    return new Promise((resolve) => {
        let output = '';

        const child = spawn('tsx', [scriptPath, ...args], {
            stdio: 'pipe',
            env: process.env,
        });

        // Capture and forward stdout
        child.stdout?.on('data', (data) => {
            const text = data.toString();
            process.stdout.write(text);
            output += text;
        });

        // Capture and forward stderr
        child.stderr?.on('data', (data) => {
            const text = data.toString();
            process.stderr.write(text);
            output += text;
        });

        child.on('close', (code) => {
            // Check if agent processed any items
            // Look for "Processing N item(s)" pattern in output
            const processedItems = /Processing \d+ item\(s\)/.test(output);
            resolve({ exitCode: code ?? 0, processedItems });
        });

        child.on('error', (err) => {
            console.error(`Failed to run script: ${err.message}`);
            resolve({ exitCode: 1, processedItems: false });
        });
    });
}

async function main() {
    const startTime = new Date();
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        printUsage();
        process.exit(0);
    }

    // Parse --triggeredBy
    const triggeredByIndex = args.indexOf('--triggeredBy');
    const triggeredBy = triggeredByIndex !== -1 && triggeredByIndex + 1 < args.length
        ? args[triggeredByIndex + 1]
        : null;

    // Parse --stale-timeout (default: 20 minutes)
    const staleTimeoutIndex = args.indexOf('--stale-timeout');
    const staleTimeoutMinutes = staleTimeoutIndex !== -1 && staleTimeoutIndex + 1 < args.length
        ? parseInt(args[staleTimeoutIndex + 1], 10)
        : 20;

    // Log start info
    console.log(`\n⏱️  Start time: ${startTime.toISOString()}`);
    if (triggeredBy) {
        console.log(`🔗 Triggered by: ${triggeredBy}`);
    } else {
        console.log('🔗 Triggered by: not set');
    }

    // Log working directory
    const workingDir = process.cwd();
    console.log(`📁 Working directory: ${workingDir}`);

    // Find which script(s) to run
    const scriptsToRun: string[] = [];
    const passThrough: string[] = [];
    let skipPull = false;
    let resetToMain = false;
    let globalLimit = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--triggeredBy') {
            i++; // skip the value (already parsed above)
            continue;
        }

        if (arg === '--stale-timeout') {
            i++; // skip the value (already parsed above)
            continue;
        }

        if (arg === '--all') {
            scriptsToRun.push(...ALL_ORDER);
        } else if (arg === '--product-dev') {
            scriptsToRun.push('product-dev');
        } else if (arg === '--product-design') {
            scriptsToRun.push('product-design');
        } else if (arg === '--bug-investigator') {
            scriptsToRun.push('bug-investigator');
        } else if (arg === '--tech-design') {
            scriptsToRun.push('tech-design');
        } else if (arg === '--implement') {
            scriptsToRun.push('implement');
        } else if (arg === '--pr-review') {
            scriptsToRun.push('pr-review');
        } else if (arg === '--auto-advance') {
            scriptsToRun.push('auto-advance');
        } else if (arg === '--skip-pull') {
            skipPull = true;
        } else if (arg === '--reset') {
            resetToMain = true;
        } else if (arg === '--global-limit') {
            globalLimit = true;
        } else {
            // Pass through to scripts (but not --skip-pull, --reset, or --global-limit)
            passThrough.push(arg);
        }
    }

    if (scriptsToRun.length === 0) {
        console.error('Error: No agent specified. Use --product-dev, --product-design, --bug-investigator, --tech-design, --implement, --pr-review, --auto-advance, or --all\n');
        printUsage();
        process.exit(1);
    }

    // Remove duplicates while preserving order
    const uniqueScripts = [...new Set(scriptsToRun)];

    // Acquire directory lock to prevent concurrent runs
    const locked = acquireDirectoryLock({ staleTimeoutMinutes, agents: uniqueScripts });
    if (!locked) {
        console.error('\n❌ Cannot proceed — another instance is running on this directory.');
        process.exit(1);
    }

    try {

    // Reset to clean main if requested (discards ALL local changes)
    if (resetToMain) {
        resetToCleanMain();
        // After reset, we're already on latest main, no need to pull
        skipPull = true;
    }

    // Pull latest changes from master (unless --skip-pull is specified)
    if (!skipPull) {
        pullLatestChanges();
    } else if (!resetToMain) {
        // Only show skip warning if we didn't just reset
        console.log('\n⚠️  Skipping git pull (--skip-pull specified)');
        console.log('   Running with current code - may be outdated!\n');
    }

    // Global limit: stop after first agent processes items
    if (globalLimit) {
        console.log('🎯 Global limit enabled - will stop after first agent processes items\n');
    }

    // Options that only apply to Claude-based agents (not auto-advance)
    const claudeOnlyOptions = ['--stream', '--verbose'];

    // Run scripts in sequence
    for (const scriptName of uniqueScripts) {
        const scriptPath = SCRIPTS[scriptName as keyof typeof SCRIPTS];

        if (!scriptPath) {
            console.error(`Unknown script: ${scriptName}`);
            continue;
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Running: ${scriptName}`);
        console.log('='.repeat(60));

        // Filter out Claude-only options for auto-advance
        let scriptArgs = scriptName === 'auto-advance'
            ? passThrough.filter(arg => !claudeOnlyOptions.includes(arg))
            : passThrough;

        // If we already pulled in index.ts, tell implement agent to skip its pull
        // (other scripts don't have git pull logic, so they don't need this flag)
        if (!skipPull && scriptName === 'implement') {
            scriptArgs = ['--skip-pull', ...scriptArgs];
        }

        const { exitCode, processedItems } = await runScript(scriptPath, scriptArgs);

        if (exitCode !== 0 && !passThrough.includes('--dry-run')) {
            console.error(`\nScript ${scriptName} failed with exit code ${exitCode}`);
            // Continue with other scripts even if one fails
        }

        // Global limit: stop if this agent processed items
        if (globalLimit && processedItems) {
            console.log(`\n🛑 Global limit reached - ${scriptName} processed items, stopping workflow`);
            console.log('   Remaining agents will run in next execution\n');
            break;
        }
    }

    // Safety net: detect and clean up any dirty state left by agents
    if (hasUncommittedChanges()) {
        const status = git('status --porcelain', { silent: true });
        console.error('\n⚠️  Working directory left dirty after agent run:');
        console.error(status);
        console.log('🧹 Cleaning up (resetting to clean main)...');
        resetToCleanMain();
    }

    // Sync agent logs to dev repo (fail silently if not successful)
    console.log(`\n${'='.repeat(60)}`);
    console.log('Syncing agent logs to dev repo...');
    console.log('='.repeat(60));
    try {
        const syncScript = resolve(__dirname, '../../scripts/template/sync-agent-logs.sh');
        execSync(`bash "${syncScript}"`, {
            cwd: process.cwd(),
            encoding: 'utf-8',
            stdio: 'inherit',
        });

        // Get repo name from current working directory
        const repoName = process.cwd().split('/').pop();
        const devRepoPath = `~/Projects/${repoName}/agent-logs`;
        console.log(`✅ Agent logs synced successfully to ${devRepoPath}`);
    } catch {
        console.warn('⚠️  Failed to sync agent logs (non-fatal)');
        // Don't fail the whole process - this is just a convenience feature
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMin = Math.floor(durationMs / 60000);
    const durationSec = Math.floor((durationMs % 60000) / 1000);
    console.log(`\n⏱️  End time: ${endTime.toISOString()}`);
    console.log(`⏱️  Total duration: ${durationMin}m ${durationSec}s`);
    console.log('\nDone!');

    } finally {
        releaseDirectoryLock();
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
