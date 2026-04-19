import type { __PASCAL__Client } from '@__NAME__/sdk';

/** JSON Schema (draft-07 subset) for a tool's input. */
export type InputSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: InputSchema;
  handler: (client: __PASCAL__Client, args: Record<string, unknown>) => Promise<unknown>;
}

// ----- schema builders -----------------------------------------------------
const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const num = (description?: string) => ({ type: 'number', ...(description ? { description } : {}) });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const int = (description?: string) => ({ type: 'integer', ...(description ? { description } : {}) });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bool = (description?: string) => ({ type: 'boolean', ...(description ? { description } : {}) });
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const arr = (items: unknown, description?: string) => ({
  type: 'array',
  items,
  ...(description ? { description } : {}),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pick = <T>(args: Record<string, unknown>, key: string): T => args[key] as T;

// ===========================================================================
// TOOL DEFINITIONS
// ===========================================================================
// Every tool's inputSchema is augmented with an optional top-level `userId`
// in server.ts. Handlers never see `userId` — the dispatcher strips it and
// passes a client already scoped to the requested user. Do NOT add `userId`
// to individual schemas below.
// ===========================================================================

export const TOOLS: ToolDef[] = [
  // ------ starter domain — replace with real tools -------------------------
  {
    name: 'ping',
    description:
      'Sanity check: confirm the MCP server can reach the app as the configured (or on-behalf-of) user.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: (c) => c.ping.me(),
  },

  // ------ admin: users -----------------------------------------------------
  {
    name: 'list_users',
    description:
      "List every user in the system. Use this to resolve a username typed by the human into the MongoDB _id needed by other tools' `userId` argument.",
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: (c) => c.admin.users.list(),
  },

  // ------ escape hatch -----------------------------------------------------
  {
    name: 'call_api',
    description:
      "Escape hatch: call any /api/process/* endpoint by name (slash-delimited, e.g. 'auth/me'). Params forwarded as-is. Prefer typed tools above when available.",
    inputSchema: {
      type: 'object',
      properties: {
        apiName: str('e.g. "auth/me"'),
        params: { type: 'object' },
      },
      required: ['apiName'],
    },
    handler: (c, a) => c.call(a.apiName as string, a.params ?? {}),
  },
];
