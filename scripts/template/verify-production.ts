#!/usr/bin/env tsx
/**
 * Production Deployment Verification Script
 *
 * Tests the actual production deployment on Vercel:
 * - Vercel environment variables are set
 * - Local vs Vercel env vars match (actual value comparison)
 * - Production webhook endpoint is accessible
 * - Production app responds correctly
 *
 * This tests the DEPLOYED app, not local credentials.
 * For credential testing, use `yarn verify-credentials` instead.
 *
 * The script pulls production env vars and compares actual values
 * without exposing secrets in the output.
 *
 * Usage:
 *   yarn verify-production
 *   yarn verify-production --url https://your-custom-domain.com
 *   yarn verify-production --skip-vercel  # Skip env var checks
 */

import '../../src/agents/shared/loadEnv';
import { Command } from 'commander';
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
// Utility Functions
// ============================================================================

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

function runCommand(command: string): string | null {
    try {
        return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
        return null;
    }
}

// ============================================================================
// Check Functions
// ============================================================================

async function checkVercelProject(): Promise<CategoryResults> {
    const results: CategoryResults = {
        category: 'Vercel Project',
        checks: [],
        passed: 0,
        failed: 0
    };

    // Check if project is linked
    const projectJson = runCommand('cat .vercel/project.json 2>/dev/null');
    if (!projectJson) {
        results.checks.push({
            passed: false,
            message: 'Vercel project linked',
            details: ['Run: vercel link']
        });
        results.failed++;
        return results;
    }

    results.checks.push({
        passed: true,
        message: 'Vercel project linked'
    });
    results.passed++;

    return results;
}

async function checkVercelEnvironmentVariables(): Promise<CategoryResults> {
    const results: CategoryResults = {
        category: 'Vercel Environment Variables',
        checks: [],
        passed: 0,
        failed: 0
    };

    const requiredVars = [
        'GITHUB_TOKEN',
        'GITHUB_OWNER',
        'GITHUB_REPO',
        'GITHUB_PROJECT_NUMBER',
        'GITHUB_OWNER_TYPE',
        'TELEGRAM_BOT_TOKEN',
        'AGENT_TELEGRAM_CHAT_ID',
        'LOCAL_TELEGRAM_CHAT_ID',
        'GH_TELEGRAM_CHAT_ID',
        'VERCEL_TELEGRAM_CHAT_ID',
        'MONGO_URI',
        'JWT_SECRET',
        'ADMIN_USER_ID'
    ];

    // Get production environment variables
    const envOutput = runCommand('vercel env ls production 2>/dev/null');

    if (!envOutput) {
        results.checks.push({
            passed: false,
            message: 'Vercel CLI accessible',
            details: ['Install: npm i -g vercel', 'Or skip with: --skip-vercel']
        });
        results.failed++;
        return results;
    }

    results.checks.push({
        passed: true,
        message: 'Vercel CLI accessible'
    });
    results.passed++;

    // Check each required variable
    for (const varName of requiredVars) {
        const isSet = envOutput.includes(varName);
        results.checks.push({
            passed: isSet,
            message: `${varName} in Vercel ${isSet ? '✓' : '✗'}`,
            details: isSet ? undefined : ['Push to Vercel: yarn vercel-cli env:push']
        });

        if (isSet) {
            results.passed++;
        } else {
            results.failed++;
        }
    }

    return results;
}

