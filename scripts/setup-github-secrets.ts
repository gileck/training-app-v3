#!/usr/bin/env tsx
/**
 * Setup GitHub Secrets from .env
 *
 * Configures GitHub repository secrets needed for workflows:
 * - TELEGRAM_BOT_TOKEN: For Telegram notifications
 * - LOCAL_TELEGRAM_CHAT_ID: Chat ID to receive notifications (from LOCAL_TELEGRAM_CHAT_ID in .env)
 *
 * Usage:
 *   yarn setup-github-secrets
 *
 * Prerequisites:
 *   - GitHub CLI (gh) installed and authenticated
 *   - .env file with TELEGRAM_BOT_TOKEN and LOCAL_TELEGRAM_CHAT_ID
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ENV_FILE = resolve(process.cwd(), '.env');

const REQUIRED_SECRETS = [
    { envKey: 'TELEGRAM_BOT_TOKEN', githubKey: 'TELEGRAM_BOT_TOKEN', description: 'Telegram Bot Token' },
    { envKey: 'LOCAL_TELEGRAM_CHAT_ID', githubKey: 'LOCAL_TELEGRAM_CHAT_ID', description: 'Owner Telegram Chat ID' },
];

function parseEnvFile(filePath: string): Record<string, string> {
    if (!existsSync(filePath)) {
        console.error(`❌ .env file not found at ${filePath}`);
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
        console.error('❌ Missing required environment variables in .env:');
        for (const m of missing) {
            console.error(`   - ${m}`);
        }
        console.error('\nAdd these to your .env file and try again.');
        process.exit(1);
    }

    // Set secrets
    console.log('Setting GitHub secrets...\n');

    let success = 0;
    let failed = 0;

    for (const secret of REQUIRED_SECRETS) {
        const value = env[secret.envKey];
        process.stdout.write(`  ${secret.githubKey}... `);

        if (setGitHubSecret(secret.githubKey, value)) {
            console.log('✓');
            success++;
        } else {
            console.log('✗');
            failed++;
        }
    }

    console.log(`\n✅ Done! ${success} secrets configured${failed > 0 ? `, ${failed} failed` : ''}.`);

    if (failed === 0) {
        console.log('\nYour GitHub workflows are now configured to send Telegram notifications.');
    }
}

main().catch(console.error);
