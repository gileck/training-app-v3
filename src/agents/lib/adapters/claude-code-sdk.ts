/**
 * Claude Code SDK Adapter
 *
 * Adapter implementation for @anthropic-ai/claude-agent-sdk
 */

import { query, type SDKAssistantMessage, type SDKResultMessage, type SDKToolProgressMessage, type HookCallbackMatcher } from '@anthropic-ai/claude-agent-sdk';
import { agentConfig } from '../../shared/config';
import type { AgentLibraryAdapter, AgentLibraryCapabilities, AgentRunOptions, AgentRunResult } from '../types';
import { getModelForLibrary } from '../config';
import {
    getCurrentLogContext,
    logPrompt,
    logTextResponse,
    logThinking,
    logToolCall,
    logTokenUsage,
} from '../logging';

// ============================================================
// CONSTANTS
// ============================================================

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PROJECT_ROOT = process.cwd();

// ============================================================
// CLAUDE CODE SDK ADAPTER
// ============================================================

class ClaudeCodeSDKAdapter implements AgentLibraryAdapter {
    readonly name = 'claude-code-sdk';
    readonly capabilities: AgentLibraryCapabilities = {
        streaming: true,
        fileRead: true,
        fileWrite: true,
        webFetch: true,
        customTools: true,
        timeout: true,
        planMode: true, // Supports plan mode via read-only tools
    };

    get model(): string {
        return getModelForLibrary('claude-code-sdk');
    }

    private initialized = false;

    async init(): Promise<void> {
        // No initialization required for Claude Code SDK
        this.initialized = true;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async run(options: AgentRunOptions): Promise<AgentRunResult> {
        const {
            prompt,
            allowedTools: customTools,
            allowWrite = false,
            stream = false,
            verbose = false,
            timeout = agentConfig.claude.timeoutSeconds,
            progressLabel = 'Processing',
            useSlashCommands = false,
            outputFormat,
            mcpServers,
            additionalTools,
            maxTurns,
        } = options;

        // Determine allowed tools
        const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebFetch'];
        const writeTools = ['Edit', 'Write', 'Bash'];
        let allowedTools = customTools || (allowWrite
            ? [...readOnlyTools, ...writeTools]
            : readOnlyTools);

        // Add additional tools if specified
        if (additionalTools && additionalTools.length > 0) {
            allowedTools = [...allowedTools, ...additionalTools];
        }

        const startTime = Date.now();
        let lastResult = '';
        let toolCallCount = 0;
        const filesExamined: string[] = [];
        let usage: AgentRunResult['usage'] = null;
        let structuredOutput: unknown = undefined;

        // Track SDK-level errors (error_max_turns, error_max_structured_output_retries, etc.)
        let sdkError: { subtype: string; errors: string[] } | null = null;

        // Timeout diagnostics tracking
        interface ToolCallRecord {
            name: string;
            target: string;  // file path or command summary
            timestamp: number;
            id: string;
        }
        const toolCallHistory: ToolCallRecord[] = [];
        let lastToolCallTime = 0;
        let lastToolResponseTime = 0;
        let pendingToolCall: ToolCallRecord | null = null;

        let spinnerInterval: NodeJS.Timeout | null = null;
        let spinnerFrame = 0;

        // Set up timeout abort controller
        const abortController = new AbortController();
        const timeoutMs = timeout * 1000;
        const timeoutId = setTimeout(() => {
            abortController.abort();
        }, timeoutMs);

        // Start spinner if not streaming
        if (!stream) {
            spinnerInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
                const timeoutInfo = timeout > 0 ? `/${timeout}s` : '';
                process.stdout.write(`\r  ${frame} ${progressLabel}... (${elapsed}s${timeoutInfo}, ${toolCallCount} tools)\x1b[K`);
                spinnerFrame++;
            }, 100);
        }

        // Log prompt if context is available
        const logCtx = getCurrentLogContext();
        if (logCtx) {
            logPrompt(logCtx, prompt, {
                model: this.model,
                tools: allowedTools,
                timeout,
            });
        }

        // Build PreToolUse hook for path restriction (if configured)
        const hooks = this.buildWritePathHooks(options.allowedWritePaths);

