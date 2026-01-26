/**
 * Template API Handlers
 *
 * These are core API handlers provided by the template.
 * Do not modify this file - it will be overwritten during template sync.
 *
 * To add project-specific APIs, add them to apis.ts instead.
 */

import { mergeApiHandlers } from "./registry";
import { clearCacheApiHandlers } from "./settings/clearCache/server";
import { authApiHandlers } from "./auth/server";
import { reportsApiHandlers } from "./reports/server";
import { featureRequestsApiHandlers } from "./feature-requests/server";
import { agentLogApiHandlers } from "./agent-log/server";

export const templateApiHandlers = mergeApiHandlers(
  clearCacheApiHandlers,
  authApiHandlers,
  reportsApiHandlers,
  featureRequestsApiHandlers,
  agentLogApiHandlers
);
