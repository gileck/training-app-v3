/**
 * Workflow Constants
 *
 * Shared constants used across workflow components.
 */

export const PIPELINE_STATUSES = [
    'Backlog',
    'Product Development',
    'Product Design',
    'Bug Investigation',
    'Technical Design',
    'Ready for development',
    'PR Review',
    'Final Review',
] as const;

export const ALL_STATUSES = [
    'Backlog',
    'Product Development',
    'Product Design',
    'Bug Investigation',
    'Technical Design',
    'Ready for development',
    'PR Review',
    'Final Review',
    'Done',
] as const;

export const ALL_SECTION_KEYS = ['pending', ...PIPELINE_STATUSES, 'Done'] as const;
