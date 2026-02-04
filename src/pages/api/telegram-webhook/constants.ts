/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Constants for Telegram Webhook
 */

import { STATUSES, REVIEW_STATUSES } from '@/server/project-management/config';
import type { ReviewAction } from './types';

/**
 * Telegram Bot API base URL
 */
export const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

/**
 * Undo timeout in milliseconds (5 minutes)
 */
export const UNDO_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Status transitions when approved - move to next phase
 */
export const STATUS_TRANSITIONS: Record<string, string> = {
    [STATUSES.productDesign]: STATUSES.techDesign,
    [STATUSES.techDesign]: STATUSES.implementation,
    // Implementation → PR Review happens automatically when agent creates PR
    // PR Review doesn't auto-advance - PR needs manual merge → Done
};

/**
 * Map review actions to their status values
 */
export const ACTION_TO_REVIEW_STATUS: Record<ReviewAction, string> = {
    approve: REVIEW_STATUSES.approved,
    changes: REVIEW_STATUSES.requestChanges,
    reject: REVIEW_STATUSES.rejected,
};

/**
 * Human-readable labels for review actions
 */
export const ACTION_LABELS: Record<ReviewAction, string> = {
    approve: 'Approved',
    changes: 'Requested Changes',
    reject: 'Rejected',
};

/**
 * Emoji icons for review actions
 */
export const ACTION_EMOJIS: Record<ReviewAction, string> = {
    approve: '✅',
    changes: '📝',
    reject: '❌',
};

/**
 * Map routing destinations to GitHub Project statuses (for features)
 */
export const FEATURE_ROUTING_STATUS_MAP: Record<string, string> = {
    'product-dev': STATUSES.productDevelopment,
    'product-design': STATUSES.productDesign,
    'tech-design': STATUSES.techDesign,
    'implementation': STATUSES.implementation,
    'backlog': STATUSES.backlog,
};

/**
 * Map routing destinations to GitHub Project statuses (for bugs - no product-dev)
 */
export const BUG_ROUTING_STATUS_MAP: Record<string, string> = {
    'product-design': STATUSES.productDesign,
    'tech-design': STATUSES.techDesign,
    'implementation': STATUSES.implementation,
    'backlog': STATUSES.backlog,
};

/**
 * Human-readable labels for routing destinations
 */
export const ROUTING_DESTINATION_LABELS: Record<string, string> = {
    'product-dev': 'Product Development',
    'product-design': 'Product Design',
    'tech-design': 'Technical Design',
    'implementation': 'Ready for Development',
    'backlog': 'Backlog',
};
