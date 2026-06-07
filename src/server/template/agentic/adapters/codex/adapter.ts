/**
 * Codex SDK adapter for the generic agentic engine.
 *
 * The Codex SDK controls a local Codex agent by spawning the Codex CLI
 * and streaming structured thread events. Codex consumes custom tools
 * through MCP, so this adapter configures a per-turn stdio MCP server
 * (spawned from the project's `codex-mcp-server.ts` bootstrap path
 * supplied in `AgenticAdapterConfig.codexMcpServerPath`) that exposes
 * the shared tool list. The adapter itself remains SDK glue: prompt /
 * session translation, SDK event translation, and cost calculation.
 */

import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { getModelById } from '@/common/ai/models';
import { summarizeToolResult } from '../../eventSummary';
import {
    AGENTIC_MCP_CONTEXT_ENV_VAR,
    codexMcpServerKeyFor,
    defaultCodexMcpServerPath,
} from '../../types';
import type {
    CodexOptions,
    Input,
    McpToolCallItem,
    ThreadItem,
    ThreadOptions,
    Usage,
} from '@openai/codex-sdk';
import type {
    AgenticAdapter,
    AgenticAdapterConfig,
    AgentEvent,
    AgenticResult,
    AgenticRunOptions,
    AgenticTool,
} from '../../types';

/**
 * Dynamic ESM import of the Codex SDK.
 *
 * Why dynamic: child projects' package.json typically has no "type"
 * field → defaults to CommonJS. tsx transpiles this file to CJS at
 * daemon runtime, so a static `import { Codex } from '@openai/codex-sdk'`
 * becomes a `require()` call. The codex-sdk package is ESM-only (its
 * `exports` field has `"import"` but no `"require"`/`"default"`
 * condition) — the CJS require fails with "No 'exports' main defined".
 * A dynamic `await import()` always resolves via Node's ESM loader
 * regardless of caller mode, sidestepping the CJS path.
 *
 * Memoised so we only load the module once across all turns.
 */
let codexCtorPromise: Promise<typeof import('@openai/codex-sdk').Codex> | null = null;
function loadCodexCtor(): Promise<typeof import('@openai/codex-sdk').Codex> {
    if (!codexCtorPromise) {
        codexCtorPromise = import('@openai/codex-sdk').then((m) => m.Codex);
    }
    return codexCtorPromise;
}

const MODEL_MAP: Record<string, string> = {
    'gpt-5.5': 'gpt-5.5',
    'gpt-5.4': 'gpt-5.4',
};

function now(): string {
    return new Date().toISOString();
}

function usageToTokens(
    usage: Usage | null
): { input: number; output: number } | undefined {
    if (!usage) return undefined;
    return {
        input: usage.input_tokens ?? 0,
        output: usage.output_tokens ?? 0,
    };
}

function calculateCost(modelId: string, usage: Usage | null): number {
    if (!usage) return 0;
    const model = getModelById(modelId);
    return (
        (usage.input_tokens / 1_000_000) * model.inputPricePer1M +
        (usage.output_tokens / 1_000_000) * model.outputPricePer1M
    );
}

function extractToolResult(item: McpToolCallItem) {
    const structured = item.result?.structured_content;
    if (structured && typeof structured === 'object') {
        return structured as {
            ok: boolean;
            data?: unknown;
            error?: string;
            truncated?: boolean;
            hint?: string;
        };
    }

    const textBlock = item.result?.content.find((part) => part.type === 'text');
    const text =
        textBlock && 'text' in textBlock && typeof textBlock.text === 'string'
            ? textBlock.text
            : undefined;
    if (text) {
        try {
            return JSON.parse(text) as {
                ok: boolean;
                data?: unknown;
                error?: string;
                truncated?: boolean;
                hint?: string;
            };
        } catch {
            // Fall through to a generic success envelope.
        }
    }

    return {
        ok: item.status !== 'failed',
        error: item.error?.message,
    };
}

export class CodexAgenticAdapter implements AgenticAdapter {
    readonly name = 'codex';