async function compareLocalAndVercelEnvVars(): Promise<CategoryResults> {
    const results: CategoryResults = {
        category: 'Local vs Vercel Environment Variables',
        checks: [],
        passed: 0,
        failed: 0
    };

    // Variables to compare
    const varsToCompare = [
        'GITHUB_TOKEN',
        'GITHUB_OWNER',
        'GITHUB_REPO',
        'GITHUB_PROJECT_NUMBER',
        'GITHUB_OWNER_TYPE',
        'TELEGRAM_BOT_TOKEN',
        'AGENT_TELEGRAM_CHAT_ID',
        'LOCAL_TELEGRAM_CHAT_ID',
        'GH_TELEGRAM_CHAT_ID',
        'VERCEL_TELEGRAM_CHAT_ID',
        'MONGO_URI',
        'JWT_SECRET',
        'ADMIN_USER_ID'
    ];

    // Get Vercel env vars list
    const vercelEnvOutput = runCommand('vercel env ls production 2>/dev/null');
    if (!vercelEnvOutput) {
        results.checks.push({
            passed: false,
            message: 'Cannot fetch Vercel env vars',
            details: ['Vercel CLI not accessible']
        });
        results.failed++;
        return results;
    }

    // Pull Vercel production env vars to temp file
    const tempFile = '.env.vercel.temp';
    const pullResult = runCommand(`vercel env pull ${tempFile} --environment production 2>/dev/null`);

    if (!pullResult && pullResult !== '') {
        results.checks.push({
            passed: false,
            message: 'Cannot pull Vercel env values',
            details: ['vercel env pull failed - falling back to existence check only']
        });
        results.failed++;

        // Fallback to existence check only
        for (const varName of varsToCompare) {
            const localValue = process.env[varName];
            const isInVercel = vercelEnvOutput.includes(varName);

            if (localValue && isInVercel) {
                results.checks.push({
                    passed: true,
                    message: `${varName} - exists in both (${localValue.length} chars locally)`
                });
                results.passed++;
            } else if (!localValue && !isInVercel) {
                results.checks.push({
                    passed: false,
                    message: `${varName} - missing in both`
                });
                results.failed++;
            } else if (!localValue) {
                results.checks.push({
                    passed: false,
                    message: `${varName} - missing locally`
                });
                results.failed++;
            } else {
                results.checks.push({
                    passed: false,
                    message: `${varName} - missing in Vercel`
                });
                results.failed++;
            }
        }

        return results;
    }

    // Read Vercel env vars from temp file
    const vercelEnvContent = runCommand(`cat ${tempFile} 2>/dev/null`);
    runCommand(`rm -f ${tempFile}`); // Clean up immediately

    if (!vercelEnvContent) {
        results.checks.push({
            passed: false,
            message: 'Cannot read pulled env vars',
            details: ['Temp file read failed']
        });
        results.failed++;
        return results;
    }

    // Parse Vercel env vars (strip surrounding quotes if present)
    const vercelEnv: Record<string, string> = {};
    vercelEnvContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            let value = match[2];
            // Strip surrounding quotes (Vercel adds them)
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            vercelEnv[match[1]] = value;
        }
    });

    // Compare each variable
    for (const varName of varsToCompare) {
        const localValue = process.env[varName];
        const vercelValue = vercelEnv[varName];

        // Check if both have the variable
        if (!localValue && !vercelValue) {
            results.checks.push({
                passed: false,
                message: `${varName} - missing in both`,
                details: ['Not set locally or in Vercel']
            });
            results.failed++;
            continue;
        }

        if (!localValue) {
            results.checks.push({
                passed: false,
                message: `${varName} - missing locally`,
                details: ['Set in Vercel but not in .env.local']
            });
            results.failed++;
            continue;
        }

        if (!vercelValue) {
            results.checks.push({
                passed: false,
                message: `${varName} - missing in Vercel`,
                details: ['Set locally but not in Vercel production']
            });
            results.failed++;
            continue;
        }

        // Both exist - compare actual values
        if (localValue === vercelValue) {
            results.checks.push({
                passed: true,
                message: `${varName} - values match ✓ (${localValue.length} chars)`
            });
            results.passed++;
        } else {
            // Values don't match - show length difference as hint
            results.checks.push({
                passed: false,
                message: `${varName} - values DO NOT match`,
                details: [
                    `Local: ${localValue.length} chars`,
                    `Vercel: ${vercelValue.length} chars`,
                    'Update Vercel: yarn vercel-cli env:push'
                ]
            });
            results.failed++;
        }
    }

    return results;
}

