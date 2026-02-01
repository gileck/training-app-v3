#!/usr/bin/env tsx
/**
 * Credentials Verification Script
 *
 * Tests that your local credentials work correctly:
 * - GitHub API access (repo, project, issues)
 * - Telegram API and webhook info
 * - All required environment variables present
 *
 * This tests credentials from your local .env.local file.
 * For production deployment testing, use `yarn verify-production` instead.
 *
 * Usage:
 *   yarn verify-credentials
 */

import '../src/agents/shared/loadEnv';
import { Command } from 'commander';
import { Octokit } from '@octokit/rest';

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
// Utility Functions
// ============================================================================

function printHeader(text: string) {
    console.log(`\n${text}`);
    console.log('═'.repeat(70));
}

function printSubheader(text: string) {
    console.log(`\n${text}`);
    console.log('─'.repeat(70));
}

function printCheck(result: CheckResult) {
    console.log(result.passed ? `✓ ${result.message}` : `✗ ${result.message}`);
    if (result.details && result.details.length > 0) {
        result.details.forEach(d => console.log(`  ${d}`));
    }
}

function printSummary(results: CategoryResults) {
    console.log(`\n  ${results.passed} passed, ${results.failed} failed`);
}

// ============================================================================
// Check Functions
// ============================================================================

async function checkGitHubAPI(): Promise<CategoryResults> {
    const results: CategoryResults = {
        category: 'GitHub API',
        checks: [],
        passed: 0,
        failed: 0
    };

    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const projectNumber = process.env.GITHUB_PROJECT_NUMBER;

    // Check token exists
    if (!token) {
        results.checks.push({
            passed: false,
            message: 'GITHUB_TOKEN is set',
            details: ['Missing from environment']
        });
        results.failed++;
        return results;
    }

    results.checks.push({ passed: true, message: 'GITHUB_TOKEN is set' });
    results.passed++;

    const octokit = new Octokit({ auth: token });

    // Test repository access
    try {
        await octokit.repos.get({ owner: owner!, repo: repo! });
        results.checks.push({ passed: true, message: 'Repository access works' });
        results.passed++;
    } catch (error: any) {
        results.checks.push({
            passed: false,
            message: 'Repository access failed',
            details: [error.message]
        });
        results.failed++;
    }

    // Test issue creation (dry-run - we won't actually create it)
    try {
        // Just test the API endpoint is accessible
        await octokit.issues.listForRepo({ owner: owner!, repo: repo!, per_page: 1 });
        results.checks.push({ passed: true, message: 'Issues API works' });
        results.passed++;
    } catch (error: any) {
        results.checks.push({
            passed: false,
            message: 'Issues API failed',
            details: [error.message]
        });
        results.failed++;
    }

    // Test GitHub Projects V2 access
    if (projectNumber) {
        try {
            const ownerType = process.env.GITHUB_OWNER_TYPE;
            const query = `
                query($owner: String!, $number: Int!) {
                    ${ownerType === 'org' ? 'organization' : 'user'}(login: $owner) {
                        projectV2(number: $number) {
                            id
                            title
                        }
                    }
                }
            `;

            const response: any = await octokit.graphql(query, {
                owner: owner!,
                number: parseInt(projectNumber)
            });

            const project = ownerType === 'org'
                ? response.organization?.projectV2
                : response.user?.projectV2;

            if (project) {
                results.checks.push({
                    passed: true,
                    message: `GitHub Project access works (${project.title})`
                });
                results.passed++;
            } else {
                results.checks.push({
                    passed: false,
                    message: 'GitHub Project not found',
                    details: [`Project #${projectNumber} not accessible`]
                });
                results.failed++;
            }
        } catch (error: any) {
            results.checks.push({
                passed: false,
                message: 'GitHub Project access failed',
                details: [error.message]
            });
            results.failed++;
        }
    }

    return results;
}

