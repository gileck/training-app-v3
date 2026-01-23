/**
 * Cursor CLI Adapter
 *
 * Adapter implementation for Cursor's cursor-agent CLI tool.
 *
 * Prerequisites:
 * - Install Cursor CLI: curl https://cursor.com/install -fsS | bash
 * - Login: cursor-agent login
 * - Active Cursor subscription
 *
 * CLI Reference:
 * - cursor-agent "prompt" -p - Run agent with prompt in print mode
 * - -p, --print - Print mode for non-interactive use
 * - --force - Allow write operations
 * - --output-format json|stream-json - Output format
 * - --model <model> - Specify model (e.g., sonnet-4)
 */

import { spawn } from 'child_process';
import type { AgentLibraryAdapter, AgentLibraryCapabilities, AgentRunOptions, AgentRunResult } from '../types';
import {
    getCurrentLogContext,
    logPrompt,
    logTextResponse,
    logToolCall,
    logTokenUsage,
} from '../logging';

// ============================================================
// CONSTANTS
// ============================================================

const CURSOR_CLI_COMMAND = 'cursor-agent';
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PROJECT_ROOT = process.cwd();
const DEFAULT_TIMEOUT_SECONDS = 300; // 5 minutes

/**
 * Default model for Cursor CLI
 * Claude Opus 4.5 - Anthropic's flagship model for coding and agentic tasks
 */
const DEFAULT_MODEL = 'opus-4.5';

// ============================================================
// TYPES
// ============================================================

/**
 * Cursor CLI stream event types
 */
interface CursorStreamEvent {
    type: 'start' | 'text' | 'tool_use' | 'tool_result' | 'result' | 'error';
    content?: string;
    name?: string;          // Tool name for tool_use events
    path?: string;          // File path for read_file tool
    input?: Record<string, unknown>; // Tool input
    tool_call_id?: string;  // Tool call identifier
    session_id?: string;
    result?: string;        // Final result content
    error?: string;         // Error message
    files_modified?: string[];
    duration_ms?: number;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        total_cost_usd?: number;
    };
}

/**
 * Result from executing the Cursor CLI
 */
interface CursorExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
}

// ============================================================
// CURSOR ADAPTER
// ============================================================

class CursorAdapter implements AgentLibraryAdapter {
    readonly name = 'cursor';
    readonly capabilities: AgentLibraryCapabilities = {
        streaming: true,
        fileRead: true,
        fileWrite: true,
        webFetch: false, // Cursor CLI does not support web fetch
        customTools: false, // Cursor uses its own tool set
        timeout: true,
    };

    private initialized = false;

