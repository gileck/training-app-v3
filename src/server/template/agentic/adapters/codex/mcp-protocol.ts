/**
 * Generic stdio MCP server protocol used by the Codex SDK adapter.
 *
 * Codex spawns one of these per agent turn. The parent (Codex adapter)
 * passes a JSON-encoded per-turn context via an env var (whose name
 * the project chooses — e.g. `AI_DOCTOR_MCP_CONTEXT`). This module
 * implements the JSON-RPC framing, tool listing, and tool dispatch —
 * the project supplies just the server name, tool list, the env var
 * name, and a `createDataContext` factory.
 *
 * Why a separate process: Codex's MCP integration spawns the server
 * over stdio, so we can't share a closure with the parent.
 *
 * Why stdout discipline matters: MCP frames JSON-RPC on stdout. Any
 * incidental log from database / tool code on stdout would corrupt
 * the protocol. We redirect every console method to stderr at startup.
 */

import { createInterface } from 'readline';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { AGENTIC_MCP_CONTEXT_ENV_VAR } from '../../types';
import type { AgenticTool, AgenticToolContext, ToolResult } from '../../types';

type JsonRpcRequest = {
    jsonrpc?: '2.0';
    id?: string | number | null;
    method?: string;
    params?: Record<string, unknown>;
};

type McpContextEnv = {
    userId: string;
    conversationId: string;
    sourceMessageId: string;
};

const PROTOCOL_VERSION = '2024-11-05';

export interface CodexMcpServerConfig<TData> {
    /** Stable agent slug — same value the project passes to its adapter
     *  config. Used as the MCP serverInfo.name in the initialize
     *  response (Codex only logs it, but matching the adapter side
     *  makes debugging easier). */
    agentName: string;
    /** Tools the server exposes. Names are case-sensitive and must
     *  match what the parent enabled in `enabled_tools`. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool shapes
    tools: readonly AgenticTool<any, TData>[];
    /** Factory called once at startup to build the per-turn `data`
     *  passed in `AgenticToolContext.data`. */
    createDataContext: (userId: string) => TData;
}

/**
 * Boot the stdio MCP server. Call from the bottom of the project's
 * `codex-mcp-server.ts` bootstrap file — Codex spawns that script
 * directly, so this function never returns under normal operation.
 */
export function runCodexMcpServer<TData>(config: CodexMcpServerConfig<TData>): void {
    redirectConsoleToStderr();

    const serverInfo = { name: config.agentName, version: '1.0.0' };
    const context = buildToolContext<TData>(config);
    const toolByName = new Map(config.tools.map((tool) => [tool.name, tool]));

    const rl = createInterface({
        input: process.stdin,
        crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
        void handleLine(line);
    });

    async function handleLine(line: string): Promise<void> {
        const trimmed = line.trim();
        if (!trimmed) return;

        let request: JsonRpcRequest;
        try {
            request = JSON.parse(trimmed) as JsonRpcRequest;
        } catch {
            return;
        }

        if (request.id === undefined || request.id === null) {
            return;
        }

        try {
            const result = await handleRequest(request);
            respond(request.id, result);
        } catch (err) {
            respondError(request.id, err instanceof Error ? err.message : String(err));
        }
    }

    async function handleRequest(request: JsonRpcRequest): Promise<unknown> {
        switch (request.method) {
            case 'initialize':
                return {
                    protocolVersion: PROTOCOL_VERSION,
                    capabilities: { tools: {} },
                    serverInfo,
                };
            case 'tools/list':
                return { tools: config.tools.map(toolToMcpDefinition) };
            case 'tools/call':
                return callTool(request.params ?? {});
            case 'ping':
                return {};
            default:
                throw new Error(`Unsupported MCP method: ${request.method ?? '<missing>'}`);
        }
    }

    async function callTool(params: Record<string, unknown>) {
        const name = typeof params.name === 'string' ? params.name : '';
        const tool = toolByName.get(name);
        if (!tool) {
            throw new Error(`Unknown tool: ${name}`);
        }

        // Validation failures must come back to the model as a normal
        // ToolResult envelope, NOT as a JSON-RPC error — otherwise the
        // model sees a giant unstructured ZodError JSON and can't
        // self-correct via the usual retry path.
        const parsed = parseToolArgs(tool, params.arguments);
        if (!parsed.ok) {
            const errorResult: ToolResult = { ok: false, error: parsed.error };
            return {
                content: [{ type: 'text', text: JSON.stringify(errorResult) }],
                structuredContent: errorResult,
                isError: true,
            };
        }
        const result: ToolResult = await tool.handler(parsed.args as never, context);
        const text = JSON.stringify(result);
        return {
            content: [{ type: 'text', text }],
            structuredContent: result,
            isError: !result.ok,
        };
    }
}

function buildToolContext<TData>(config: CodexMcpServerConfig<TData>): AgenticToolContext<TData> {
    const raw = process.env[AGENTIC_MCP_CONTEXT_ENV_VAR];
    if (!raw) {
        throw new Error(`${AGENTIC_MCP_CONTEXT_ENV_VAR} is required`);
    }
    const parsed = JSON.parse(raw) as McpContextEnv;
    if (!parsed.userId || !parsed.conversationId || !parsed.sourceMessageId) {
        throw new Error(`${AGENTIC_MCP_CONTEXT_ENV_VAR} is missing required fields`);
    }
    return {
        userId: parsed.userId,
        conversationId: new ObjectId(parsed.conversationId),
        sourceMessageId: parsed.sourceMessageId,
        data: config.createDataContext(parsed.userId),
    };
}

function toolToMcpDefinition(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool list
    tool: AgenticTool<any, any>
) {
    return {
        name: tool.name,
        description: tool.description,
        inputSchema: z.toJSONSchema(z.object(tool.inputSchema)),
    };
}

type ParsedToolArgs =
    | { ok: true; args: Record<string, unknown> }
    | { ok: false; error: string };

function parseToolArgs(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool list
    tool: AgenticTool<any, any>,
    rawArgs: unknown
): ParsedToolArgs {
    const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {};
    const parsed = z.object(tool.inputSchema).safeParse(args);
    if (parsed.success) {
        return { ok: true, args: parsed.data as Record<string, unknown> };
    }
    // Flatten Zod's tree into a single readable line per issue —
    // models recover from "field X: expected number, got string" much
    // better than from a nested JSON blob.
    const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
    return { ok: false, error: `Invalid tool arguments: ${issues}` };
}

function respond(id: string | number, result: unknown): void {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function respondError(id: string | number, message: string): void {
    process.stdout.write(
        `${JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32000, message },
        })}\n`
    );
}

function redirectConsoleToStderr(): void {
    for (const method of ['log', 'info', 'warn', 'error'] as const) {
        console[method] = (...args: unknown[]) => {
            process.stderr.write(`${args.map(formatLogArg).join(' ')}\n`);
        };
    }
}

function formatLogArg(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack ?? value.message;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}
