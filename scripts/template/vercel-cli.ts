#!/usr/bin/env npx tsx
import '../../src/agents/shared/loadEnv';

/**
 * Vercel CLI Tool
 *
 * A CLI tool for interacting with Vercel deployments and projects.
 * Uses the Vercel API directly to avoid issues with the native CLI
 * (e.g., trailing newlines when piping to `vercel env add`).
 *
 * Usage:
 *   yarn vercel-cli <command> [options]
 *
 * Commands:
 *   list        List recent deployments
 *   info        Get deployment details
 *   logs        Get build logs for a deployment
 *   env         List environment variables
 *   env:set     Set a single environment variable
 *   env:push    Push env vars from .env file to Vercel
 *   env:sync    Sync all env vars from .env.local (recommended)
 *   project     Show current project info
 *
 * Environment Variable Commands:
 *   env:sync is the recommended way to sync env vars. It:
 *   - Uses the Vercel API directly (no trailing newline issues)
 *   - Sends most vars to all environments (production, preview, development)
 *   - Sends PREVIEW_USER_ID to preview environment only
 *   - Excludes local-only vars (TEST_*, IGNORE_*, VERCEL_OIDC_TOKEN)
 *
 * Examples:
 *   yarn vercel-cli list --target production
 *   yarn vercel-cli info --deployment dpl_xxx
 *   yarn vercel-cli logs --deployment dpl_xxx
 *   yarn vercel-cli env --target production
 *   yarn vercel-cli env:set --name MY_VAR --value "my value" --target production,preview
 *   yarn vercel-cli env:sync                    # Sync .env.local to Vercel
 *   yarn vercel-cli env:sync --dry-run          # Preview what would be synced
 *   yarn vercel-cli project
 */

import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Type Definitions
// ============================================================================

interface VercelProjectConfig {
    projectId: string;
    orgId: string;
}

interface Config {
    token: string;
    projectId: string;
    orgId?: string;
    teamId?: string;
}

type DeploymentState = 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
type DeploymentTarget = 'production' | 'preview';

interface VercelDeployment {
    uid: string;
    name: string;
    url: string | null;
    state: DeploymentState;
    target: DeploymentTarget | null;
    created: number;
    createdAt: number;
    buildingAt?: number;
    ready?: number;
    creator?: {
        uid: string;
        email: string;
        username: string;
    };
    meta?: {
        githubCommitRef?: string;
        githubCommitSha?: string;
        githubCommitMessage?: string;
        githubCommitAuthorName?: string;
        githubPrId?: string;
    };
    inspectorUrl?: string;
    source?: string;
}

interface DeploymentsListResponse {
    deployments: VercelDeployment[];
    pagination?: {
        count: number;
        next?: number;
        prev?: number;
    };
}

interface DeploymentDetail extends VercelDeployment {
    alias?: string[];
    aliasAssigned?: number;
    aliasError?: { code: string; message: string };
    routes?: Array<{ src: string; dest: string }>;
    functions?: Record<string, { memory: number; maxDuration: number }>;
    regions?: string[];
    errorCode?: string;
    errorMessage?: string;
    errorStep?: string;
}

interface BuildLogEvent {
    type: 'stdout' | 'stderr' | 'command' | 'exit' | 'delimiter';
    created: number;
    payload: {
        text?: string;
        deploymentId?: string;
        info?: {
            type: string;
            name: string;
        };
    };
}

interface VercelEnvVar {
    id: string;
    key: string;
    value: string;
    type: 'plain' | 'secret' | 'encrypted' | 'sensitive';
    target: Array<'production' | 'preview' | 'development'>;
    gitBranch?: string;
    configurationId?: string;
    createdAt: number;
    updatedAt: number;
}

interface EnvVarsListResponse {
    envs: VercelEnvVar[];
    pagination?: {
        count: number;
        next?: number;
    };
}

interface VercelProject {
    id: string;
    name: string;
    accountId: string;
    framework?: string;
    nodeVersion?: string;
    buildCommand?: string;
    devCommand?: string;
    outputDirectory?: string;
    rootDirectory?: string;
    directoryListing: boolean;
    createdAt: number;
    updatedAt: number;
    latestDeployments?: VercelDeployment[];
    targets?: {
        production?: VercelDeployment;
    };
    link?: {
        type: 'github' | 'gitlab' | 'bitbucket';
        repo: string;
        repoId: number;
        org?: string;
        gitCredentialId?: string;
        productionBranch?: string;
    };
}

