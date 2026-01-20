#!/usr/bin/env tsx
/**
 * Setup GitHub Secrets and Variables from .env.local (or .env)
 *
 * Configures GitHub repository secrets and variables needed for workflows:
 *
 * Secrets:
 * - TELEGRAM_BOT_TOKEN: For Telegram notifications
 * - TELEGRAM_CHAT_ID: Chat ID to receive notifications (from LOCAL_TELEGRAM_CHAT_ID in env)
 * - PROJECT_TOKEN: For GitHub Projects V2 access (from GITHUB_TOKEN in env)
 *
 * Variables:
 * - TELEGRAM_NOTIFICATIONS_ENABLED: Set to 'true' to enable GitHub Actions notifications
 *
 * Usage:
 *   yarn setup-github-secrets
 *
 * Prerequisites:
 *   - GitHub CLI (gh) installed and authenticated
 *   - .env.local (or .env) file with TELEGRAM_BOT_TOKEN, LOCAL_TELEGRAM_CHAT_ID, and GITHUB_TOKEN
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Check for .env.local first (Next.js convention), then fall back to .env
const ENV_FILE = existsSync(resolve(process.cwd(), '.env.local'))
    ? resolve(process.cwd(), '.env.local')
    : resolve(process.cwd(), '.env');

// Secrets (sensitive values)
const REQUIRED_SECRETS = [
    { envKey: 'TELEGRAM_BOT_TOKEN', githubKey: 'TELEGRAM_BOT_TOKEN', description: 'Telegram Bot Token' },
    { envKey: 'LOCAL_TELEGRAM_CHAT_ID', githubKey: 'TELEGRAM_CHAT_ID', description: 'Telegram Chat ID' },
    { envKey: 'GITHUB_TOKEN', githubKey: 'PROJECT_TOKEN', description: 'GitHub PAT for Projects V2 access' },
];

// Variables (non-sensitive configuration)
const REQUIRED_VARIABLES = [
    { githubKey: 'TELEGRAM_NOTIFICATIONS_ENABLED', value: 'true', description: 'Enable Telegram notifications' },
];

function parseEnvFile(filePath: string): Record<string, string> {
    if (!existsSync(filePath)) {
        console.error(`❌ Environment file not found at ${filePath}`);
        console.error('   Expected .env.local or .env file.');
        console.error('   Copy .env.example to .env.local and fill in your values.');
        process.exit(1);
    }

    const content = readFileSync(filePath, 'utf-8');
    const env: Record<string, string> = {};

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // Remove surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            env[key] = value;
        }
    }

    return env;
}

function checkGhCli(): boolean {
    try {
        execSync('gh --version', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function checkGhAuth(): boolean {
    try {
        execSync('gh auth status', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function setGitHubSecret(key: string, value: string): boolean {
    try {
        execSync(`gh secret set ${key} --body "${value}"`, { stdio: 'inherit' });
        return true;
    } catch {
        return false;
    }
}

function setGitHubVariable(key: string, value: string): boolean {
    try {
        execSync(`gh variable set ${key} --body "${value}"`, { stdio: 'inherit' });
        return true;
    } catch {
        return false;
    }
}

function getRepoInfo(): string | null {
    try {
        const result = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', { encoding: 'utf-8' });
        return result.trim();
    } catch {
        return null;
    }
}

async function main() {
    console.log('🔧 GitHub Secrets Setup\n');

    // Check prerequisites
    if (!checkGhCli()) {
        console.error('❌ GitHub CLI (gh) is not installed.');
        console.error('   Install it from: https://cli.github.com/');
        process.exit(1);
    }

    if (!checkGhAuth()) {
        console.error('❌ GitHub CLI is not authenticated.');
        console.error('   Run: gh auth login');
        process.exit(1);
    }

    const repo = getRepoInfo();
    if (!repo) {
        console.error('❌ Could not detect GitHub repository.');
        console.error('   Make sure you are in a git repository with a GitHub remote.');
        process.exit(1);
    }

    console.log(`📦 Repository: ${repo}\n`);

    // Parse .env file
    const env = parseEnvFile(ENV_FILE);

    // Check for missing secrets
    const missing: string[] = [];
    for (const secret of REQUIRED_SECRETS) {
        if (!env[secret.envKey]) {
            missing.push(`${secret.envKey} (${secret.description})`);
        }
    }

    if (missing.length > 0) {
        const envFileName = ENV_FILE.endsWith('.env.local') ? '.env.local' : '.env';
        console.error(`❌ Missing required environment variables in ${envFileName}:`);
        for (const m of missing) {
            console.error(`   - ${m}`);
        }
        console.error(`\nAdd these to your ${envFileName} file and try again.`);
        process.exit(1);
    }

    // Set secrets
    console.log('Setting GitHub secrets...\n');

    let secretsSuccess = 0;
    let secretsFailed = 0;

    for (const secret of REQUIRED_SECRETS) {
        const value = env[secret.envKey];
        process.stdout.write(`  ${secret.githubKey}... `);

        if (setGitHubSecret(secret.githubKey, value)) {
            console.log('✓');
            secretsSuccess++;
        } else {
            console.log('✗');
            secretsFailed++;
        }
    }

    // Set variables
    console.log('\nSetting GitHub variables...\n');

    let varsSuccess = 0;
    let varsFailed = 0;

    for (const variable of REQUIRED_VARIABLES) {
        process.stdout.write(`  ${variable.githubKey}=${variable.value}... `);

        if (setGitHubVariable(variable.githubKey, variable.value)) {
            console.log('✓');
            varsSuccess++;
        } else {
            console.log('✗');
            varsFailed++;
        }
    }

    const totalSuccess = secretsSuccess + varsSuccess;
    const totalFailed = secretsFailed + varsFailed;

    console.log(`\n✅ Done! ${totalSuccess} items configured${totalFailed > 0 ? `, ${totalFailed} failed` : ''}.`);
    console.log(`   - ${secretsSuccess} secrets`);
    console.log(`   - ${varsSuccess} variables`);

    if (totalFailed === 0) {
        console.log('\nYour GitHub workflows are now configured for:');
        console.log('   - Telegram notifications');
        console.log('   - GitHub Projects V2 integration');
    }
}

main().catch(console.error);