async function checkTelegramAPI(): Promise<CategoryResults> {
    const results: CategoryResults = {
        category: 'Telegram API',
        checks: [],
        passed: 0,
        failed: 0
    };

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.LOCAL_TELEGRAM_CHAT_ID;

    if (!botToken) {
        results.checks.push({
            passed: false,
            message: 'TELEGRAM_BOT_TOKEN is set',
            details: ['Missing from environment']
        });
        results.failed++;
        return results;
    }

    results.checks.push({ passed: true, message: 'TELEGRAM_BOT_TOKEN is set' });
    results.passed++;

    // Test bot token validity by calling getMe
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const data: any = await response.json();

        if (data.ok) {
            results.checks.push({
                passed: true,
                message: `Bot token valid (@${data.result.username})`
            });
            results.passed++;
        } else {
            results.checks.push({
                passed: false,
                message: 'Bot token invalid',
                details: [data.description]
            });
            results.failed++;
        }
    } catch (error: any) {
        results.checks.push({
            passed: false,
            message: 'Bot API unreachable',
            details: [error.message]
        });
        results.failed++;
    }

    // Check webhook info
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        const data: any = await response.json();

        if (data.ok) {
            const webhookUrl = data.result.url;
            if (webhookUrl) {
                results.checks.push({
                    passed: true,
                    message: 'Webhook is configured',
                    details: [`URL: ${webhookUrl}`]
                });
                results.passed++;

                // Check for pending updates or errors
                if (data.result.last_error_message) {
                    results.checks.push({
                        passed: false,
                        message: 'Webhook has errors',
                        details: [data.result.last_error_message]
                    });
                    results.failed++;
                } else {
                    results.checks.push({
                        passed: true,
                        message: 'Webhook has no errors'
                    });
                    results.passed++;
                }
            } else {
                results.checks.push({
                    passed: false,
                    message: 'Webhook not set',
                    details: ['Run: yarn telegram-webhook set <url>']
                });
                results.failed++;
            }
        }
    } catch (error: any) {
        results.checks.push({
            passed: false,
            message: 'Webhook info check failed',
            details: [error.message]
        });
        results.failed++;
    }

    // Send test message (optional - only if chat ID is set)
    if (chatId) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: '✅ Production verification test - Telegram API works!',
                    disable_notification: true
                })
            });

            const data: any = await response.json();

            if (data.ok) {
                results.checks.push({
                    passed: true,
                    message: 'Test message sent successfully'
                });
                results.passed++;
            } else {
                results.checks.push({
                    passed: false,
                    message: 'Test message failed',
                    details: [data.description]
                });
                results.failed++;
            }
        } catch (error: any) {
            results.checks.push({
                passed: false,
                message: 'Test message send error',
                details: [error.message]
            });
            results.failed++;
        }
    }

    return results;
}

async function checkEnvironmentVariables(): Promise<CategoryResults> {
    const results: CategoryResults = {
        category: 'Environment Variables',
        checks: [],
        passed: 0,
        failed: 0
    };

    const required = [
        'GITHUB_TOKEN',
        'GITHUB_OWNER',
        'GITHUB_REPO',
        'GITHUB_PROJECT_NUMBER',
        'GITHUB_OWNER_TYPE',
        'TELEGRAM_BOT_TOKEN',
        'LOCAL_TELEGRAM_CHAT_ID',
        'MONGO_URI',
        'JWT_SECRET',
        'ADMIN_USER_ID'
    ];

    for (const varName of required) {
        const isSet = !!process.env[varName] && process.env[varName]!.length > 0;
        results.checks.push({
            passed: isSet,
            message: `${varName} ${isSet ? '✓' : '✗'}`
        });

        if (isSet) {
            results.passed++;
        } else {
            results.failed++;
        }
    }

    return results;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const program = new Command();

    program
        .name('verify-credentials')
        .description('Verify local credentials work correctly')
        .parse(process.argv);

    console.log('🔍 Verifying Local Credentials');
    console.log('═'.repeat(70));

    // Check environment variables
    printSubheader('📋 Environment Variables');
    const envResults = await checkEnvironmentVariables();
    envResults.checks.forEach(printCheck);
    printSummary(envResults);

    // Check GitHub API
    printSubheader('🐙 GitHub API');
    const githubResults = await checkGitHubAPI();
    githubResults.checks.forEach(printCheck);
    printSummary(githubResults);

    // Check Telegram API
    printSubheader('📱 Telegram API');
    const telegramResults = await checkTelegramAPI();
    telegramResults.checks.forEach(printCheck);
    printSummary(telegramResults);

    // Overall summary
    const totalPassed = envResults.passed + githubResults.passed + telegramResults.passed;
    const totalFailed = envResults.failed + githubResults.failed + telegramResults.failed;
    const totalChecks = totalPassed + totalFailed;

    printHeader('📊 Overall Summary');
    console.log(`Total: ${totalChecks} checks`);
    console.log(`✓ Passed: ${totalPassed}`);
    console.log(`✗ Failed: ${totalFailed}`);

    if (totalFailed === 0) {
        console.log('\n✅ All checks passed! Production environment is properly configured.');
        process.exit(0);
    } else {
        console.log('\n❌ Some checks failed. Please review the errors above.');
        process.exit(1);
    }
}

main().catch(error => {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
});