interface VercelApiError {
    error: {
        code: string;
        message: string;
    };
}

// ============================================================================
// Cloud Proxy Support
// ============================================================================

function setupCloudProxy(): void {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxyUrl) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ProxyAgent, setGlobalDispatcher } = require('undici');
        setGlobalDispatcher(new ProxyAgent(proxyUrl));
        console.log('☁️  Cloud proxy enabled');
    }
}

// ============================================================================
// Configuration
// ============================================================================

const VERCEL_PROJECT_JSON = resolve(process.cwd(), '.vercel/project.json');

function getProjectConfig(): VercelProjectConfig | null {
    if (!existsSync(VERCEL_PROJECT_JSON)) {
        return null;
    }

    try {
        const content = readFileSync(VERCEL_PROJECT_JSON, 'utf-8');
        const config = JSON.parse(content) as VercelProjectConfig;

        if (!config.projectId || !config.orgId) {
            return null;
        }

        return config;
    } catch {
        return null;
    }
}

function getConfig(options: { cloudProxy?: boolean; projectId?: string; teamId?: string }): Config {
    let token = process.env.VERCEL_TOKEN;

    // Cloud environments may add literal quotes around env values
    if (options.cloudProxy && token) {
        token = token.replace(/^["']|["']$/g, '');
    }

    if (!token) {
        console.error('Error: VERCEL_TOKEN environment variable is required');
        console.error('Get your token from: https://vercel.com/account/tokens');
        console.error('Set it with: VERCEL_TOKEN=your_token in .env');
        process.exit(1);
    }

    // Get project config from .vercel/project.json or CLI options
    let projectId = options.projectId;
    let orgId = options.teamId;

    if (!projectId) {
        // CRITICAL: Check if .vercel/project.json exists
        if (!existsSync(VERCEL_PROJECT_JSON)) {
            console.error('');
            console.error('❌ Error: .vercel/project.json not found');
            console.error('');
            console.error('⚠️  CRITICAL: This project is not linked to a Vercel project.');
            console.error('');
            console.error('Why this matters:');
            console.error('  • Without this file, commands may target the WRONG Vercel project');
            console.error('  • This can overwrite another project\'s environment variables');
            console.error('  • This is a common cause of production issues');
            console.error('');
            console.error('Fix:');
            console.error('  1. Run: vercel link');
            console.error('  2. Select your Vercel project when prompted');
            console.error('  3. Verify: ls .vercel/project.json');
            console.error('');
            console.error('Alternatively, use --project-id flag:');
            console.error('  yarn vercel-cli <command> --project-id prj_xxxxx');
            console.error('');
            process.exit(1);
        }

        const projectConfig = getProjectConfig();
        if (projectConfig) {
            projectId = projectConfig.projectId;
            orgId = orgId || projectConfig.orgId;
            console.log('📁 Using project from .vercel/project.json');
        }
    }

    if (!projectId) {
        console.error('Error: Could not determine project ID');
        console.error('Either:');
        console.error('  1. Run `vercel link` to create .vercel/project.json');
        console.error('  2. Use --project-id option');
        process.exit(1);
    }

    return {
        token,
        projectId,
        orgId,
        teamId: options.teamId || orgId,
    };
}

// ============================================================================
// API Helper
// ============================================================================

class VercelError extends Error {
    constructor(
        public code: string,
        message: string,
        public status?: number
    ) {
        super(message);
        this.name = 'VercelError';
    }
}

async function vercelFetch<T>(
    endpoint: string,
    token: string,
    options: { teamId?: string; method?: string; body?: unknown } = {}
): Promise<T> {
    const baseUrl = 'https://api.vercel.com';
    const url = new URL(endpoint, baseUrl);

    // Add team/org ID if provided
    if (options.teamId) {
        url.searchParams.set('teamId', options.teamId);
    }

    const response = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json() as T | VercelApiError;

    if (!response.ok) {
        const error = data as VercelApiError;
        throw new VercelError(
            error.error?.code || 'UNKNOWN',
            error.error?.message || `HTTP ${response.status}`,
            response.status
        );
    }

    return data as T;
}

function handleError(error: unknown): never {
    if (error instanceof VercelError) {
        console.error(`\n❌ Vercel API Error: ${error.message}`);

        switch (error.code) {
            case 'forbidden':
                console.error('   Your token may not have access to this resource.');
                console.error('   Check token scopes at: https://vercel.com/account/tokens');
                break;
            case 'not_found':
                console.error('   The requested resource was not found.');
                console.error('   Verify the deployment ID or project ID.');
                break;
            case 'invalid_token':
                console.error('   Your VERCEL_TOKEN is invalid or expired.');
                console.error('   Generate a new token at: https://vercel.com/account/tokens');
                break;
            case 'rate_limited':
                console.error('   You have been rate limited. Wait a moment and try again.');
                break;
        }
    } else if (error instanceof Error) {
        console.error(`\n❌ Error: ${error.message}`);
    } else {
        console.error('\n❌ An unexpected error occurred');
    }

    process.exit(1);
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatState(state: DeploymentState): string {
    const stateMap: Record<DeploymentState, string> = {
        READY: '✓ Ready',
        BUILDING: '⏳ Building',
        QUEUED: '⏳ Queued',
        INITIALIZING: '⏳ Initializing',
        ERROR: '✗ Error',
        CANCELED: '⊘ Canceled',
    };
    return stateMap[state] || state;
}

function formatTarget(target: DeploymentTarget | null): string {
    if (target === 'production') return '🚀 Production';
    if (target === 'preview') return '👁 Preview';
    return '—';
}

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
}

function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
}

function printDeploymentsList(deployments: VercelDeployment[]): void {
    if (deployments.length === 0) {
        console.log('No deployments found.');
        return;
    }

    console.log('\n📋 Deployments');
    console.log('═'.repeat(80));

    for (const d of deployments) {
        const state = formatState(d.state);
        const target = d.target === 'production' ? '🚀' : '👁';
        const time = formatRelativeTime(d.created);
        const commit = d.meta?.githubCommitMessage?.slice(0, 40) || '—';

        console.log(`${target} ${d.uid}`);
        console.log(`   State: ${state}  |  ${time}  |  ${commit}`);
        if (d.url) {
            console.log(`   URL: https://${d.url}`);
        }
    }
    console.log('');
}

function printDeploymentDetail(d: DeploymentDetail): void {
    // Handle different API response formats (v6 uses uid/state/created, v13 uses id/status/createdAt)
    const deployment = d as DeploymentDetail & { id?: string; status?: DeploymentState };
    const id = d.uid || deployment.id || 'unknown';
    const state = d.state || deployment.status;
    const created = d.created || d.createdAt;

    console.log('\n📋 Deployment Details');
    console.log('═'.repeat(60));
    console.log(`ID:        ${id}`);
    if (d.url) {
        console.log(`URL:       https://${d.url}`);
    }
    console.log(`State:     ${state ? formatState(state) : 'unknown'}`);
    console.log(`Target:    ${formatTarget(d.target)}`);
    console.log(`Created:   ${created ? formatDate(created) : 'unknown'}`);

    if (d.ready) {
        console.log(`Ready:     ${formatDate(d.ready)}`);
    }

    if (d.creator) {
        console.log(`Creator:   ${d.creator.username} (${d.creator.email})`);
    }

    if (d.meta?.githubCommitRef) {
        console.log('\n📝 Git Info');
        console.log('─'.repeat(60));
        console.log(`Branch:    ${d.meta.githubCommitRef}`);
        if (d.meta.githubCommitSha) {
            console.log(`Commit:    ${d.meta.githubCommitSha.slice(0, 7)}`);
        }
        if (d.meta.githubCommitMessage) {
            console.log(`Message:   ${d.meta.githubCommitMessage}`);
        }
        if (d.meta.githubCommitAuthorName) {
            console.log(`Author:    ${d.meta.githubCommitAuthorName}`);
        }
        if (d.meta.githubPrId) {
            console.log(`PR:        #${d.meta.githubPrId}`);
        }
    }

    if (d.alias && d.alias.length > 0) {
        console.log('\n🔗 Aliases');
        console.log('─'.repeat(60));
        for (const alias of d.alias) {
            console.log(`  https://${alias}`);
        }
    }

    if (d.inspectorUrl) {
        console.log(`\n🔍 Inspector: ${d.inspectorUrl}`);
    }

    if (d.errorMessage) {
        console.log('\n❌ Error');
        console.log('─'.repeat(60));
        console.log(`Code:      ${d.errorCode || 'unknown'}`);
        console.log(`Step:      ${d.errorStep || 'unknown'}`);
        console.log(`Message:   ${d.errorMessage}`);
    }

    console.log('');
}

function printEnvVars(envs: VercelEnvVar[]): void {
    if (envs.length === 0) {
        console.log('No environment variables found.');
        return;
    }

    console.log('\n🔐 Environment Variables');
    console.log('═'.repeat(70));

    // Group by target
    const grouped = {
        production: envs.filter(e => e.target.includes('production')),
        preview: envs.filter(e => e.target.includes('preview')),
        development: envs.filter(e => e.target.includes('development')),
    };

    for (const [target, vars] of Object.entries(grouped)) {
        if (vars.length === 0) continue;

        console.log(`\n${target.toUpperCase()}:`);
        console.log('─'.repeat(70));

        for (const env of vars) {
            const typeIcon = env.type === 'secret' ? '🔒' : env.type === 'sensitive' ? '🔐' : '📝';
            const value = env.type === 'plain' ? env.value : '[hidden]';
            const displayValue = value.length > 30 ? value.slice(0, 30) + '...' : value;
            console.log(`${typeIcon} ${env.key.padEnd(30)} = ${displayValue}`);
        }
    }
    console.log('');
}

function printProjectInfo(project: VercelProject): void {
    console.log('\n📦 Project Information');
    console.log('═'.repeat(60));
    console.log(`Name:       ${project.name}`);
    console.log(`ID:         ${project.id}`);
    console.log(`Framework:  ${project.framework || 'auto-detected'}`);
    console.log(`Node:       ${project.nodeVersion || 'default'}`);
    console.log(`Created:    ${formatDate(project.createdAt)}`);
    console.log(`Updated:    ${formatDate(project.updatedAt)}`);

    if (project.buildCommand) {
        console.log('\n🔧 Build Settings');
        console.log('─'.repeat(60));
        console.log(`Build:      ${project.buildCommand}`);
        if (project.outputDirectory) {
            console.log(`Output:     ${project.outputDirectory}`);
        }
        if (project.rootDirectory) {
            console.log(`Root:       ${project.rootDirectory}`);
        }
    }

    if (project.link) {
        console.log('\n🔗 Git Repository');
        console.log('─'.repeat(60));
        console.log(`Type:       ${project.link.type}`);
        console.log(`Repo:       ${project.link.org}/${project.link.repo}`);
        if (project.link.productionBranch) {
            console.log(`Prod Branch: ${project.link.productionBranch}`);
        }
    }

    if (project.targets?.production) {
        console.log('\n🚀 Latest Production');
        console.log('─'.repeat(60));
        const prod = project.targets.production;
        if (prod.url) {
            console.log(`URL:        https://${prod.url}`);
        }
        console.log(`State:      ${formatState(prod.state)}`);
        console.log(`Deployed:   ${formatRelativeTime(prod.created)}`);
    }

    console.log('');
}

function printBuildLogs(events: BuildLogEvent[]): void {
    console.log('\n📜 Build Logs');
    console.log('═'.repeat(70));

    if (!events || events.length === 0) {
        console.log('No build logs available.');
        console.log('');
        return;
    }

    for (const event of events) {
        const text = event.payload?.text || (event as { text?: string }).text;
        if (!text) continue;

        if (event.type === 'stdout') {
            console.log(text);
        } else if (event.type === 'stderr') {
            console.log(`[stderr] ${text}`);
        } else if (event.type === 'command') {
            console.log(`$ ${text}`);
        } else {
            // Handle other event types that have text
            console.log(text);
        }
    }
    console.log('');
}

// ============================================================================
// API Functions
// ============================================================================

async function listDeployments(
    config: Config,
    options: { limit?: number; target?: DeploymentTarget; state?: DeploymentState }
): Promise<void> {
    const params = new URLSearchParams();
    params.set('projectId', config.projectId);
    params.set('limit', String(options.limit || 20));

    if (options.target) {
        params.set('target', options.target);
    }
    if (options.state) {
        params.set('state', options.state);
    }

    const response = await vercelFetch<DeploymentsListResponse>(
        `/v6/deployments?${params.toString()}`,
        config.token,
        { teamId: config.teamId }
    );

    printDeploymentsList(response.deployments);
}

async function getDeploymentInfo(config: Config, deploymentId: string): Promise<void> {
    const response = await vercelFetch<DeploymentDetail>(
        `/v13/deployments/${deploymentId}`,
        config.token,
        { teamId: config.teamId }
    );

    printDeploymentDetail(response);
}

async function getDeploymentLogs(
    config: Config,
    deploymentId: string,
    options: { limit?: number }
): Promise<void> {
    const response = await vercelFetch<BuildLogEvent[]>(
        `/v3/deployments/${deploymentId}/events`,
        config.token,
        { teamId: config.teamId }
    );

    const events = options.limit ? response.slice(-options.limit) : response;
    printBuildLogs(events);
}

async function listEnvVars(
    config: Config,
    options: { target?: 'production' | 'preview' | 'development'; decrypt?: boolean }
): Promise<void> {
    const params = new URLSearchParams();
    if (options.decrypt) {
        params.set('decrypt', 'true');
    }

    const queryString = params.toString();
    const endpoint = `/v9/projects/${config.projectId}/env${queryString ? '?' + queryString : ''}`;
    const response = await vercelFetch<EnvVarsListResponse>(
        endpoint,
        config.token,
        { teamId: config.teamId }
    );

    // Handle both array response and object with envs property
    let envs: VercelEnvVar[] = Array.isArray(response) ? response : (response.envs || []);
    if (options.target) {
        envs = envs.filter(e => e.target?.includes(options.target!));
    }

    printEnvVars(envs);
}

async function pushEnvVars(
    config: Config,
    options: {
        target: Array<'production' | 'preview' | 'development'>;
        envFile: string;
        overwrite: boolean;
    }
): Promise<void> {
    // Read .env file
    if (!existsSync(options.envFile)) {
        throw new Error(`Environment file not found: ${options.envFile}`);
    }

    const envContent = readFileSync(options.envFile, 'utf-8');
    const envVars: Array<{ key: string; value: string }> = [];

    // Parse .env file
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (key) {
            envVars.push({ key, value });
        }
    }

    if (envVars.length === 0) {
        console.log('No environment variables found in file.');
        return;
    }

    console.log(`\n📤 Pushing ${envVars.length} environment variable(s) to Vercel`);
    console.log(`   Target: ${options.target.join(', ')}`);
    console.log('═'.repeat(60));

    // Get existing env vars to check for conflicts
    const existingResponse = await vercelFetch<EnvVarsListResponse>(
        `/v9/projects/${config.projectId}/env`,
        config.token,
        { teamId: config.teamId }
    );
    const existingEnvs: VercelEnvVar[] = Array.isArray(existingResponse)
        ? existingResponse
        : (existingResponse.envs || []);
    const existingKeys = new Set(existingEnvs.map(e => e.key));

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const { key, value } of envVars) {
        const exists = existingKeys.has(key);

        if (exists && !options.overwrite) {
            console.log(`⏭️  ${key} (already exists, skipping)`);
            skipped++;
            continue;
        }

        try {
            if (exists && options.overwrite) {
                // Find the existing env var to get its ID
                const existing = existingEnvs.find(e => e.key === key);
                if (existing) {
                    // Delete existing first, then create new
                    await vercelFetch(
                        `/v9/projects/${config.projectId}/env/${existing.id}`,
                        config.token,
                        { teamId: config.teamId, method: 'DELETE' }
                    );
                }
            }

            // Create new env var
            await vercelFetch(
                `/v10/projects/${config.projectId}/env`,
                config.token,
                {
                    teamId: config.teamId,
                    method: 'POST',
                    body: {
                        key,
                        value,
                        target: options.target,
                        type: 'encrypted',
                    }
                }
            );

            if (exists) {
                console.log(`✏️  ${key} (updated)`);
                updated++;
            } else {
                console.log(`✅ ${key} (created)`);
                created++;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.log(`❌ ${key} (failed: ${message})`);
        }
    }

    console.log('─'.repeat(60));
    console.log(`Created: ${created} | Updated: ${updated} | Skipped: ${skipped}`);
    console.log('');
}

