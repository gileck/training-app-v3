#!/usr/bin/env tsx
/**
 * GitHub Projects Workflow Setup Verification Script
 *
 * Verifies that all required configuration is in place for the GitHub Projects workflow:
 * - Local environment variables (.env.local)
 * - Vercel environment variables (production)
 * - GitHub repository secrets and variables
 * - app.config.js configuration
 * - GitHub Project structure
 *
 * Usage:
 *   yarn verify-setup
 *   yarn verify-setup --skip-github    # Skip GitHub repo checks (no gh CLI required)
 *   yarn verify-setup --skip-vercel    # Skip Vercel checks (no vercel CLI required)
 */

import '../src/agents/shared/loadEnv';
import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

// ============================================================================
// Types
// ============================================================================

interface CheckResult {
    passed: boolean;
    message: string;
    details?: string[];
}

interface CategoryResults {
    category: string;
    checks: CheckResult[];
    passed: number;
    failed: number;
}

// ============================================================================
// Configuration
// ============================================================================

const REQUIRED_ENV_VARS = {
    github: [
        'GITHUB_TOKEN',
        'GITHUB_OWNER',
        'GITHUB_REPO',
        'GITHUB_PROJECT_NUMBER',
        'GITHUB_OWNER_TYPE'
    ],
    telegram: [
        'TELEGRAM_BOT_TOKEN',
        'LOCAL_TELEGRAM_CHAT_ID'
    ],
    database: [
        'MONGO_URI'
    ],
    auth: [
        'JWT_SECRET',
        'ADMIN_USER_ID'
    ]
};

const REQUIRED_GITHUB_SECRETS = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'PROJECT_TOKEN'
];

const REQUIRED_GITHUB_VARIABLES = [
    'TELEGRAM_NOTIFICATIONS_ENABLED',
    'GITHUB_OWNER',
    'GITHUB_REPO',
    'GITHUB_PROJECT_NUMBER',
    'GITHUB_OWNER_TYPE'
];

// ============================================================================
// Utility Functions
// ============================================================================

function runCommand(command: string): string | null {
    try {
        return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
        return null;
    }
}

function checkEnvVar(name: string, source: 'local' | 'vercel' | 'github'): CheckResult {
    const value = process.env[name];
    const isSet = !!value && value.length > 0;

    return {
        passed: isSet,
        message: `${name} ${isSet ? '✓' : '✗'}`,
        details: isSet ? undefined : [`Missing in ${source}`]
    };
}

// ============================================================================
// Check Functions
// ============================================================================

async function checkLocalEnv(): Promise<CategoryResults> {
    const checks: CheckResult[] = [];
    const envPath = resolve(process.cwd(), '.env.local');

    // Check if .env.local exists
    checks.push({
        passed: existsSync(envPath),
        message: '.env.local file exists',
        details: existsSync(envPath) ? undefined : ['Run: cp .env.example .env.local']
    });

    // Check all required environment variables
    Object.entries(REQUIRED_ENV_VARS).forEach(([category, vars]) => {
        vars.forEach(varName => {
            checks.push(checkEnvVar(varName, 'local'));
        });
    });

    // Check app.config.js
    const configPath = resolve(process.cwd(), 'src/app.config.js');
    if (existsSync(configPath)) {
        try {
            const configContent = readFileSync(configPath, 'utf-8');
            const hasOwnerChatId = configContent.includes('ownerTelegramChatId') &&
                                 !configContent.includes('ownerTelegramChatId: \'\'') &&
                                 !configContent.includes('ownerTelegramChatId: ""');

            checks.push({
                passed: hasOwnerChatId,
                message: 'app.config.js ownerTelegramChatId set',
                details: hasOwnerChatId ? undefined : ['Update ownerTelegramChatId in src/app.config.js']
            });
        } catch (error) {
            checks.push({
                passed: false,
                message: 'app.config.js readable',
                details: [`Error reading config: ${error}`]
            });
        }
    } else {
        checks.push({
            passed: false,
            message: 'app.config.js exists',
            details: ['File not found: src/app.config.js']
        });
    }

    const passed = checks.filter(c => c.passed).length;
    return {
        category: 'Local Environment',
        checks,
        passed,
        failed: checks.length - passed
    };
}

