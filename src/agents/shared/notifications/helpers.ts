/**
 * Helper utilities for notification formatting.
 */

import { requireAppUrl } from '@/server/template/appUrl';

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
 * Get the base app URL for clarification and decision links — the single
 * `NEXT_PUBLIC_APP_URL` source (localhost in dev). Throws in production if unset.
 */
export function getAppUrl(): string {
    return requireAppUrl();
}

/**
 * Sleep for a specified number of milliseconds
 */
export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