async function getProjectInfo(config: Config): Promise<void> {
    const response = await vercelFetch<VercelProject>(
        `/v9/projects/${config.projectId}`,
        config.token,
        { teamId: config.teamId }
    );

    printProjectInfo(response);
}

/**
 * Set a single environment variable via the Vercel API.
 * This avoids the trailing newline issue that occurs when piping to `vercel env add`.
 */
async function setEnvVar(
    config: Config,
    options: {
        key: string;
        value: string;
        targets: Array<'production' | 'preview' | 'development'>;
    }
): Promise<void> {
    console.log(`\n🔐 Setting ${options.key}`);
    console.log(`   Targets: ${options.targets.join(', ')}`);
    console.log('═'.repeat(60));

    // Get existing env vars to check if we need to delete first
    const existingResponse = await vercelFetch<EnvVarsListResponse>(
        `/v9/projects/${config.projectId}/env`,
        config.token,
        { teamId: config.teamId }
    );
    const existingEnvs: VercelEnvVar[] = Array.isArray(existingResponse)
        ? existingResponse
        : (existingResponse.envs || []);

    // Find and delete existing entries for this key
    const existingForKey = existingEnvs.filter(e => e.key === options.key);
    for (const existing of existingForKey) {
        console.log(`   Removing existing entry (targets: ${existing.target.join(', ')})...`);
        await vercelFetch(
            `/v9/projects/${config.projectId}/env/${existing.id}`,
            config.token,
            { teamId: config.teamId, method: 'DELETE' }
        );
    }

    // Create new env var with specified targets
    await vercelFetch(
        `/v10/projects/${config.projectId}/env`,
        config.token,
        {
            teamId: config.teamId,
            method: 'POST',
            body: {
                key: options.key,
                value: options.value,
                target: options.targets,
                type: 'encrypted',
            }
        }
    );

    console.log(`✅ ${options.key} set successfully`);
    console.log('');
}

