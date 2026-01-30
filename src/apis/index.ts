/**
 * APIs
 *
 * This file combines template and project APIs.
 * - index.template.ts: Template APIs (synced from template)
 * - index.project.ts: Project APIs (your custom APIs)
 */

// Export the API name - must be unique across all APIs
export const name = "api-root";

// Re-export types
export * from './types';

// Template APIs
export * from './index.template';

// Project-specific APIs
export * from './index.project';
