/**
 * Standardized Console Output for Agent Scripts
 *
 * Convention:
 * - All progress messages use 2-space indent prefix
 * - Emoji prefixes are reserved for phase/status changes only (not routine progress)
 * - Routine progress uses plain text with 2-space indent
 * - Warnings use the warn() helper
 *
 * Usage:
 *   import { progress, warn } from '@/agents/shared/console';
 *   progress('Processing issue #42');      // "  Processing issue #42"
 *   warn('Skipping optional step');         // "  Warning: Skipping optional step"
 *
 * Gradual adoption: New code should use these helpers. Existing console.log
 * calls will be migrated over time — no need to bulk-replace.
 */

/** Log a progress message with standard 2-space indent */
export const progress = (msg: string): void => {
    console.log(`  ${msg}`);
};

/** Log a warning with standard 2-space indent */
export const warn = (msg: string): void => {
    console.warn(`  Warning: ${msg}`);
};