/**
 * Sync all environment variables from .env.local to Vercel.
 * - Most variables go to all environments (production, preview, development)
 * - PREVIEW_USER_ID goes to preview only
 *
 * This uses the Vercel API directly to avoid trailing newline issues
 * that occur when piping through `echo` to `vercel env add`.
 */
async function syncEnvVars(
    config: Config,
    options: {
        envFile: string;
        dryRun: boolean;
    }
): Promise<void> {
    // Variables that should only go to preview environment
    const PREVIEW_ONLY_VARS = ['PREVIEW_USER_ID'];

    // Variables that should be excluded from sync (local-only)
    const EXCLUDED_VARS = [
        'VERCEL_OIDC_TOKEN',  // Auto-generated by Vercel
        'TEST_USER_NAME',     // Local testing only
        'TEST_PASSWORD',      // Local testing only
        'IGNORE_LOCAL_USER_ID', // Local development flag
    ];

    // Read .env file
    if (!existsSync(options.envFile)) {
        throw new Error(`Environment file not found: ${options.envFile}`);
    }

    const envContent = readFileSync(options.envFile, 'utf-8');
    const envVars: Array<{ key: string; value: string }> = [];

    // Parse .env file
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (key && !EXCLUDED_VARS.includes(key)) {
            envVars.push({ key, value });
        }
    }

    if (envVars.length === 0) {
        console.log('No environment variables found in file.');
        return;
    }

    console.log(`\n🔄 Syncing ${envVars.length} environment variable(s) to Vercel`);
    console.log(`   Source: ${options.envFile}`);
    if (options.dryRun) {
        console.log('   Mode: DRY RUN (no changes will be made)');
    }
    console.log('═'.repeat(70));

    // Get existing env vars
    const existingResponse = await vercelFetch<EnvVarsListResponse>(
        `/v9/projects/${config.projectId}/env`,
        config.token,
        { teamId: config.teamId }
    );
    const existingEnvs: VercelEnvVar[] = Array.isArray(existingResponse)
        ? existingResponse
        : (existingResponse.envs || []);

    let synced = 0;
    let skipped = 0;

    for (const { key, value } of envVars) {
        const isPreviewOnly = PREVIEW_ONLY_VARS.includes(key);
        const targets: Array<'production' | 'preview' | 'development'> = isPreviewOnly
            ? ['preview']
            : ['production', 'preview', 'development'];

        const targetLabel = isPreviewOnly ? '(preview only)' : '(all environments)';

        if (options.dryRun) {
            console.log(`   Would sync: ${key} ${targetLabel}`);
            synced++;
            continue;
        }

        try {
            // Find and delete existing entries for this key
            const existingForKey = existingEnvs.filter(e => e.key === key);
            for (const existing of existingForKey) {
                await vercelFetch(
                    `/v9/projects/${config.projectId}/env/${existing.id}`,
                    config.token,
                    { teamId: config.teamId, method: 'DELETE' }
                );
            }

            // Create new env var
            await vercelFetch(
                `/v10/projects/${config.projectId}/env`,
                config.token,
                {
                    teamId: config.teamId,
                    method: 'POST',
                    body: {
                        key,
                        value,
                        target: targets,
                        type: 'encrypted',
                    }
                }
            );

            console.log(`✅ ${key} ${targetLabel}`);
            synced++;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.log(`❌ ${key} (failed: ${message})`);
            skipped++;
        }
    }

    console.log('─'.repeat(70));
    console.log(`Synced: ${synced} | Failed: ${skipped}`);
    if (options.dryRun) {
        console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.');
    } else {
        console.log('\n⚠️  Remember to redeploy to pick up the new env vars!');
    }
    console.log('');
}

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
    .name('vercel-cli')
    .description('CLI tool for Vercel deployments and projects')
    .version('1.0.0');