async function checkProductionDeployment(productionUrl: string): Promise<CategoryResults> {
    const results: CategoryResults = {
        category: 'Production Deployment',
        checks: [],
        passed: 0,
        failed: 0
    };

    // Test main app is accessible
    try {
        const response = await fetch(productionUrl, { method: 'HEAD' });
        if (response.ok || response.status === 405) {
            results.checks.push({
                passed: true,
                message: 'Production app accessible',
                details: [`URL: ${productionUrl}`]
            });
            results.passed++;
        } else {
            results.checks.push({
                passed: false,
                message: 'Production app not accessible',
                details: [`Status: ${response.status}`, `URL: ${productionUrl}`]
            });
            results.failed++;
        }
    } catch (error: any) {
        results.checks.push({
            passed: false,
            message: 'Production app unreachable',
            details: [error.message, `URL: ${productionUrl}`]
        });
        results.failed++;
        return results;
    }

    // Test webhook endpoint exists
    const webhookUrl = `${productionUrl}/api/telegram-webhook`;
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        // 405 or 400 is expected (we're not sending valid Telegram data)
        // 404 means the endpoint doesn't exist
        if (response.status === 404) {
            results.checks.push({
                passed: false,
                message: 'Webhook endpoint exists',
                details: ['Endpoint not found (404)', 'Deploy your app to Vercel']
            });
            results.failed++;
        } else {
            results.checks.push({
                passed: true,
                message: 'Webhook endpoint exists',
                details: [`Status: ${response.status} (expected - not valid Telegram request)`]
            });
            results.passed++;
        }
    } catch (error: any) {
        results.checks.push({
            passed: false,
            message: 'Webhook endpoint check failed',
            details: [error.message]
        });
        results.failed++;
    }

    return results;
}

async function getProductionUrl(): Promise<string | null> {
    // Try to get from VERCEL_PROJECT_PRODUCTION_URL env var
    const envUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (envUrl) {
        return `https://${envUrl}`;
    }

    // Try to get from vercel CLI
    const projectJson = runCommand('cat .vercel/project.json 2>/dev/null');
    if (projectJson) {
        try {
            const project = JSON.parse(projectJson);
            const projectId = project.projectId;

            // Get production URL from vercel
            const deployment = runCommand(`vercel ls --prod --json 2>/dev/null | head -1`);
            if (deployment) {
                const data = JSON.parse(deployment);
                return data.url ? `https://${data.url}` : null;
            }
        } catch {
            // Fall through
        }
    }

    return null;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const program = new Command();

    program
        .name('verify-production')
        .description('Verify production deployment on Vercel')
        .option('--url <url>', 'Production URL (auto-detected if not provided)')
        .option('--skip-vercel', 'Skip Vercel environment variable checks')
        .parse(process.argv);

    const options = program.opts();

    console.log('🔍 Verifying Production Deployment');
    console.log('═'.repeat(70));

    // Get production URL
    let productionUrl = options.url;
    if (!productionUrl) {
        productionUrl = await getProductionUrl();
        if (!productionUrl) {
            console.error('\n❌ Could not auto-detect production URL.');
            console.error('   Provide URL manually: yarn verify-production --url https://your-app.vercel.app');
            process.exit(1);
        }
    }

    console.log(`\n📍 Testing: ${productionUrl}`);

    // Check Vercel project
    printSubheader('📦 Vercel Project');
    const projectResults = await checkVercelProject();
    projectResults.checks.forEach(printCheck);
    printSummary(projectResults);

    // Check Vercel environment variables
    if (!options.skipVercel) {
        printSubheader('🔐 Vercel Environment Variables (Production)');
        const envResults = await checkVercelEnvironmentVariables();
        envResults.checks.forEach(printCheck);
        printSummary(envResults);

        // Compare local vs Vercel env vars
        printSubheader('🔄 Local vs Vercel Environment Variables');
        const comparisonResults = await compareLocalAndVercelEnvVars();
        comparisonResults.checks.forEach(printCheck);
        printSummary(comparisonResults);
    }

    // Check production deployment
    printSubheader('🌐 Production Deployment');
    const deploymentResults = await checkProductionDeployment(productionUrl);
    deploymentResults.checks.forEach(printCheck);
    printSummary(deploymentResults);

    // Overall summary
    const allResults = [projectResults, deploymentResults];
    if (!options.skipVercel) {
        const envResults = await checkVercelEnvironmentVariables();
        const comparisonResults = await compareLocalAndVercelEnvVars();
        allResults.splice(1, 0, envResults, comparisonResults);
    }

    const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
    const totalChecks = totalPassed + totalFailed;

    printSubheader('📊 Overall Summary');
    console.log(`Total: ${totalChecks} checks`);
    console.log(`✓ Passed: ${totalPassed}`);
    console.log(`✗ Failed: ${totalFailed}`);

    if (totalFailed === 0) {
        console.log('\n✅ All checks passed! Production deployment is properly configured.');
        console.log('\n💡 Next: Test credentials with `yarn verify-credentials`');
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
