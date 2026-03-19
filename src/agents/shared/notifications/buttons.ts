/**
 * Inline keyboard button builders for Telegram notifications.
 */

import type { InlineKeyboardMarkup } from './types';

/**
 * Build simple View PR button (for implementation PRs)
 * Implementation PRs should be reviewed by PR Review agent, not manually approved
 */
export function buildViewPRButton(prUrl: string): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: '🔀 View PR', url: prUrl },
            ],
        ],
    };
}

/**
 * Build buttons with View Issue + review actions
 */
export function buildIssueReviewButtons(issueNumber: number, issueUrl: string): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: '📋 View Issue', url: issueUrl },
            ],
            [
                { text: '✅ Approve', callback_data: `approve:${issueNumber}` },
                { text: '📝 Request Changes', callback_data: `changes:${issueNumber}` },
                { text: '❌ Reject', callback_data: `reject:${issueNumber}` },
            ],
        ],
    };
}

/**
 * Build simple View Issue button
 */
export function buildViewIssueButton(issueUrl: string): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '📋 View Issue', url: issueUrl }],
        ],
    };
}

/**
 * Build View Project button
 */
export function buildViewProjectButton(projectUrl: string): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '🗂 View Project', url: projectUrl }],
        ],
    };
}