    async init(): Promise<void> {
        // Verify cursor-agent is available
        try {
            const { exitCode } = await this.executeCommand(['--version'], {
                timeout: 5000,
                suppressOutput: true,
            });
            if (exitCode !== 0) {
                throw new Error('cursor-agent command returned non-zero exit code');
            }
        } catch (error) {
            throw new Error(
                `Cursor CLI not available. Please install it:\n` +
                `  curl https://cursor.com/install -fsS | bash\n` +
                `Then login: cursor-agent login\n` +
                `Error: ${error instanceof Error ? error.message : String(error)}`
            );
        }

        // Verify authentication status
        try {
            const { stdout } = await this.executeCommand(['status'], {
                timeout: 5000,
                suppressOutput: true,
            });
            if (stdout.toLowerCase().includes('not logged in')) {
                throw new Error(
                    `Cursor CLI not authenticated. Please login:\n` +
                    `  cursor-agent login`
                );
            }
            this.initialized = true;
        } catch (error) {
            // If status check fails with auth error, throw it
            if (error instanceof Error && error.message.includes('not authenticated')) {
                throw error;
            }
            // Otherwise, assume status command isn't available and proceed
            this.initialized = true;
        }
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async run(options: AgentRunOptions): Promise<AgentRunResult> {
        const {
            prompt,
            allowWrite = false,
            stream = false,
            timeout = DEFAULT_TIMEOUT_SECONDS,
            progressLabel = 'Processing',
        } = options;

        const startTime = Date.now();
        let toolCallCount = 0;
        const filesExamined: string[] = [];
        let lastResult = '';

        let spinnerInterval: NodeJS.Timeout | null = null;
        let spinnerFrame = 0;

        // Build CLI arguments
        const args = this.buildArgs(prompt, {
            allowWrite,
            stream,
        });

        // Log prompt if context is available
        const logCtx = getCurrentLogContext();
        if (logCtx) {
            logPrompt(logCtx, prompt, {
                model: 'cursor-agent',
                tools: allowWrite ? ['read', 'write', 'edit', 'bash'] : ['read'],
                timeout,
            });
        }

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
            // Execute with streaming support
            if (stream) {
                const result = await this.executeWithStreaming(
                    args,
                    {
                        timeout: timeout * 1000,
                        onEvent: (event) => {
                            const elapsed = Math.floor((Date.now() - startTime) / 1000);

                            if (event.type === 'text' && event.content) {
                                // Log text response
                                if (logCtx) {
                                    logTextResponse(logCtx, event.content);
                                }
                                console.log(`    \x1b[90m${event.content}\x1b[0m`);
                                lastResult = event.content;
                            }

                            if (event.type === 'tool_use') {
                                toolCallCount++;
                                const toolName = event.name || 'unknown';
                                const toolInput = event.input || {};

                                // Log tool call
                                if (logCtx) {
                                    logToolCall(logCtx, event.tool_call_id || '', toolName, toolInput);
                                }

                                // Track files examined
                                if (toolName === 'read_file' && event.path) {
                                    const filePath = event.path.replace(PROJECT_ROOT + '/', '');
                                    if (!filesExamined.includes(filePath)) {
                                        filesExamined.push(filePath);
                                    }
                                }

                                // Display tool use
                                let target = '';
                                if (event.path) {
                                    target = ` → ${event.path.split('/').slice(-2).join('/')}`;
                                }
                                console.log(`  \x1b[36m[${elapsed}s] Tool: ${toolName}${target}\x1b[0m`);
                            }

                            if (event.type === 'result') {
                                if (event.result) {
                                    lastResult = event.result;
                                }
                            }
                        },
                    }
                );

                const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
                const usage = this.extractUsageFromResult(result.stdout);

                // Log usage if available
                if (logCtx && usage) {
                    logTokenUsage(logCtx, {
                        inputTokens: usage.inputTokens,
                        outputTokens: usage.outputTokens,
                        cost: usage.totalCostUSD,
                    });
                }

                // Format usage info for display
                let usageInfo = '';
                if (usage) {
                    const totalTokens = usage.inputTokens + usage.outputTokens;
                    usageInfo = `, ${totalTokens.toLocaleString()} tokens, $${usage.totalCostUSD.toFixed(4)}`;
                }

                if (result.timedOut) {
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

                if (result.exitCode !== 0 && !lastResult) {
                    console.log(`\r  \x1b[31m✗ Error (exit code ${result.exitCode})\x1b[0m\x1b[K`);
                    return {
                        success: false,
                        content: null,
                        error: result.stderr || `Exit code ${result.exitCode}`,
                        filesExamined,
                        usage,
                        durationSeconds,
                    };
                }

                console.log(`  \x1b[32m✓ ${progressLabel} complete (${durationSeconds}s, ${toolCallCount} tool calls${usageInfo})\x1b[0m`);

                return {
                    success: true,
                    content: lastResult,
                    filesExamined,
                    usage,
                    durationSeconds,
                };
            } else {
                // Non-streaming execution
                const result = await this.executeCommand(args, {
                    timeout: timeout * 1000,
                });

                // Cleanup spinner
                if (spinnerInterval) {
                    clearInterval(spinnerInterval);
                    spinnerInterval = null;
                }

                const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
                const { content, files, usage, toolCalls } = this.parseOutput(result.stdout);
                toolCallCount = toolCalls;

                // Track files examined from parsed output
                for (const file of files) {
                    if (!filesExamined.includes(file)) {
                        filesExamined.push(file);
                    }
                }

                // Log usage if available
                if (logCtx && usage) {
                    logTokenUsage(logCtx, {
                        inputTokens: usage.inputTokens,
                        outputTokens: usage.outputTokens,
                        cost: usage.totalCostUSD,
                    });
                }

                // Format usage info for display
                let usageInfo = '';
                if (usage) {
                    const totalTokens = usage.inputTokens + usage.outputTokens;
                    usageInfo = `, ${totalTokens.toLocaleString()} tokens, $${usage.totalCostUSD.toFixed(4)}`;
                }

                if (result.timedOut) {
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

                if (result.exitCode !== 0 && !content) {
                    console.log(`\r  \x1b[31m✗ Error (exit code ${result.exitCode})\x1b[0m\x1b[K`);
                    return {
                        success: false,
                        content: null,
                        error: result.stderr || `Exit code ${result.exitCode}`,
                        filesExamined,
                        usage,
                        durationSeconds,
                    };
                }

                console.log(`\r  \x1b[32m✓ ${progressLabel} complete (${durationSeconds}s, ${toolCallCount} tool calls${usageInfo})\x1b[0m\x1b[K`);

                return {
                    success: true,
                    content: content || lastResult,
                    filesExamined,
                    usage,
                    durationSeconds,
                };
            }
        } catch (error) {
            // Cleanup spinner
            if (spinnerInterval) {
                clearInterval(spinnerInterval);
            }

            const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
            console.log(`\r  \x1b[31m✗ Error\x1b[0m\x1b[K`);

            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : String(error),
                filesExamined,
                usage: null,
                durationSeconds,
            };
        }
    }

    async dispose(): Promise<void> {
        this.initialized = false;
    }

    // ============================================================
    // PRIVATE METHODS
    // ============================================================

    /**
     * Build CLI arguments from options
     */
    private buildArgs(prompt: string, options: {
        allowWrite?: boolean;
        stream?: boolean;
    }): string[] {
        const args = [prompt];

        // Use -p (print) for non-interactive mode
        args.push('-p');

        // Specify model
        args.push('--model', DEFAULT_MODEL);

        // Output format: stream-json for streaming, json for non-streaming
        args.push('--output-format', options.stream ? 'stream-json' : 'json');

        // Allow write operations
        if (options.allowWrite) {
            args.push('--force');
        }

        return args;
    }

    /**
     * Execute Cursor CLI command
     */
    private async executeCommand(
        args: string[],
        options: {
            timeout?: number;
            suppressOutput?: boolean;
        } = {}
    ): Promise<CursorExecutionResult> {
        const { timeout = 30000, suppressOutput = false } = options;

        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let timeoutId: NodeJS.Timeout | null = null;

            const proc = spawn(CURSOR_CLI_COMMAND, args, {
                cwd: PROJECT_ROOT,
                env: { ...process.env },
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            // Close stdin immediately - CLI doesn't need input
            proc.stdin?.end();

            // Set up timeout
            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    timedOut = true;
                    proc.kill('SIGTERM');
                    // Force kill after 5 seconds if not terminated
                    setTimeout(() => {
                        if (!proc.killed) {
                            proc.kill('SIGKILL');
                        }
                    }, 5000);
                }, timeout);
            }

            proc.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
                if (!suppressOutput) {
                    process.stderr.write(data);
                }
            });

            proc.on('close', (code) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                resolve({
                    stdout,
                    stderr,
                    exitCode: code ?? 1,
                    timedOut,
                });
            });

            proc.on('error', (error) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                resolve({
                    stdout,
                    stderr: error.message,
                    exitCode: 1,
                    timedOut,
                });
            });
        });
    }

    /**
     * Execute with streaming event handling
     */
    private async executeWithStreaming(
        args: string[],
        options: {
            timeout?: number;
            onEvent?: (event: CursorStreamEvent) => void;
        } = {}
    ): Promise<CursorExecutionResult> {
        const { timeout = 300000, onEvent } = options;

        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let timeoutId: NodeJS.Timeout | null = null;
            let buffer = '';

            const proc = spawn(CURSOR_CLI_COMMAND, args, {
                cwd: PROJECT_ROOT,
                env: { ...process.env },
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            // Close stdin immediately - CLI doesn't need input
            proc.stdin?.end();

            // Set up timeout
            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    timedOut = true;
                    proc.kill('SIGTERM');
                    setTimeout(() => {
                        if (!proc.killed) {
                            proc.kill('SIGKILL');
                        }
                    }, 5000);
                }, timeout);
            }

            proc.stdout?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                stdout += chunk;
                buffer += chunk;

                // Try to parse JSON events from buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.trim()) {
                        this.tryParseStreamEvent(line.trim(), onEvent);
                    }
                }
            });

            proc.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                // Process any remaining buffer
                if (buffer.trim()) {
                    this.tryParseStreamEvent(buffer.trim(), onEvent);
                }

                resolve({
                    stdout,
                    stderr,
                    exitCode: code ?? 1,
                    timedOut,
                });
            });

            proc.on('error', (error) => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                resolve({
                    stdout,
                    stderr: error.message,
                    exitCode: 1,
                    timedOut,
                });
            });
        });
    }

    /**
     * Try to parse a stream event line
     */
    private tryParseStreamEvent(
        line: string,
        onEvent?: (event: CursorStreamEvent) => void
    ): void {
        if (!onEvent) return;

        try {
            const event = JSON.parse(line) as CursorStreamEvent;
            if (event && typeof event === 'object' && 'type' in event) {
                onEvent(event);
            }
        } catch {
            // Not valid JSON, might be plain text output
            // Try to infer event type from content
            if (line.startsWith('{') || line.startsWith('[')) {
                // Malformed JSON, skip
                return;
            }
            // Treat as text content
            onEvent({ type: 'text', content: line });
        }
    }

    /**
     * Parse non-streaming JSON output
     */
    private parseOutput(output: string): {
        content: string | null;
        files: string[];
        usage: AgentRunResult['usage'];
        toolCalls: number;
    } {
        const result = {
            content: null as string | null,
            files: [] as string[],
            usage: null as AgentRunResult['usage'],
            toolCalls: 0,
        };

        if (!output.trim()) {
            return result;
        }

        try {
            // Try to parse as single JSON object
            const parsed = JSON.parse(output);

            if (parsed.result) {
                result.content = parsed.result;
            } else if (parsed.content) {
                result.content = parsed.content;
            }

            if (parsed.files_modified) {
                result.files = parsed.files_modified;
            }

            if (parsed.files_examined) {
                result.files = [...result.files, ...parsed.files_examined];
            }

            if (parsed.usage) {
                result.usage = {
                    inputTokens: parsed.usage.input_tokens ?? 0,
                    outputTokens: parsed.usage.output_tokens ?? 0,
                    cacheReadInputTokens: 0,
                    cacheCreationInputTokens: 0,
                    totalCostUSD: parsed.usage.total_cost_usd ?? 0,
                };
            }

            if (parsed.tool_calls_count !== undefined) {
                result.toolCalls = parsed.tool_calls_count;
            }

            return result;
        } catch {
            // Not valid JSON, try line-by-line parsing
            const lines = output.split('\n');
            const jsonLines: CursorStreamEvent[] = [];

            for (const line of lines) {
                if (line.trim().startsWith('{')) {
                    try {
                        const event = JSON.parse(line.trim()) as CursorStreamEvent;
                        jsonLines.push(event);
                    } catch {
                        // Skip invalid JSON lines
                    }
                }
            }

            // Extract data from parsed events
            for (const event of jsonLines) {
                if (event.type === 'result' && event.result) {
                    result.content = event.result;
                }
                if (event.type === 'tool_use') {
                    result.toolCalls++;
                    if (event.path) {
                        result.files.push(event.path.replace(PROJECT_ROOT + '/', ''));
                    }
                }
                if (event.usage) {
                    result.usage = {
                        inputTokens: event.usage.input_tokens ?? 0,
                        outputTokens: event.usage.output_tokens ?? 0,
                        cacheReadInputTokens: 0,
                        cacheCreationInputTokens: 0,
                        totalCostUSD: event.usage.total_cost_usd ?? 0,
                    };
                }
            }

            // If no content found, use raw output
            if (!result.content && output.trim()) {
                result.content = output.trim();
            }

            return result;
        }
    }

    /**
     * Extract usage statistics from raw output
     */
    private extractUsageFromResult(output: string): AgentRunResult['usage'] {
        try {
            // Try to find JSON with usage info
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(line.trim());
                        if (parsed.usage) {
                            return {
                                inputTokens: parsed.usage.input_tokens ?? 0,
                                outputTokens: parsed.usage.output_tokens ?? 0,
                                cacheReadInputTokens: 0,
                                cacheCreationInputTokens: 0,
                                totalCostUSD: parsed.usage.total_cost_usd ?? 0,
                            };
                        }
                    } catch {
                        // Continue searching
                    }
                }
            }
        } catch {
            // Ignore parsing errors
        }
        return null;
    }
}

// Export singleton instance
const cursorAdapter = new CursorAdapter();
export default cursorAdapter;