// Global options
program
    .option('--project-id <id>', 'Project ID (auto-detected from .vercel/project.json)')
    .option('--team-id <id>', 'Team/Org ID (auto-detected from .vercel/project.json)')
    .option('--cloud-proxy', 'Enable Claude Code cloud environment support', false);

// List command
program
    .command('list')
    .description('List recent deployments')
    .option('--limit <n>', 'Number of deployments to show', '20')
    .option('--target <target>', 'Filter by target: production, preview')
    .option('--state <state>', 'Filter by state: BUILDING, ERROR, READY, CANCELED, QUEUED')
    .action(async (options) => {
        try {
            const globalOpts = program.opts();
            if (globalOpts.cloudProxy) setupCloudProxy();
            const config = getConfig(globalOpts);

            await listDeployments(config, {
                limit: parseInt(options.limit),
                target: options.target as DeploymentTarget | undefined,
                state: options.state as DeploymentState | undefined,
            });
        } catch (error) {
            handleError(error);
        }
    });

// Info command
program
    .command('info')
    .description('Get deployment details')
    .requiredOption('--deployment <id>', 'Deployment ID')
    .action(async (options) => {
        try {
            const globalOpts = program.opts();
            if (globalOpts.cloudProxy) setupCloudProxy();
            const config = getConfig(globalOpts);

            await getDeploymentInfo(config, options.deployment);
        } catch (error) {
            handleError(error);
        }
    });

