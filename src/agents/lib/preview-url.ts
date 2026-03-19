/**
 * Vercel Preview URL — fetches the preview deployment URL for a PR.
 *
 * Queries the Vercel API for preview deployments matching the given PR number.
 * Checks READY first, then BUILDING (URL is assigned at build start).
 * Returns null if VERCEL_TOKEN is not configured or no deployment is found.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/* eslint-disable api-guidelines/no-duplicate-api-types -- local types for Vercel API response, not domain types */
type VercelDeployment = { url: string | null; state: string; meta?: { githubPrId?: string } };
type DeploymentsResponse = { deployments: VercelDeployment[]; error?: { code: string; message: string } };
type ProjectConfig = { projectId: string; orgId: string };
/* eslint-enable api-guidelines/no-duplicate-api-types */

function getProjectConfig(): ProjectConfig | null {
    const configPath = resolve(process.cwd(), '.vercel/project.json');
    if (!existsSync(configPath)) return null;

    try {
        const content = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content) as ProjectConfig;
        if (!config.projectId || !config.orgId) return null;
        return config;
    } catch {
        return null;
    }
}

/**
 * Get the Vercel preview deployment URL for a given PR number.
 * Returns null if not available (no token, no config, no deployment found).
 */
export async function getVercelPreviewUrl(prNumber: number): Promise<string | null> {
    const token = process.env.VERCEL_TOKEN?.replace(/^["']|["']$/g, '');
    if (!token) return null;

    const config = getProjectConfig();
    if (!config) return null;

    // Vercel assigns the URL at build start, so BUILDING deployments already have a usable URL.
    // Check READY first (preferred), then BUILDING as fallback.
    const states = ['READY', 'BUILDING'] as const;

    try {
        for (const state of states) {
            const url = new URL('https://api.vercel.com/v6/deployments');
            url.searchParams.set('projectId', config.projectId);
            url.searchParams.set('teamId', config.orgId);
            url.searchParams.set('target', 'preview');
            url.searchParams.set('state', state);
            url.searchParams.set('limit', '20');

            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!res.ok) continue;

            const data = await res.json() as DeploymentsResponse;
            if (data.error) continue;

            const deployment = data.deployments.find(
                d => d.meta?.githubPrId === String(prNumber) && d.url
            );

            if (deployment?.url) {
                return `https://${deployment.url}`;
            }
        }

        return null;
    } catch {
        return null;
    }
}
