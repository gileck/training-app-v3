#!/usr/bin/env tsx
/**
 * Setup GitHub Secrets and Variables from .env.local (or .env)
 *
 * Configures GitHub repository secrets and variables needed for workflows:
 *
 * Secrets:
 * - TELEGRAM_BOT_TOKEN: For Telegram notifications
 * - TELEGRAM_CHAT_ID: Chat ID to receive notifications (from LOCAL_TELEGRAM_CHAT_ID in env)
 * - PROJECT_TOKEN: Bot account token for GitHub Actions (from GITHUB_BOT_TOKEN in env, fallback to GITHUB_TOKEN)
 *
 * Variables:
 * - TELEGRAM_NOTIFICATIONS_ENABLED: Set to 'true' to enable GitHub Actions notifications
 * - PROJECT_OWNER: GitHub username or organization (from GITHUB_OWNER in env)
 * - PROJECT_REPO: Repository name (from GITHUB_REPO in env)
 * - PROJECT_NUMBER: GitHub Project number (from GITHUB_PROJECT_NUMBER in env)
 * - PROJECT_OWNER_TYPE: 'user' or 'organization' (from GITHUB_OWNER_TYPE in env)
 *
 * Usage:
 *   yarn setup-github-secrets
 *
 * Prerequisites:
 *   - GitHub CLI (gh) installed and authenticated
 *   - .env.local (or .env) file with required environment variables
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
    // GitHub Actions needs GITHUB_TOKEN (admin token) for project access
    // GITHUB_BOT_TOKEN doesn't have project:read scope - only use admin token
    // Note: Workflow uses PROJECT_TOKEN secret name
    { envKey: 'GITHUB_TOKEN', githubKey: 'PROJECT_TOKEN', description: 'Admin token for GitHub Actions (needs project access)' },
];

// Variables (non-sensitive configuration)
// Some have static values, others are read from env file
const STATIC_VARIABLES = [
    { githubKey: 'TELEGRAM_NOTIFICATIONS_ENABLED', value: 'true', description: 'Enable Telegram notifications' },
];

// Variables that map from .env.local to GitHub Actions variables
// Note: GitHub Actions uses PROJECT_* prefix, .env.local uses GITHUB_* prefix
const ENV_BASED_VARIABLES = [
    { envKey: 'GITHUB_OWNER', githubKey: 'PROJECT_OWNER', description: 'GitHub username or organization' },
    { envKey: 'GITHUB_REPO', githubKey: 'PROJECT_REPO', description: 'Repository name' },
    { envKey: 'GITHUB_PROJECT_NUMBER', githubKey: 'PROJECT_NUMBER', description: 'GitHub Project number' },
    { envKey: 'GITHUB_OWNER_TYPE', githubKey: 'PROJECT_OWNER_TYPE', description: 'Owner type (user or organization)' },
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
        // Use stdin to avoid shell interpolation issues with special characters/newlines
        // Trim the value to remove any accidental trailing whitespace/newlines
        const trimmedValue = value.trim();
        execSync(`gh secret set ${key}`, {
            input: trimmedValue,
            stdio: ['pipe', 'inherit', 'inherit'],
        });
        return true;
    } catch {
        return false;
    }
}

function setGitHubVariable(key: string, value: string): boolean {
    try {
        // Use stdin to avoid shell interpolation issues with special characters
        // Trim the value to remove any accidental trailing whitespace/newlines
        const trimmedValue = value.trim();
        execSync(`gh variable set ${key}`, {
            input: trimmedValue,
            stdio: ['pipe', 'inherit', 'inherit'],
        });
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
        // Check primary key, or fallback key if provided
        const hasPrimary = env[secret.envKey];
        const hasFallback = 'fallbackKey' in secret && env[secret.fallbackKey as string];

        if (!hasPrimary && !hasFallback) {
            const keys = 'fallbackKey' in secret
                ? `${secret.envKey} or ${secret.fallbackKey}`
                : secret.envKey;
            missing.push(`${keys} (${secret.description})`);
        }
    }

    // Check for missing env-based variables (required for GitHub Projects integration)
    for (const variable of ENV_BASED_VARIABLES) {
        if (!env[variable.envKey]) {
            missing.push(`${variable.envKey} (${variable.description})`);
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
        // Use primary key if available, otherwise fallback
        const value = env[secret.envKey] || ('fallbackKey' in secret ? env[secret.fallbackKey as string] : '');
        const source = env[secret.envKey] ? secret.envKey : ('fallbackKey' in secret ? secret.fallbackKey : secret.envKey);

        process.stdout.write(`  ${secret.githubKey} (from ${source})... `);

        if (setGitHubSecret(secret.githubKey, value!)) {
            console.log('✓');
            secretsSuccess++;
        } else {
            console.log('✗');
            secretsFailed++;
        }
    }

    // Set static variables
    console.log('\nSetting GitHub variables...\n');

    let varsSuccess = 0;
    let varsFailed = 0;

    for (const variable of STATIC_VARIABLES) {
        process.stdout.write(`  ${variable.githubKey}=${variable.value}... `);

        if (setGitHubVariable(variable.githubKey, variable.value)) {
            console.log('✓');
            varsSuccess++;
        } else {
            console.log('✗');
            varsFailed++;
        }
    }

    // Set env-based variables (read from .env.local)
    for (const variable of ENV_BASED_VARIABLES) {
        const value = env[variable.envKey];
        if (!value) {
            console.log(`  ${variable.githubKey} (from ${variable.envKey})... ⚠ skipped (not in env)`);
            continue;
        }

        process.stdout.write(`  ${variable.githubKey}=${value} (from ${variable.envKey})... `);

        if (setGitHubVariable(variable.githubKey, value)) {
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
        console.log('   - Project automation (on-pr-merged workflow)');
    }
}

main().catch(console.error);