        try {
            for await (const message of query({
                prompt,
                options: {
                    allowedTools,
                    cwd: PROJECT_ROOT,
                    model: this.model as 'sonnet' | 'opus' | 'haiku',
                    maxTurns: maxTurns ?? agentConfig.claude.maxTurns,
                    permissionMode: 'bypassPermissions',
                    allowDangerouslySkipPermissions: true,
                    abortController,
                    ...(useSlashCommands ? { settingSources: ['project'] as const } : {}),
                    ...(outputFormat ? { outputFormat } : {}),
                    ...(mcpServers ? { mcpServers } : {}),
                    ...(hooks ? { hooks } : {}),
                },
            })) {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);

                // Handle assistant messages
                if (message.type === 'assistant') {
                    const assistantMsg = message as SDKAssistantMessage;

                    // Extract text content and thinking blocks
                    const textParts: string[] = [];
                    const thinkingParts: string[] = [];
                    for (const block of assistantMsg.message.content) {
                        if (block.type === 'text') {
                            textParts.push((block as { type: 'text'; text: string }).text);
                        }
                        // Check for thinking blocks if available
                        if (block.type === 'thinking') {
                            thinkingParts.push((block as { type: 'thinking'; thinking: string }).thinking);
                        }
                    }
                    const textContent = textParts.join('\n');

                    // Log thinking blocks if context is available
                    if (logCtx && thinkingParts.length > 0) {
                        for (const thinking of thinkingParts) {
                            logThinking(logCtx, thinking);
                        }
                    }

                    // Log text content if context is available
                    if (logCtx && textContent) {
                        logTextResponse(logCtx, textContent);
                    }

                    // Stream output if enabled
                    if (textContent && stream) {
                        const lines = textContent.split('\n').filter((l: string) => l.trim());
                        for (const line of lines) {
                            console.log(`    \x1b[90m${line}\x1b[0m`);
                        }
                    }

                    // Track tool uses
                    for (const block of assistantMsg.message.content) {
                        if (block.type === 'tool_use') {
                            toolCallCount++;
                            const toolUse = block as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
                            const toolName = toolUse.name;
                            const toolInput = toolUse.input;
                            const toolId = toolUse.id;

                            // Log tool call if context is available
                            if (logCtx) {
                                logToolCall(logCtx, toolId, toolName, toolInput);
                            }

                            // Track files examined
                            if (toolName === 'Read' && toolInput?.file_path) {
                                const filePath = String(toolInput.file_path).replace(PROJECT_ROOT + '/', '');
                                if (!filesExamined.includes(filePath)) {
                                    filesExamined.push(filePath);
                                }
                            }

                            // Log tool use if streaming
                            if (stream) {
                                let target = '';
                                if (toolInput) {
                                    if (toolInput.file_path) {
                                        target = ` → ${String(toolInput.file_path).split('/').slice(-2).join('/')}`;
                                    } else if (toolInput.pattern) {
                                        target = ` → "${toolInput.pattern}"`;
                                    }
                                }
                                console.log(`  \x1b[36m[${elapsed}s] Tool: ${toolName}${target}\x1b[0m`);
                            }

                            // Track for timeout diagnostics
                            const diagTarget = toolInput?.file_path
                                ? String(toolInput.file_path).replace(PROJECT_ROOT + '/', '')
                                : toolInput?.command
                                    ? String(toolInput.command).slice(0, 100)
                                    : toolInput?.pattern
                                        ? String(toolInput.pattern)
                                        : '';
                            lastToolCallTime = Date.now();
                            pendingToolCall = { name: toolName, target: diagTarget, timestamp: Date.now(), id: toolId };
                            toolCallHistory.push(pendingToolCall);
                            if (toolCallHistory.length > 10) toolCallHistory.shift();
                        }
                    }

                    // Keep track of last text content
                    if (textContent) {
                        lastResult = textContent;
                    }
                }

                // Handle tool progress
                if (message.type === 'tool_progress') {
                    const progressMsg = message as SDKToolProgressMessage;
                    if (stream && verbose) {
                        const elapsed = Math.floor((Date.now() - startTime) / 1000);
                        console.log(`  \x1b[33m[${elapsed}s] Running ${progressMsg.tool_name}...\x1b[0m`);
                    }
                }

                // Handle final result
                if (message.type === 'result') {
                    // Clear pending tool call on result
                    lastToolResponseTime = Date.now();
                    pendingToolCall = null;

                    const resultMsg = message as SDKResultMessage;
                    if (resultMsg.subtype === 'success' && resultMsg.result) {
                        lastResult = resultMsg.result;
                    } else if (resultMsg.subtype !== 'success') {
                        // SDK returned an error result (error_max_turns, error_max_structured_output_retries, etc.)
                        // Store error information to return as failure after loop completes
                        sdkError = {
                            subtype: resultMsg.subtype,
                            errors: 'errors' in resultMsg ? resultMsg.errors : [],
                        };
                    }
                    // Extract usage stats
                    if (resultMsg.usage) {
                        usage = {
                            inputTokens: resultMsg.usage.input_tokens ?? 0,
                            outputTokens: resultMsg.usage.output_tokens ?? 0,
                            cacheReadInputTokens: resultMsg.usage.cache_read_input_tokens ?? 0,
                            cacheCreationInputTokens: resultMsg.usage.cache_creation_input_tokens ?? 0,
                            totalCostUSD: resultMsg.total_cost_usd ?? 0,
                        };

                        // Log token usage if context is available
                        if (logCtx) {
                            logTokenUsage(logCtx, {
                                inputTokens: usage.inputTokens,
                                outputTokens: usage.outputTokens,
                                cost: usage.totalCostUSD,
                                cacheReadInputTokens: usage.cacheReadInputTokens,
                                cacheCreationInputTokens: usage.cacheCreationInputTokens,
                            });
                        }
                    }
                    // Extract structured output (only present on success results)
                    if ('structured_output' in resultMsg) {
                        structuredOutput = resultMsg.structured_output;
                    }
                }
            }