// Logs command
program
    .command('logs')
    .description('Get build logs for a deployment')
    .requiredOption('--deployment <id>', 'Deployment ID')
    .option('--limit <n>', 'Number of log lines to show', '100')
    .action(async (options) => {
        try {
            const globalOpts = program.opts();
            if (globalOpts.cloudProxy) setupCloudProxy();
            const config = getConfig(globalOpts);

            await getDeploymentLogs(config, options.deployment, {
                limit: parseInt(options.limit),
            });
        } catch (error) {
            handleError(error);
        }
    });

// Env command
program
    .command('env')
    .description('List environment variables')
    .option('--target <target>', 'Filter by target: production, preview, development')
    .option('--decrypt', 'Show decrypted values (requires permissions)', false)
    .action(async (options) => {
        try {
            const globalOpts = program.opts();
            if (globalOpts.cloudProxy) setupCloudProxy();
            const config = getConfig(globalOpts);

            await listEnvVars(config, {
                target: options.target as 'production' | 'preview' | 'development' | undefined,
                decrypt: options.decrypt,
            });
        } catch (error) {
            handleError(error);
        }
    });

// Env push command
program
    .command('env:push')
    .description('Push environment variables from .env file to Vercel')
    .option('--file <path>', 'Path to .env file', '.env')
    .option('--target <targets>', 'Comma-separated targets: production,preview,development', 'production,preview,development')
    .option('--overwrite', 'Overwrite existing variables', false)
    .action(async (options) => {
        try {
            const globalOpts = program.opts();
            if (globalOpts.cloudProxy) setupCloudProxy();
            const config = getConfig(globalOpts);

            const targets = options.target.split(',').map((t: string) => t.trim()) as Array<'production' | 'preview' | 'development'>;

            await pushEnvVars(config, {
                envFile: options.file,
                target: targets,
                overwrite: options.overwrite,
            });
        } catch (error) {
            handleError(error);
        }
    });

