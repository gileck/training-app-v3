/**
 * API Handlers
 *
 * This file combines template and project API handlers.
 * - apis.template.ts: Template handlers (synced from template)
 * - apis.project.ts: Project handlers (your custom handlers)
 */

import { mergeApiHandlers } from "./registry";
import { templateApiHandlers } from "./apis.template";
import { projectApiHandlers } from "./apis.project";

export const apiHandlers = mergeApiHandlers(
  templateApiHandlers,
  projectApiHandlers
);
