/**
 * Claude Code SDK Adapter
 *
 * Adapter implementation for @anthropic-ai/claude-agent-sdk
 */

import { query, type SDKAssistantMessage, type SDKResultMessage, type SDKToolProgressMessage } from '@anthropic-ai/claude-agent-sdk';
import { agentConfig } from '../../shared/config';
import type { AgentLibraryAdapter, AgentLibraryCapabilities, AgentRunOptions, AgentRunResult } from '../types';

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
    };

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
        } = options;

        // Determine allowed tools
        const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebFetch'];
        const writeTools = ['Edit', 'Write', 'Bash'];
        const allowedTools = customTools || (allowWrite
            ? [...readOnlyTools, ...writeTools]
            : readOnlyTools);

        const startTime = Date.now();
        let lastResult = '';
        let toolCallCount = 0;
        const filesExamined: string[] = [];
        let usage: AgentRunResult['usage'] = null;

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

        try {
            for await (const message of query({
                prompt,
                options: {
                    allowedTools,
                    cwd: PROJECT_ROOT,
                    model: agentConfig.claude.model,
                    maxTurns: agentConfig.claude.maxTurns,
                    permissionMode: 'bypassPermissions',
                    allowDangerouslySkipPermissions: true,
                    abortController,
                    ...(useSlashCommands ? { settingSources: ['project'] as const } : {}),
                },
            })) {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);

                // Handle assistant messages
                if (message.type === 'assistant') {
                    const assistantMsg = message as SDKAssistantMessage;

                    // Extract text content
                    const textParts: string[] = [];
                    for (const block of assistantMsg.message.content) {
                        if (block.type === 'text') {
                            textParts.push((block as { type: 'text'; text: string }).text);
                        }
                    }
                    const textContent = textParts.join('\n');

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
                    const resultMsg = message as SDKResultMessage;
                    if (resultMsg.subtype === 'success' && resultMsg.result) {
                        lastResult = resultMsg.result;
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
                    }
                }
            }

            // Cleanup
            clearTimeout(timeoutId);
            if (spinnerInterval) clearInterval(spinnerInterval);

            const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

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
            };
        } catch (error) {
            // Cleanup
            clearTimeout(timeoutId);
            if (spinnerInterval) clearInterval(spinnerInterval);

            const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

            // Check if it was a timeout
            if (abortController.signal.aborted) {
                console.log(`\r  \x1b[31m✗ Timeout after ${timeout}s\x1b[0m\x1b[K`);
                return {
                    success: false,
                    content: null,
                    error: `Timed out after ${timeout} seconds`,
                    filesExamined,
                    usage,
                    durationSeconds,
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
            };
        }
    }

    async dispose(): Promise<void> {
        // No cleanup required for Claude Code SDK
        this.initialized = false;
    }
}

// Export singleton instance
const claudeCodeSDKAdapter = new ClaudeCodeSDKAdapter();
export default claudeCodeSDKAdapter;