async function checkVercelEnv(): Promise<CategoryResults> {
    const checks: CheckResult[] = [];

    // Check if Vercel is linked
    const vercelProjectPath = resolve(process.cwd(), '.vercel/project.json');
    const isLinked = existsSync(vercelProjectPath);

    checks.push({
        passed: isLinked,
        message: 'Vercel project linked',
        details: isLinked ? undefined : ['Run: vercel link']
    });

    if (!isLinked) {
        return {
            category: 'Vercel Environment',
            checks,
            passed: 0,
            failed: checks.length
        };
    }

    // Check Vercel environment variables
    const vercelEnvOutput = runCommand('npx tsx scripts/vercel-cli.ts env --target production 2>/dev/null');

    if (vercelEnvOutput) {
        Object.entries(REQUIRED_ENV_VARS).forEach(([_, vars]) => {
            vars.forEach(varName => {
                const isSet = vercelEnvOutput.includes(varName);
                checks.push({
                    passed: isSet,
                    message: `${varName} in Vercel ${isSet ? '✓' : '✗'}`,
                    details: isSet ? undefined : ['Run: yarn vercel-cli env:push --file .env.local --target production']
                });
            });
        });
    } else {
        checks.push({
            passed: false,
            message: 'Unable to fetch Vercel environment variables',
            details: ['Ensure VERCEL_TOKEN is set and vercel is linked']
        });
    }

    const passed = checks.filter(c => c.passed).length;
    return {
        category: 'Vercel Environment',
        checks,
        passed,
        failed: checks.length - passed
    };
}

async function checkGitHubRepo(): Promise<CategoryResults> {
    const checks: CheckResult[] = [];

    // Check if gh CLI is available
    const ghVersion = runCommand('gh --version');
    checks.push({
        passed: !!ghVersion,
        message: 'GitHub CLI (gh) installed',
        details: ghVersion ? undefined : ['Install: https://cli.github.com/']
    });

    if (!ghVersion) {
        return {
            category: 'GitHub Repository',
            checks,
            passed: 0,
            failed: checks.length
        };
    }

    // Check gh auth status
    const authStatus = runCommand('gh auth status 2>&1');
    const isAuthed = authStatus?.includes('Logged in') || authStatus?.includes('✓');

    checks.push({
        passed: !!isAuthed,
        message: 'GitHub CLI authenticated',
        details: isAuthed ? undefined : ['Run: gh auth login']
    });

    if (!isAuthed) {
        return {
            category: 'GitHub Repository',
            checks,
            passed: 0,
            failed: checks.length
        };
    }

    // Check repository secrets
    const secretsOutput = runCommand('gh secret list');
    if (secretsOutput) {
        REQUIRED_GITHUB_SECRETS.forEach(secret => {
            const isSet = secretsOutput.includes(secret);
            checks.push({
                passed: isSet,
                message: `Secret: ${secret} ${isSet ? '✓' : '✗'}`,
                details: isSet ? undefined : ['Run: yarn setup-github-secrets']
            });
        });
    } else {
        checks.push({
            passed: false,
            message: 'Unable to fetch GitHub secrets',
            details: ['Ensure you have repo access']
        });
    }

    // Check repository variables
    const variablesOutput = runCommand('gh variable list');
    if (variablesOutput) {
        REQUIRED_GITHUB_VARIABLES.forEach(variable => {
            const isSet = variablesOutput.includes(variable);
            checks.push({
                passed: isSet,
                message: `Variable: ${variable} ${isSet ? '✓' : '✗'}`,
                details: isSet ? undefined : ['Run: yarn setup-github-secrets']
            });
        });
    } else {
        checks.push({
            passed: false,
            message: 'Unable to fetch GitHub variables',
            details: ['Ensure you have repo access']
        });
    }

    // Check workflow permissions
    const workflowPermissions = runCommand('gh api repos/:owner/:repo/actions/permissions 2>/dev/null');
    if (workflowPermissions) {
        const hasWritePermission = workflowPermissions.includes('"default_workflow_permissions":"write"');
        checks.push({
            passed: hasWritePermission,
            message: `Workflow permissions: ${hasWritePermission ? 'read-write ✓' : 'read-only ✗'}`,
            details: hasWritePermission ? undefined : ['Settings → Actions → General → Workflow permissions → "Read and write permissions"']
        });
    }

    const passed = checks.filter(c => c.passed).length;
    return {
        category: 'GitHub Repository',
        checks,
        passed,
        failed: checks.length - passed
    };
}

