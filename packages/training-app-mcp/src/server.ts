#!/usr/bin/env node
/**
 * @training-app/mcp — MCP server exposing the training-app SDK as tools.
 *
 * Reads configuration from env vars:
 *   TRAINING_APP_URL         (required) base URL of the deployed app
 *   TRAINING_APP_TOKEN       (required) ADMIN_API_TOKEN
 *   TRAINING_APP_USER_ID     (required) MongoDB _id of the user to act as
 *   TRAINING_APP_TIMEOUT_MS  (optional, default 30000)
 *
 * Transport: stdio. Claude Code launches this process via .mcp.json and
 * speaks JSON-RPC over stdin/stdout.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createClient,
  TrainingAppApiError,
  TrainingAppError,
  TrainingAppNetworkError,
  TrainingAppResponseError,
  TrainingAppValidationError,
  type TrainingAppClient,
} from '@training-app/sdk';
import { TOOLS } from './tools.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    process.stderr.write(`[training-app-mcp] missing required env var: ${name}\n`);
    process.exit(1);
  }
  return value;
}

const client: TrainingAppClient = createClient({
  baseUrl: requireEnv('TRAINING_APP_URL'),
  adminToken: requireEnv('TRAINING_APP_TOKEN'),
  userId: requireEnv('TRAINING_APP_USER_ID'),
  timeoutMs: process.env.TRAINING_APP_TIMEOUT_MS
    ? Number(process.env.TRAINING_APP_TIMEOUT_MS)
    : undefined,
});

const server = new Server(
  { name: 'training-app', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
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

  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  try {
    const result = await tool.handler(client, args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return { content: [{ type: 'text', text: formatError(err) }], isError: true };
  }
});

/**
 * Convert SDK errors into a structured text payload so the LLM can reason
 * about them (rather than showing an opaque stack trace).
 */
function formatError(err: unknown): string {
  if (err instanceof TrainingAppValidationError) {
    return `ValidationError (client-side)\nfield: ${err.field}\nreason: ${err.reason}\n\nDo not retry — fix the tool arguments.`;
  }
  if (err instanceof TrainingAppApiError) {
    return `ApiError\napi: ${err.apiName}\nerrorCode: ${err.errorCode ?? '(none)'}\nmessage: ${err.message}`;
  }
  if (err instanceof TrainingAppNetworkError) {
    return `NetworkError${err.isTimeout ? ' (timeout)' : ''}\napi: ${err.apiName}\nmessage: ${err.message}\n\nRetry may help.`;
  }
  if (err instanceof TrainingAppResponseError) {
    return `ResponseError\napi: ${err.apiName}\nstatus: ${err.status}\nmessage: ${err.message}\n\nLikely version skew between client and server.`;
  }
  if (err instanceof TrainingAppError) {
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
  process.stderr.write(`[training-app-mcp] ready — ${TOOLS.length} tools registered\n`);
}

main().catch((err) => {
  process.stderr.write(`[training-app-mcp] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
