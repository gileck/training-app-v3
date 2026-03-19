/**
 * Workflow Service Constants
 *
 * Routing maps and labels for workflow status transitions.
 * Single source of truth — consumed by Telegram handlers, UI, and CLI.
 */

import { STATUSES } from '@/server/template/project-management/config';
import type { ItemType, RoutingDestination } from './types';

/**
 * Status transitions when design phase is approved — move to next phase.
 * Used by design-review auto-advance and auto-advance agent.
 */
export const STATUS_TRANSITIONS: Record<string, string> = {
    [STATUSES.productDevelopment]: STATUSES.productDesign,
    [STATUSES.productDesign]: STATUSES.techDesign,
    [STATUSES.techDesign]: STATUSES.implementation,
    // Implementation → PR Review happens automatically when agent creates PR
    // PR Review doesn't auto-advance - PR needs manual merge → Done
};

/**
 * Default undo window in milliseconds (5 minutes).
 */
export const DEFAULT_UNDO_WINDOW_MS = 5 * 60 * 1000;

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
 * Map routing destinations to GitHub Project statuses (for bugs — no product-dev)
 */
export const BUG_ROUTING_STATUS_MAP: Record<string, string> = {
    'bug-investigation': STATUSES.bugInvestigation,
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
    'bug-investigation': 'Bug Investigation',
    'product-design': 'Product Design',
    'tech-design': 'Technical Design',
    'implementation': 'Ready for Development',
    'backlog': 'Backlog',
};

/**
 * Get the routing status map for a given item type
 */
export function getRoutingStatusMap(type: ItemType): Record<string, string> {
    return type === 'feature' ? FEATURE_ROUTING_STATUS_MAP : BUG_ROUTING_STATUS_MAP;
}

/**
 * Reverse lookup: convert a raw status string to a routing destination
 */
export function statusToDestination(status: string): RoutingDestination | null {
    // Check all possible statuses (feature map is a superset of bug map)
    for (const [destination, statusValue] of Object.entries(FEATURE_ROUTING_STATUS_MAP)) {
        if (statusValue === status) {
            return destination as RoutingDestination;
        }
    }
    return null;
}
