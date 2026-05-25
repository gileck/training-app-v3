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
import { loginApprovalsApiHandlers } from "./template/login-approvals/server";
import { userApprovalsApiHandlers } from "./template/user-approvals/server";
import { reportsApiHandlers } from "./template/reports/server";
import { featureRequestsApiHandlers } from "./template/feature-requests/server";
import { agentLogApiHandlers } from "./template/agent-log/server";
import { clarificationApiHandlers } from "./template/clarification/server";
import { dashboardApiHandlers } from "./template/dashboard/server";
import { agentDecisionApiHandlers } from "./template/agent-decision/server";
import { workflowApiHandlers } from "./template/workflow/server";
import { adminUsersApiHandlers } from "./template/admin-users/server";
import { pushNotificationsApiHandlers } from "./template/push-notifications/server";
import { mongoExplorerApiHandlers } from "./template/mongo-explorer/server";
import { adminSessionsApiHandlers } from "./template/admin-sessions/server";
import { rpcConnectionsApiHandlers } from "./template/rpc-connections/server";

export const templateApiHandlers = mergeApiHandlers(
  clearCacheApiHandlers,
  authApiHandlers,
  loginApprovalsApiHandlers,
  userApprovalsApiHandlers,
  reportsApiHandlers,
  featureRequestsApiHandlers,
  agentLogApiHandlers,
  clarificationApiHandlers,
  dashboardApiHandlers,
  agentDecisionApiHandlers,
  workflowApiHandlers,
  adminUsersApiHandlers,
  pushNotificationsApiHandlers,
  mongoExplorerApiHandlers,
  adminSessionsApiHandlers,
  rpcConnectionsApiHandlers
);
