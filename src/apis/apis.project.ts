/**
 * Project-specific API Handlers
 *
 * Add your project-specific API handlers here.
 * Template handlers are in apis.template.ts (synced from template).
 */

import { mergeApiHandlers } from "./registry";
import { chatApiHandlers } from "./project/chat/server";

export const projectApiHandlers = mergeApiHandlers(
  chatApiHandlers
);
