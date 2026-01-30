/**
 * Route Definitions
 *
 * This file combines template and project routes.
 * - index.template.ts: Template routes (synced from template)
 * - index.project.ts: Project routes (your custom routes)
 */

import { createRoutes } from '../router';
import { templateRoutes } from './index.template';
import { projectRoutes } from './index.project';

export const routes = createRoutes({
  // Template routes
  ...templateRoutes,

  // Project-specific routes
  ...projectRoutes,
});