            // Cleanup
            clearTimeout(timeoutId);
            if (spinnerInterval) clearInterval(spinnerInterval);

            const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

            // Check if SDK returned an error result
            if (sdkError) {
                const errorDetails = sdkError.errors.length > 0 ? ` - ${sdkError.errors.join(', ')}` : '';
                console.log(`\r  \x1b[31m✗ SDK error: ${sdkError.subtype}${errorDetails}\x1b[0m\x1b[K`);
                return {
                    success: false,
                    content: null,
                    error: `SDK error: ${sdkError.subtype}${errorDetails}`,
                    filesExamined,
                    usage,
                    durationSeconds,
                    structuredOutput,
                    toolCallsCount: toolCallCount,
                };
            }

            // Format usage info for display
            let usageInfo = '';
            if (usage) {
                const totalTokens = usage.inputTokens + usage.outputTokens;
                usageInfo = `, ${totalTokens.toLocaleString()} tokens, $${usage.totalCostUSD.toFixed(4)}`;
            }
            console.log(`\r  \x1b[32m✓ ${progressLabel} complete (${durationSeconds}s, ${toolCallCount} tool calls${usageInfo})\x1b[0m\x1b[K`);

            return {
                success: true,
                content: lastResult,
                filesExamined,
                usage,
                durationSeconds,
                structuredOutput,
                toolCallsCount: toolCallCount,
            };
        } catch (error) {
            // Cleanup
            clearTimeout(timeoutId);
            if (spinnerInterval) clearInterval(spinnerInterval);

            const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

            // Check if it was a timeout
            if (abortController.signal.aborted) {
                const timeSinceLastToolCall = lastToolCallTime > 0 ? Date.now() - lastToolCallTime : 0;
                const timeSinceLastResponse = lastToolResponseTime > 0 ? Date.now() - lastToolResponseTime : 0;

                let classification: string;
                if (pendingToolCall && timeSinceLastToolCall > 120000) {
                    classification = `Tool hang: ${pendingToolCall.name} did not return (${Math.floor(timeSinceLastToolCall / 1000)}s)`;
                } else if (lastToolResponseTime > 0 && timeSinceLastResponse > 120000) {
                    classification = `API timeout: no response for ${Math.floor(timeSinceLastResponse / 1000)}s after last tool result`;
                } else {
                    classification = `Session timeout: exceeded ${timeout}s total`;
                }

                console.log(`\r  \x1b[31m✗ Timeout after ${timeout}s (${classification})\x1b[0m\x1b[K`);
                return {
                    success: false,
                    content: null,
                    error: `Timed out after ${timeout} seconds`,
                    filesExamined,
                    usage,
                    durationSeconds,
                    structuredOutput,
                    toolCallsCount: toolCallCount,
                    timeoutDiagnostics: {
                        classification,
                        lastToolCalls: toolCallHistory.slice(-10),
                        pendingToolCall,
                        totalToolCalls: toolCallCount,
                        timeSinceLastToolCall: Math.floor(timeSinceLastToolCall / 1000),
                        timeSinceLastResponse: Math.floor(timeSinceLastResponse / 1000),
                    },
                };
            }

            console.log(`\r  \x1b[31m✗ Error\x1b[0m\x1b[K`);
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : String(error),
                filesExamined,
                usage,
                durationSeconds,
                structuredOutput,
                toolCallsCount: toolCallCount,
            };
        }
    }

    /**
     * Build PreToolUse hooks to restrict Write/Edit to specific path prefixes.
     * Returns undefined if no restrictions are configured.
     */
    private buildWritePathHooks(
        allowedWritePaths?: string[]
    ): Partial<Record<'PreToolUse', HookCallbackMatcher[]>> | undefined {
        if (!allowedWritePaths || allowedWritePaths.length === 0) return undefined;

        const writePathHook: HookCallbackMatcher = {
            matcher: 'Write|Edit',
            hooks: [
                async (input) => {
                    const hookInput = input as { tool_name: string; tool_input: { file_path?: string } };
                    const filePath = hookInput.tool_input?.file_path;
                    if (!filePath) return {};

                    // Normalize to relative path for comparison
                    const relativePath = filePath.startsWith(PROJECT_ROOT)
                        ? filePath.slice(PROJECT_ROOT.length + 1)
                        : filePath.startsWith('/')
                            ? filePath // absolute path outside project — always deny
                            : filePath;

                    const isAllowed = allowedWritePaths.some(prefix => relativePath.startsWith(prefix));
                    if (isAllowed) return {};

                    return {
                        hookSpecificOutput: {
                            hookEventName: 'PreToolUse' as const,
                            permissionDecision: 'deny' as const,
                            permissionDecisionReason: `Write blocked: ${relativePath} is outside allowed paths (${allowedWritePaths.join(', ')}). Only write to the allowed directories.`,
                        },
                    };
                },
            ],
        };

        return { PreToolUse: [writePathHook] };
    }

    async dispose(): Promise<void> {
        // No cleanup required for Claude Code SDK
        this.initialized = false;
    }
}

// Export singleton instance
const claudeCodeSDKAdapter = new ClaudeCodeSDKAdapter();
export default claudeCodeSDKAdapter;
