/**
 * Project-specific API Handlers
 *
 * Add your project-specific API handlers here.
 * Template handlers are in apis.template.ts (synced from template).
 */

import { mergeApiHandlers } from "./registry";
import { chatApiHandlers } from "./chat/server";
import { todosApiHandlers } from "./todos/server";
import { clarificationApiHandlers } from "./clarification/server";

export const projectApiHandlers = mergeApiHandlers(
  chatApiHandlers,
  todosApiHandlers,
  clarificationApiHandlers
);
