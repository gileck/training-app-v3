/**
 * Template API Handlers
 *
 * These are core API handlers provided by the template.
 * Do not modify this file - it will be overwritten during template sync.
 *
 * To add project-specific APIs, add them to apis.ts instead.
 */

import { mergeApiHandlers } from "./registry";
import { clearCacheApiHandlers } from "./template/settings/clearCache/server";
import { authApiHandlers } from "./template/auth/server";
import { reportsApiHandlers } from "./template/reports/server";
import { featureRequestsApiHandlers } from "./template/feature-requests/server";
import { agentLogApiHandlers } from "./template/agent-log/server";
import { clarificationApiHandlers } from "./template/clarification/server";
import { dashboardApiHandlers } from "./template/dashboard/server";
import { bugFixSelectApiHandlers } from "./template/bug-fix-select/server";

export const templateApiHandlers = mergeApiHandlers(
  clearCacheApiHandlers,
  authApiHandlers,
  reportsApiHandlers,
  featureRequestsApiHandlers,
  agentLogApiHandlers,
  clarificationApiHandlers,
  dashboardApiHandlers,
  bugFixSelectApiHandlers
);
