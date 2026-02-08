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
import { AppProjectAdapter } from './adapters/app-project';
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
 * - 'app': MongoDB-backed workflow tracking with GitHub for issues/PRs (recommended)
 * - 'github': GitHub Projects V2 for workflow tracking (legacy)
 */
export function getProjectManagementAdapter(): ProjectManagementAdapter {
    if (!adapter) {
        const type = process.env.PROJECT_MANAGEMENT_TYPE || 'app';

        switch (type) {
            case 'app':
                adapter = new AppProjectAdapter();
                break;
            case 'github':
            default:
                adapter = new GitHubProjectsAdapter();
                break;
        }
    }
    return adapter as ProjectManagementAdapter;
}

/**
 * Reset the adapter instance (useful for testing)
 */
export function resetProjectManagementAdapter(): void {
    adapter = null;
}
