/**
 * Project Management Module
 *
 * Provides a unified interface for project management operations.
 * Currently implemented with GitHub Projects V2, but designed to support
 * other systems (Jira, ClickUp, etc.) in the future.
 *
 * Usage:
 * ```typescript
 * import { getProjectManagementAdapter, STATUSES } from '@/server/project-management';
 *
 * const adapter = getProjectManagementAdapter();
 * await adapter.init();
 *
 * const items = await adapter.listItems({ status: STATUSES.productDesign });
 * ```
 */

import { GitHubProjectsAdapter } from './adapters/github';
import type { ProjectManagementAdapter } from './types';

// Export types
export * from './types';
export * from './config';

// Singleton adapter instance
let adapter: ProjectManagementAdapter | null = null;

/**
 * Get the project management adapter instance (singleton)
 *
 * The adapter type is determined by the PROJECT_MANAGEMENT_TYPE environment variable.
 * Currently only 'github' is supported (and is the default).
 */
export function getProjectManagementAdapter(): ProjectManagementAdapter {
    if (!adapter) {
        const type = process.env.PROJECT_MANAGEMENT_TYPE || 'github';

        switch (type) {
            case 'github':
            default:
                adapter = new GitHubProjectsAdapter();
        }
    }
    return adapter;
}

/**
 * Reset the adapter instance (useful for testing)
 */
export function resetProjectManagementAdapter(): void {
    adapter = null;
}
