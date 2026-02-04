/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Utility functions for Telegram Webhook
 */

import { getProjectManagementAdapter } from '@/server/project-management';
import { UNDO_TIMEOUT_MS } from './constants';
import type { ParsedCallbackData, ProjectItem } from './types';

/**
 * Escape HTML special characters for Telegram HTML mode
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Check if undo is still within the time window
 */
export function isUndoValid(timestamp: number): boolean {
    return Date.now() - timestamp < UNDO_TIMEOUT_MS;
}

/**
 * Format remaining undo time for display
 */
export function formatUndoTimeRemaining(timestamp: number): string {
    const remaining = Math.max(0, UNDO_TIMEOUT_MS - (Date.now() - timestamp));
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse and validate callback data with defensive parsing
 * Handles whitespace, case normalization, and type validation
 */
export function parseCallbackData(callbackData: string): ParsedCallbackData {
    const trimmed = callbackData.trim();
    const parts = trimmed.split(':').map(p => p.trim());
    const action = parts[0]?.toLowerCase() || '';

    return {
        action,
        parts,
        getInt: (index: number): number | null => {
            const val = parseInt(parts[index]?.trim() || '', 10);
            return isNaN(val) || !val ? null : val;
        },
        getString: (index: number): string => parts[index]?.trim() || '',
    };
}

/**
 * Find project item by issue number
 */
export async function findItemByIssueNumber(
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    issueNumber: number
): Promise<ProjectItem | null> {
    const items = await adapter.listItems({});

    for (const item of items) {
        if (item.content?.number === issueNumber) {
            return {
                itemId: item.id,
                title: item.content.title,
                status: item.status,
                reviewStatus: item.reviewStatus || null,
            };
        }
    }

    return null;
}