// Env set command - Set a single environment variable
program
    .command('env:set')
    .description('Set a single environment variable (uses API, no trailing newline issues)')
    .requiredOption('--name <name>', 'Environment variable name')
    .option('--value <value>', 'Environment variable value (reads from --file if not provided)')
    .option('--file <path>', 'Path to .env file to read value from', '.env.local')
    .option('--target <targets>', 'Comma-separated targets: production,preview,development', 'production,preview,development')
    .action(async (options) => {
        try {
            const globalOpts = program.opts();
            if (globalOpts.cloudProxy) setupCloudProxy();
            const config = getConfig(globalOpts);

            let value = options.value;

            // If no value provided, read from env file
            if (!value) {
                if (!existsSync(options.file)) {
                    console.error(`❌ No --value provided and env file not found: ${options.file}`);
                    process.exit(1);
                }

                const envContent = readFileSync(options.file, 'utf-8');
                for (const line of envContent.split('\n')) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;

                    const eqIndex = trimmed.indexOf('=');
                    if (eqIndex === -1) continue;

                    const key = trimmed.slice(0, eqIndex).trim();
                    if (key === options.name) {
                        value = trimmed.slice(eqIndex + 1).trim();
                        // Remove surrounding quotes if present
                        if ((value.startsWith('"') && value.endsWith('"')) ||
                            (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1);
                        }
                        break;
                    }
                }

                if (!value) {
                    console.error(`❌ Variable "${options.name}" not found in ${options.file}`);
                    process.exit(1);
                }

                console.log(`📄 Reading ${options.name} from ${options.file}`);
            }

            const targets = options.target.split(',').map((t: string) => t.trim()) as Array<'production' | 'preview' | 'development'>;

            await setEnvVar(config, {
                key: options.name,
                value,
                targets,
            });
        } catch (error) {
            handleError(error);
        }
    });

// Env sync command - Sync all env vars from .env.local to Vercel with proper scopes
program
    .command('env:sync')
    .description('Sync all env vars from .env.local to Vercel (PREVIEW_USER_ID goes to preview only)')
    .option('--file <path>', 'Path to .env file', '.env.local')
    .option('--dry-run', 'Show what would be synced without making changes', false)
    .action(async (options) => {
        try {
            const globalOpts = program.opts();
            if (globalOpts.cloudProxy) setupCloudProxy();
            const config = getConfig(globalOpts);

            await syncEnvVars(config, {
                envFile: options.file,
                dryRun: options.dryRun,
            });
        } catch (error) {
            handleError(error);
        }
    });

// Project command
program
    .command('project')
    .description('Show current project info')
    .action(async () => {
        try {
            const globalOpts = program.opts();
            if (globalOpts.cloudProxy) setupCloudProxy();
            const config = getConfig(globalOpts);

            await getProjectInfo(config);
        } catch (error) {
            handleError(error);
        }
    });

// Parse and run
program.parseAsync(process.argv).catch((error) => {
    handleError(error);
});
