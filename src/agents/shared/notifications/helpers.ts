/**
 * Helper utilities for notification formatting.
 */

import { appConfig } from '../../../app.config';

/**
 * Escape HTML special characters for Telegram HTML mode
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Get the base app URL for clarification and decision links.
 *
 * Uses appConfig.appUrl which has the following priority:
 * 1. NEXT_PUBLIC_APP_URL - Manual override
 * 2. VERCEL_PROJECT_PRODUCTION_URL - Stable production domain
 * 3. VERCEL_URL - Deployment-specific URL
 * 4. Default production URL from config
 */
export function getAppUrl(): string {
    return appConfig.appUrl;
}

/**
 * Sleep for a specified number of milliseconds
 */
export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