    constructor(private readonly config: AgenticAdapterConfig) {}

    supportsModel(modelId: string): boolean {
        return modelId in MODEL_MAP;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variance on TData; we forward ctx through
    async runAgent(opts: AgenticRunOptions<any>): Promise<AgenticResult> {
        const sdkModelId = MODEL_MAP[opts.modelId];
        if (!sdkModelId) {
            throw new Error(`Codex adapter does not handle model "${opts.modelId}"`);
        }

        const mcpKey = codexMcpServerKeyFor(this.config.agentName);
        const logPrefix = `[${this.config.agentName}]`;
        const toolByName = new Map(opts.tools.map((t) => [t.name, t]));
        // Codex emits item.started (with args) and item.completed
        // (with result) as separate events. We need args at completion
        // time for tool.didMutate(args, result), so stash them here.
        const argsByCallId = new Map<string, Record<string, unknown>>();

        const events: AgentEvent[] = [];
        const emit = async (event: AgentEvent) => {
            events.push(event);
            await opts.onEvent?.(event);
        };

        let threadId = opts.resumeSessionId;
        let finalText = '';
        let usage: Usage | null = null;
        const maxIterations = opts.maxIterations ?? 100;
        let toolCallCount = 0;
        let hitMaxIterations = false;

        try {
            const Codex = await loadCodexCtor();
            const codex = new Codex({
                codexPathOverride: process.env.CODEX_PATH,
                config: this.buildCodexConfig(opts),
            });
            const threadOptions: ThreadOptions = {
                model: sdkModelId,
                sandboxMode: 'read-only',
                workingDirectory: process.cwd(),
                skipGitRepoCheck: true,
                // Codex's native effort enum matches ours 1:1 (it also
                // exposes 'minimal' which we don't currently surface).
                modelReasoningEffort: opts.effort ?? 'medium',
                networkAccessEnabled: false,
                webSearchMode: 'live',
                approvalPolicy: 'never',
            };
            const thread = threadId
                ? codex.resumeThread(threadId, threadOptions)
                : codex.startThread(threadOptions);
            const { input, cleanup } = await this.buildInput(opts, !!threadId);
            const { events: sdkEvents } = await thread.runStreamed(input);
            const toolCallIds = new Map<string, string>();

            try {
                for await (const sdkEvent of sdkEvents) {
                    if (sdkEvent.type === 'thread.started') {
                        threadId = sdkEvent.thread_id;
                        continue;
                    }
                    if (sdkEvent.type === 'turn.completed') {
                        usage = sdkEvent.usage;
                        continue;
                    }
                    if (sdkEvent.type === 'turn.failed') {
                        throw new Error(sdkEvent.error.message);
                    }
                    if (sdkEvent.type === 'error') {
                        throw new Error(sdkEvent.message);
                    }
                    if (sdkEvent.type === 'item.started') {
                        if (
                            sdkEvent.item.type === 'mcp_tool_call' &&
                            sdkEvent.item.server === mcpKey
                        ) {
                            toolCallCount += 1;
                            if (toolCallCount > maxIterations) {
                                hitMaxIterations = true;
                                throw new Error(`Codex exceeded max tool iterations (${maxIterations})`);
                            }
                        }
                        await translateStartedItem(sdkEvent.item, mcpKey, toolCallIds, argsByCallId, emit);
                        continue;
                    }
                    if (sdkEvent.type === 'item.completed') {
                        if (sdkEvent.item.type === 'agent_message') {
                            finalText = sdkEvent.item.text;
                            await emit({ type: 'message', content: sdkEvent.item.text, at: now() });
                        } else {
                            await translateCompletedItem(sdkEvent.item, mcpKey, toolCallIds, argsByCallId, toolByName, emit);
                        }
                    }
                }
            } finally {
                await cleanup();
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`${logPrefix} Codex SDK stream threw:`, err);
            return {
                finalText: hitMaxIterations
                    ? 'The agent reached its tool-use limit before producing a final answer. Try again or pick a different model.'
                    : `Sorry — the agent crashed: ${msg}. Try again or pick a different model.`,
                events,
                cost: calculateCost(opts.modelId, usage),
                tokens: usageToTokens(usage),
                finishReason: hitMaxIterations ? 'max_iterations' : 'error',
                sessionId: threadId,
            };
        }

        return {
            finalText:
                finalText ||
                'The agent ended without a final answer. Try again or pick a different model.',
            events,
            cost: calculateCost(opts.modelId, usage),
            tokens: usageToTokens(usage),
            finishReason: finalText ? 'final' : 'error',
            sessionId: threadId,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- forwarded through; adapter doesn't inspect ctx.data
    private buildCodexConfig(opts: AgenticRunOptions<any>): NonNullable<CodexOptions['config']> {
        const mcpServerPath = path.resolve(
            process.cwd(),
            this.config.codexMcpServerPath ?? defaultCodexMcpServerPath()
        );
        return {
            model_provider: 'openai',
            hide_agent_reasoning: false,
            model_context_window: getModelById(opts.modelId).maxTokens,
            model_max_output_tokens: getModelById(opts.modelId).maxOutputTokens,
            mcp_servers: {
                [codexMcpServerKeyFor(this.config.agentName)]: {
                    command: process.execPath,
                    args: ['--import=tsx', mcpServerPath],
                    cwd: process.cwd(),
                    env: {
                        ...stringEnv(),
                        [AGENTIC_MCP_CONTEXT_ENV_VAR]: JSON.stringify({
                            userId: opts.toolContext.userId,
                            conversationId: opts.toolContext.conversationId.toHexString(),
                            sourceMessageId: opts.toolContext.sourceMessageId,
                        }),
                    },
                    enabled_tools: opts.tools.map((tool) => tool.name),
                    default_tools_approval_mode: 'approve',
                    startup_timeout_sec: 20,
                    // Generous so human-in-the-loop tools (e.g. ask_user,
                    // which blocks the turn until the user answers) aren't
                    // force-killed mid-wait. Such tools enforce their own
                    // shorter, graceful timeout and return a normal result
                    // well before this hard ceiling.
                    tool_timeout_sec: 360,
                    enabled: true,
                    required: true,
                },
            },
        };
    }

    private async buildInput(
        opts: AgenticRunOptions<unknown>,
        resuming: boolean
    ): Promise<{ input: Input; cleanup: () => Promise<void> }> {
        const prompt = this.buildPrompt(opts, resuming);
        const imageUrls = opts.userImageUrls ?? [];
        if (imageUrls.length === 0) {
            return { input: prompt, cleanup: async () => {} };
        }

        const imagePaths = await Promise.all(
            imageUrls.map((url) => fetchImageToTempFile(url))
        );
        return {
            input: [
                { type: 'text', text: prompt },
                ...imagePaths.map((imagePath) => ({
                    type: 'local_image' as const,
                    path: imagePath,
                })),
            ],
            cleanup: async () => {
                await Promise.all(
                    imagePaths.map((imagePath) =>
                        fs.rm(imagePath, { force: true }).catch(() => {})
                    )
                );
            },
        };
    }

    private buildPrompt(opts: AgenticRunOptions<unknown>, resuming: boolean): string {
        const parts = [
            '=== SYSTEM INSTRUCTIONS ===',
            opts.systemPrompt,
        ];
        if (this.config.codexMcpInstruction) {
            parts.push('', this.config.codexMcpInstruction);
        }

        if (!resuming && opts.history.length > 0) {
            parts.push('', '=== PRIOR CONVERSATION ===');
            for (const message of opts.history) {
                parts.push(`${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`);
            }
        }

        parts.push('', '=== CURRENT USER MESSAGE ===', opts.userText);
        return parts.join('\n');
    }
}

function stringEnv(): Record<string, string> {
    return Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => {
            return typeof entry[1] === 'string';
        })
    );
}

function extensionForContentType(contentType: string | null): string {
    const lower = contentType?.toLowerCase() ?? '';
    if (lower.includes('jpeg') || lower.includes('jpg')) return '.jpg';
    if (lower.includes('gif')) return '.gif';
    if (lower.includes('webp')) return '.webp';
    return '.png';
}

async function fetchImageToTempFile(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch image attachment (${res.status}): ${url}`);
    }

    const contentType = res.headers.get('content-type');
    const ext = extensionForContentType(contentType);
    const filePath = path.join(os.tmpdir(), `codex-image-${randomUUID()}${ext}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(filePath, bytes);
    return filePath;
}

async function translateStartedItem(
    item: ThreadItem,
    mcpKey: string,
    toolCallIds: Map<string, string>,
    argsByCallId: Map<string, Record<string, unknown>>,
    emit: (e: AgentEvent) => Promise<void>
): Promise<void> {
    if (item.type === 'reasoning' && item.text.trim()) {
        await emit({ type: 'thinking', content: item.text, at: now() });
        return;
    }
    if (item.type === 'web_search') {
        // The query is only populated once the search runs, so the "started"
        // item usually has an empty query. Emit the tool_call here only when we
        // already know the query; otherwise defer to the completed item (which
        // carries the real query), so the trace records what was actually
        // searched instead of an empty string.
        if (item.query) {
            toolCallIds.set(item.id, item.id);
            await emit({
                type: 'tool_call',
                callId: item.id,
                name: 'web_search',
                args: { query: item.query },
                at: now(),
            });
        }
        return;
    }
    if (item.type !== 'mcp_tool_call' || item.server !== mcpKey) return;

    const callId = item.id;
    const args = normalizeArgs(item.arguments);
    toolCallIds.set(item.id, callId);
    argsByCallId.set(item.id, args);
    await emit({
        type: 'tool_call',
        callId,
        name: item.tool,
        args,
        at: now(),
    });
}

async function translateCompletedItem(
    item: ThreadItem,
    mcpKey: string,
    toolCallIds: Map<string, string>,
    argsByCallId: Map<string, Record<string, unknown>>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool shapes
    toolByName: Map<string, AgenticTool<any, any>>,
    emit: (e: AgentEvent) => Promise<void>
): Promise<void> {
    if (item.type === 'reasoning' && item.text.trim()) {
        await emit({ type: 'thinking', content: item.text, at: now() });
        return;
    }
    if (item.type === 'web_search') {
        const callId = toolCallIds.get(item.id) ?? item.id;
        if (!toolCallIds.has(item.id)) {
            await emit({
                type: 'tool_call',
                callId,
                name: 'web_search',
                args: { query: item.query },
                at: now(),
            });
        }
        await emit({
            type: 'tool_result',
            callId,
            name: 'web_search',
            ok: true,
            truncated: false,
            wrote: false,
            summary: 'Search completed',
            at: now(),
        });
        toolCallIds.delete(item.id);
        return;
    }
    if (item.type !== 'mcp_tool_call' || item.server !== mcpKey) return;

    const callId = toolCallIds.get(item.id) ?? item.id;
    const args = argsByCallId.get(item.id) ?? normalizeArgs(item.arguments);
    if (!toolCallIds.has(item.id)) {
        await emit({
            type: 'tool_call',
            callId,
            name: item.tool,
            args,
            at: now(),
        });
    }

    const result = extractToolResult(item);
    const tool = toolByName.get(item.tool);
    await emit({
        type: 'tool_result',
        callId,
        name: item.tool,
        ok: result.ok,
        truncated: !!result.truncated,
        wrote: tool?.didMutate?.(args as never, result) ?? false,
        summary: summarizeToolResult(item.tool, result),
        at: now(),
    });
    toolCallIds.delete(item.id);
    argsByCallId.delete(item.id);
}

function normalizeArgs(args: unknown): Record<string, unknown> {
    return args && typeof args === 'object' && !Array.isArray(args)
        ? (args as Record<string, unknown>)
        : {};
}
