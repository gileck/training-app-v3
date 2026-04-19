#!/usr/bin/env node
/**
 * @__NAME__/mcp — MCP server exposing @__NAME__/sdk as tools.
 *
 * Env vars:
 *   __UPPER___URL          (required) base URL of the deployed app
 *   __UPPER___TOKEN        (required) ADMIN_API_TOKEN
 *   __UPPER___USER_ID      (required) MongoDB _id of the user to act as
 *   __UPPER___TIMEOUT_MS   (optional, default 30000)
 *
 * Transport: stdio. MCP clients (Claude Code, Claude Agent SDK, NanoClaw)
 * launch this process and speak JSON-RPC over stdin/stdout.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createClient,
  __PASCAL__ApiError,
  __PASCAL__Error,
  __PASCAL__NetworkError,
  __PASCAL__ResponseError,
  __PASCAL__ValidationError,
  type __PASCAL__Client,
} from '@__NAME__/sdk';
import { TOOLS } from './tools.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    process.stderr.write(`[__NAME__-mcp] missing required env var: ${name}\n`);
    process.exit(1);
  }
  return value;
}

const client: __PASCAL__Client = createClient({
  baseUrl: requireEnv('__UPPER___URL'),
  adminToken: requireEnv('__UPPER___TOKEN'),
  userId: requireEnv('__UPPER___USER_ID'),
  timeoutMs: process.env.__UPPER___TIMEOUT_MS
    ? Number(process.env.__UPPER___TIMEOUT_MS)
    : undefined,
});

const server = new Server(
  { name: '__NAME__', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

/**
 * Augment every tool's inputSchema with optional top-level `userId`. The
 * dispatcher extracts it and scopes the client via `client.asUser(userId)`.
 */
function withUserIdProp(schema: { properties: Record<string, unknown>; required?: string[] }) {
  return {
    ...schema,
    properties: {
      ...schema.properties,
      userId: {
        type: 'string',
        description:
          'Optional — act on behalf of this user (MongoDB _id). Omit to use the MCP server default.',
      },
    },
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: withUserIdProp(t.inputSchema),
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
      isError: true,
    };
  }

  const rawArgs = (req.params.arguments ?? {}) as Record<string, unknown> & { userId?: string };
  const { userId: actAs, ...args } = rawArgs;
  const effectiveClient =
    typeof actAs === 'string' && actAs.length > 0 ? client.asUser(actAs) : client;

  try {
    const result = await tool.handler(effectiveClient, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: formatError(err) }], isError: true };
  }
});

function formatError(err: unknown): string {
  if (err instanceof __PASCAL__ValidationError) {
    return `ValidationError (client-side)\nfield: ${err.field}\nreason: ${err.reason}\n\nDo not retry — fix the tool arguments.`;
  }
  if (err instanceof __PASCAL__ApiError) {
    return `ApiError\napi: ${err.apiName}\nerrorCode: ${err.errorCode ?? '(none)'}\nmessage: ${err.message}`;
  }
  if (err instanceof __PASCAL__NetworkError) {
    return `NetworkError${err.isTimeout ? ' (timeout)' : ''}\napi: ${err.apiName}\nmessage: ${err.message}\n\nRetry may help.`;
  }
  if (err instanceof __PASCAL__ResponseError) {
    return `ResponseError\napi: ${err.apiName}\nstatus: ${err.status}\nmessage: ${err.message}\n\nLikely version skew between client and server.`;
  }
  if (err instanceof __PASCAL__Error) {
    return `${err.name}: ${err.message}`;
  }
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return `Unknown error: ${String(err)}`;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[__NAME__-mcp] ready — ${TOOLS.length} tools registered\n`);
}

main().catch((err) => {
  process.stderr.write(`[__NAME__-mcp] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