async function checkGitHubProject(): Promise<CategoryResults> {
    const checks: CheckResult[] = [];

    const owner = process.env.GITHUB_OWNER;
    const projectNumber = process.env.GITHUB_PROJECT_NUMBER;

    if (!owner || !projectNumber) {
        checks.push({
            passed: false,
            message: 'GITHUB_OWNER and GITHUB_PROJECT_NUMBER required',
            details: ['Set these in .env.local']
        });
        return {
            category: 'GitHub Project',
            checks,
            passed: 0,
            failed: 1
        };
    }

    // Check if project exists (requires GitHub API)
    checks.push({
        passed: true,
        message: 'GitHub Project configuration present',
        details: [`Project: ${owner}/projects/${projectNumber}`, 'Manual verification recommended']
    });

    const passed = checks.filter(c => c.passed).length;
    return {
        category: 'GitHub Project',
        checks,
        passed,
        failed: checks.length - passed
    };
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
    const program = new Command();

    program
        .name('verify-setup')
        .description('Verify GitHub Projects workflow setup')
        .option('--skip-github', 'Skip GitHub repository checks')
        .option('--skip-vercel', 'Skip Vercel environment checks')
        .parse();

    const options = program.opts();

    console.log('🔍 Verifying GitHub Projects Workflow Setup');
    console.log('═'.repeat(70));
    console.log();

    const results: CategoryResults[] = [];

    // Run checks
    results.push(await checkLocalEnv());

    if (!options.skipVercel) {
        results.push(await checkVercelEnv());
    }

    if (!options.skipGithub) {
        results.push(await checkGitHubRepo());
        results.push(await checkGitHubProject());
    }

    // Print results
    results.forEach(result => {
        console.log(`\n📋 ${result.category}`);
        console.log('─'.repeat(70));

        result.checks.forEach(check => {
            const icon = check.passed ? '✓' : '✗';
            const color = check.passed ? '\x1b[32m' : '\x1b[31m';
            const reset = '\x1b[0m';

            console.log(`${color}${icon}${reset} ${check.message}`);

            if (check.details) {
                check.details.forEach(detail => {
                    console.log(`    ${detail}`);
                });
            }
        });

        const summary = `${result.passed} passed, ${result.failed} failed`;
        const summaryColor = result.failed === 0 ? '\x1b[32m' : '\x1b[33m';
        console.log(`\n  ${summaryColor}${summary}\x1b[0m`);
    });

    // Overall summary
    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalChecks = totalPassed + totalFailed;

    console.log('\n═'.repeat(70));
    console.log(`\n📊 Overall: ${totalPassed}/${totalChecks} checks passed`);

    if (totalFailed === 0) {
        console.log('\n✅ All checks passed! Your setup is ready.');
    } else {
        console.log(`\n⚠️  ${totalFailed} check(s) failed. Review the details above.`);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Error running verification:', error);
    process.exit(1);
});
