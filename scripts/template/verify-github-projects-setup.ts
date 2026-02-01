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

const OPTIONAL_ENV_VARS = {
    github: [
        'GITHUB_BOT_TOKEN'  // Bot account token (recommended for PR approvals)
    ]
};

const REQUIRED_GITHUB_SECRETS = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'PROJECT_TOKEN'
];

const REQUIRED_GITHUB_VARIABLES = [
    'TELEGRAM_NOTIFICATIONS_ENABLED',
    'PROJECT_OWNER',
    'PROJECT_REPO',
    'PROJECT_NUMBER',
    'PROJECT_OWNER_TYPE'
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

    // Check optional environment variables (warnings only, not failures)
    Object.entries(OPTIONAL_ENV_VARS).forEach(([category, vars]) => {
        vars.forEach(varName => {
            const value = process.env[varName];
            const isSet = !!value && value.length > 0;
            checks.push({
                passed: true,  // Always pass (optional)
                message: `${varName} ${isSet ? '✓ (recommended)' : 'ℹ (optional)'}`,
                details: isSet ? undefined : ['Recommended for bot account setup - see docs/init-github-projects-workflow.md']
            });
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

        // Check optional Vercel environment variables (warnings only)
        Object.entries(OPTIONAL_ENV_VARS).forEach(([_, vars]) => {
            vars.forEach(varName => {
                const isSet = vercelEnvOutput.includes(varName);
                checks.push({
                    passed: true,  // Always pass (optional)
                    message: `${varName} in Vercel ${isSet ? '✓ (recommended)' : 'ℹ (optional)'}`,
                    details: isSet ? undefined : ['Recommended: yarn vercel-cli env:push --file .env.local --target production']
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
    const workflowPermissions = runCommand('gh api repos/:owner/:repo/actions/permissions/workflow 2>/dev/null');
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

async function checkTokenPermissions(): Promise<CategoryResults> {
    const checks: CheckResult[] = [];

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const projectNumber = process.env.GITHUB_PROJECT_NUMBER;
    const ownerType = process.env.GITHUB_OWNER_TYPE || 'user';
    const token = process.env.GITHUB_TOKEN;
    const botToken = process.env.GITHUB_BOT_TOKEN;

    if (!token) {
        checks.push({
            passed: false,
            message: 'GITHUB_TOKEN not set - cannot verify permissions',
            details: ['Set GITHUB_TOKEN in .env.local']
        });
        return {
            category: 'Token Permissions',
            checks,
            passed: 0,
            failed: 1
        };
    }

    // Test 1: Check repo access (repo scope)
    try {
        const repoResult = runCommand(`curl -s -o /dev/null -w "%{http_code}" -H "Authorization: bearer ${token}" https://api.github.com/repos/${owner}/${repo}`);
        const repoAccessOk = repoResult === '200';
        checks.push({
            passed: repoAccessOk,
            message: `GITHUB_TOKEN repo access ${repoAccessOk ? '✓' : '✗'}`,
            details: repoAccessOk ? undefined : [
                `HTTP ${repoResult} - Token cannot access ${owner}/${repo}`,
                'Ensure token has "repo" scope (Classic) or "Contents: Read" (Fine-grained)'
            ]
        });
    } catch (error) {
        checks.push({
            passed: false,
            message: 'GITHUB_TOKEN repo access check failed',
            details: [`Error: ${error instanceof Error ? error.message : String(error)}`]
        });
    }

    // Test 2: Check project access (project scope) via GraphQL
    try {
        const projectQuery = ownerType === 'org'
            ? `query { organization(login: \\"${owner}\\") { projectV2(number: ${projectNumber}) { id title } } }`
            : `query { user(login: \\"${owner}\\") { projectV2(number: ${projectNumber}) { id title } } }`;

        const graphqlResult = runCommand(
            `curl -s -H "Authorization: bearer ${token}" -X POST -d '{"query":"${projectQuery}"}' https://api.github.com/graphql`
        );

        if (graphqlResult) {
            const parsed = JSON.parse(graphqlResult);
            const projectData = ownerType === 'org'
                ? parsed?.data?.organization?.projectV2
                : parsed?.data?.user?.projectV2;

            if (projectData?.id) {
                checks.push({
                    passed: true,
                    message: `GITHUB_TOKEN project access ✓`,
                    details: [`Can access project: "${projectData.title}"`]
                });
            } else if (parsed?.errors) {
                const errorMsg = parsed.errors[0]?.message || 'Unknown error';
                checks.push({
                    passed: false,
                    message: 'GITHUB_TOKEN project access ✗',
                    details: [
                        `Error: ${errorMsg}`,
                        '',
                        'For Classic PAT: ensure "project" scope is checked',
                        'For Fine-grained PAT: ensure "Projects: Read and write" under Account permissions'
                    ]
                });
            } else {
                checks.push({
                    passed: false,
                    message: 'GITHUB_TOKEN project access ✗',
                    details: [
                        'Project not found or no access',
                        `Tried to access: ${ownerType}/${owner}/projects/${projectNumber}`,
                        '',
                        'For Classic PAT: ensure "project" scope is checked',
                        'For Fine-grained PAT: ensure "Projects: Read and write" under Account permissions'
                    ]
                });
            }
        }
    } catch (error) {
        checks.push({
            passed: false,
            message: 'GITHUB_TOKEN project access check failed',
            details: [`Error: ${error instanceof Error ? error.message : String(error)}`]
        });
    }

    // Test 3: Check bot token permissions (if set)
    if (botToken) {
        try {
            const botRepoResult = runCommand(`curl -s -o /dev/null -w "%{http_code}" -H "Authorization: bearer ${botToken}" https://api.github.com/repos/${owner}/${repo}`);
            const botRepoAccessOk = botRepoResult === '200';
            checks.push({
                passed: botRepoAccessOk,
                message: `GITHUB_BOT_TOKEN repo access ${botRepoAccessOk ? '✓' : '✗'}`,
                details: botRepoAccessOk ? undefined : [
                    `HTTP ${botRepoResult} - Bot token cannot access ${owner}/${repo}`,
                    'Bot token needs "repo" scope for creating PRs'
                ]
            });

            // Check bot can create PRs (needs write access)
            const botUserResult = runCommand(`curl -s -H "Authorization: bearer ${botToken}" https://api.github.com/user`);
            if (botUserResult) {
                const botUser = JSON.parse(botUserResult);
                if (botUser.login) {
                    checks.push({
                        passed: true,
                        message: `GITHUB_BOT_TOKEN authenticated as: ${botUser.login} ✓`,
                        details: ['PRs will be created by this account (allowing admin to approve)']
                    });
                }
            }
        } catch (error) {
            checks.push({
                passed: false,
                message: 'GITHUB_BOT_TOKEN check failed',
                details: [`Error: ${error instanceof Error ? error.message : String(error)}`]
            });
        }
    } else {
        checks.push({
            passed: true,
            message: 'GITHUB_BOT_TOKEN not set (optional)',
            details: ['PRs will be created by admin account - you cannot approve your own PRs']
        });
    }

    const passed = checks.filter(c => c.passed).length;
    return {
        category: 'Token Permissions',
        checks,
        passed,
        failed: checks.length - passed
    };
}

async function checkGitHubProject(): Promise<CategoryResults> {
    const checks: CheckResult[] = [];

    const owner = process.env.GITHUB_OWNER;
    const projectNumber = process.env.GITHUB_PROJECT_NUMBER;
    const token = process.env.GITHUB_TOKEN;

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
        details: [`Project: ${owner}/projects/${projectNumber}`]
    });

    // Verify Status field (columns) has all required options
    if (token) {
        try {
            // Use dynamic import to avoid loading server code at script load time
            const { getProjectManagementAdapter } = await import('../../src/server/project-management/index.js');
            const { STATUSES } = await import('../../src/server/project-management/config.js');

            const adapter = getProjectManagementAdapter();
            await adapter.init();

            const availableStatuses = await adapter.getAvailableStatuses();
            const requiredStatuses = Object.values(STATUSES);
            const missingStatuses = requiredStatuses.filter(s => !availableStatuses.includes(s));

            if (missingStatuses.length === 0) {
                checks.push({
                    passed: true,
                    message: `Status field has all 7 columns ✓`,
                    details: availableStatuses.map(s => `  - ${s}`)
                });
            } else {
                checks.push({
                    passed: false,
                    message: `Status field missing ${missingStatuses.length} column(s)`,
                    details: [
                        'Missing columns:',
                        ...missingStatuses.map(s => `  - ${s}`),
                        '',
                        'Go to your GitHub Project → Add missing columns with exact names above'
                    ]
                });
            }
        } catch (error) {
            checks.push({
                passed: false,
                message: 'Could not verify Status field columns',
                details: [`Error: ${error instanceof Error ? error.message : String(error)}`]
            });
        }
    }

    // Verify Review Status field has all required options
    if (token) {
        try {
            // Use dynamic import to avoid loading server code at script load time
            const { getProjectManagementAdapter } = await import('../../src/server/project-management/index.js');
            const { REVIEW_STATUSES } = await import('../../src/server/project-management/config.js');

            const adapter = getProjectManagementAdapter();
            await adapter.init();

            if (adapter.hasReviewStatusField()) {
                const availableStatuses = await adapter.getAvailableReviewStatuses();
                const requiredStatuses = Object.values(REVIEW_STATUSES);
                const missingStatuses = requiredStatuses.filter(s => !availableStatuses.includes(s));

                if (missingStatuses.length === 0) {
                    checks.push({
                        passed: true,
                        message: `Review Status field has all 6 options ✓`,
                        details: availableStatuses.map(s => `  - ${s}`)
                    });
                } else {
                    checks.push({
                        passed: false,
                        message: `Review Status field missing ${missingStatuses.length} option(s)`,
                        details: [
                            'Missing options:',
                            ...missingStatuses.map(s => `  - ${s}`),
                            '',
                            'Go to your GitHub Project → Edit "Review Status" field → Add missing options'
                        ]
                    });
                }
            } else {
                checks.push({
                    passed: false,
                    message: 'Review Status field not found',
                    details: ['Create "Review Status" custom field in your GitHub Project (see docs/init-github-projects-workflow.md Step 1)']
                });
            }
        } catch (error) {
            checks.push({
                passed: false,
                message: 'Could not verify Review Status field',
                details: [`Error: ${error instanceof Error ? error.message : String(error)}`]
            });
        }
    }

    // Verify Implementation Phase field (optional - for multi-PR workflow)
    if (token) {
        try {
            const { getProjectManagementAdapter } = await import('../../src/server/project-management/index.js');
            const adapter = getProjectManagementAdapter();
            await adapter.init();

            if (adapter.hasImplementationPhaseField()) {
                checks.push({
                    passed: true,
                    message: 'Implementation Phase field exists ✓ (multi-PR workflow enabled)',
                    details: ['L/XL features will be split into multiple PRs']
                });
            } else {
                checks.push({
                    passed: true,
                    message: 'Implementation Phase field not found (optional)',
                    details: [
                        'All features will use single-PR workflow',
                        'To enable multi-PR workflow for L/XL features:',
                        '  1. Go to your GitHub Project',
                        '  2. Click "+" button (add field)',
                        '  3. Select "Text"',
                        '  4. Name it exactly: "Implementation Phase"',
                        '  5. Click "Save"',
                        '',
                        'See docs/init-github-projects-workflow.md for details'
                    ]
                });
            }
        } catch (error) {
            checks.push({
                passed: false,
                message: 'Could not verify Implementation Phase field',
                details: [`Error: ${error instanceof Error ? error.message : String(error)}`]
            });
        }
    }

    const passed = checks.filter(c => c.passed).length;
    return {
        category: 'GitHub Project',
        checks,
        passed,
        failed: checks.length - passed
    };
}

async function checkPlaywrightMCP(): Promise<CategoryResults> {
    const checks: CheckResult[] = [];

    // Check if @playwright/mcp is installed
    const mcpCliPath = resolve(process.cwd(), 'node_modules', '@playwright', 'mcp', 'cli.js');
    const isInstalled = existsSync(mcpCliPath);

    checks.push({
        passed: true, // Always pass - this is optional
        message: `@playwright/mcp ${isInstalled ? '✓ (local testing enabled)' : 'ℹ (optional - local testing disabled)'}`,
        details: isInstalled
            ? ['Implementation agent can perform local browser testing during development']
            : [
                'Local browser testing is disabled for implementation agent',
                'To enable: yarn add -D @playwright/mcp',
                'This allows the agent to verify UI changes in a headless browser'
            ]
    });

    // If installed, check if browsers are available
    if (isInstalled) {
        const playwrightPath = resolve(process.cwd(), 'node_modules', 'playwright-core');
        const hasBrowsers = existsSync(playwrightPath);

        checks.push({
            passed: true, // Always pass - informational
            message: `playwright-core ${hasBrowsers ? '✓' : 'ℹ (may need browser install)'}`,
            details: hasBrowsers
                ? undefined
                : ['If browser tests fail, run: npx playwright install chromium']
        });
    }

    const passed = checks.filter(c => c.passed).length;
    return {
        category: 'Local Testing (Optional)',
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
        results.push(await checkTokenPermissions());
        results.push(await checkGitHubProject());
    }

    // Always check optional features
    results.push(await checkPlaywrightMCP());

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
