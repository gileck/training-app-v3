#!/usr/bin/env tsx
/**
 * GitHub Workflows Agent - Master script for running all agent workflows
 *
 * IMPORTANT: By default, this script pulls the latest changes from master before running.
 * This ensures agents always run with the latest code and status configurations.
 *
 * Usage:
 *   yarn github-workflows-agent --product-design [options]    # Run product design agent
 *   yarn github-workflows-agent --tech-design [options]       # Run technical design agent
 *   yarn github-workflows-agent --implement [options]         # Run implementation agent
 *   yarn github-workflows-agent --pr-review [options]         # Run PR review agent
 *   yarn github-workflows-agent --auto-advance [options]      # Run auto-advance script
 *   yarn github-workflows-agent --all [options]               # Run all in sequence
 *
 * Options:
 *   --skip-pull     Skip pulling latest changes from master (not recommended)
 *   --dry-run       Preview without changes (passed to agents)
 *   --id <id>       Process specific item (passed to agents)
 *   --limit <n>     Limit items to process (passed to agents)
 *   --stream        Stream Claude output (passed to agents only)
 *
 * Examples:
 *   yarn github-workflows-agent --product-design --dry-run
 *   yarn github-workflows-agent --tech-design --id PVTI_xxx
 *   yarn github-workflows-agent --all --dry-run
 *   yarn github-workflows-agent --implement --skip-pull       # Run without pulling
 */

import { spawn, execSync } from 'child_process';
import { resolve } from 'path';

const SCRIPTS = {
    'product-design': resolve(__dirname, 'product-design.ts'),
    'tech-design': resolve(__dirname, 'tech-design.ts'),
    'implement': resolve(__dirname, 'implement.ts'),
    'pr-review': resolve(__dirname, 'pr-review.ts'),
    'auto-advance': resolve(__dirname, 'auto-advance.ts'),
};

// Order for --all flag
const ALL_ORDER = ['auto-advance', 'product-design', 'tech-design', 'implement', 'pr-review'];

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
 * Pull latest changes from the default branch
 */
function pullLatestChanges(): void {
    console.log('\n🔄 Pulling latest changes from master...');

    // Check for uncommitted changes first
    if (hasUncommittedChanges()) {
        console.error('❌ Error: Uncommitted changes in working directory.');
        console.error('Please commit or stash your changes before running agents.');
        console.error('Or use --skip-pull to run with current code (not recommended).\n');
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
  yarn github-workflows-agent --product-design [options]    Run product design agent
  yarn github-workflows-agent --tech-design [options]       Run technical design agent
  yarn github-workflows-agent --implement [options]         Run implementation agent
  yarn github-workflows-agent --pr-review [options]         Run PR review agent
  yarn github-workflows-agent --auto-advance [options]      Run auto-advance script
  yarn github-workflows-agent --all [options]               Run all in sequence

Options:
  --skip-pull     Skip pulling latest changes from master (not recommended)
  --dry-run       Preview without changes (passed to agents)
  --id <id>       Process specific item (passed to agents)
  --limit <n>     Limit items to process (passed to agents)
  --stream        Stream Claude output (passed to agents only)

Examples:
  yarn github-workflows-agent --product-design --dry-run
  yarn github-workflows-agent --tech-design --id PVTI_xxx
  yarn github-workflows-agent --all --dry-run
  yarn github-workflows-agent --implement --skip-pull       # Run without pulling
`);
}

function runScript(scriptPath: string, args: string[]): Promise<number> {
    return new Promise((resolve) => {
        const child = spawn('tsx', [scriptPath, ...args], {
            stdio: 'inherit',
            env: process.env,
        });

        child.on('close', (code) => {
            resolve(code ?? 0);
        });

        child.on('error', (err) => {
            console.error(`Failed to run script: ${err.message}`);
            resolve(1);
        });
    });
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        printUsage();
        process.exit(0);
    }

    // Find which script(s) to run
    const scriptsToRun: string[] = [];
    const passThrough: string[] = [];
    let skipPull = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--all') {
            scriptsToRun.push(...ALL_ORDER);
        } else if (arg === '--product-design') {
            scriptsToRun.push('product-design');
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
        } else {
            // Pass through to scripts (but not --skip-pull)
            passThrough.push(arg);
        }
    }

    if (scriptsToRun.length === 0) {
        console.error('Error: No agent specified. Use --product-design, --tech-design, --implement, --pr-review, --auto-advance, or --all\n');
        printUsage();
        process.exit(1);
    }

    // Pull latest changes from master (unless --skip-pull is specified)
    if (!skipPull) {
        pullLatestChanges();
    } else {
        console.log('\n⚠️  Skipping git pull (--skip-pull specified)');
        console.log('   Running with current code - may be outdated!\n');
    }

    // Remove duplicates while preserving order
    const uniqueScripts = [...new Set(scriptsToRun)];

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

        const exitCode = await runScript(scriptPath, scriptArgs);

        if (exitCode !== 0 && !passThrough.includes('--dry-run')) {
            console.error(`\nScript ${scriptName} failed with exit code ${exitCode}`);
            // Continue with other scripts even if one fails
        }
    }

    console.log('\nDone!');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
