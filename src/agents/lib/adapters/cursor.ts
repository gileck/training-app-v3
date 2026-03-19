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
 *
 * MCP Support:
 * - MCP servers are configured via .cursor/mcp.json
 * - Pass mcpServers in AgentRunOptions to enable MCP tools
 * - Servers are automatically enabled via: cursor-agent mcp enable <identifier>
 * - Example: { playwright: { command: 'node', args: ['./node_modules/@playwright/mcp/cli.js'] } }
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { AgentLibraryAdapter, AgentLibraryCapabilities, AgentRunOptions, AgentRunResult, MCPServerConfig } from '../types';
import {
    getCurrentLogContext,
    logPrompt,
    logTextResponse,
    logToolCall,
    logTokenUsage,
} from '../logging';
import { getModelForLibrary } from '../config';

// ============================================================
// CONSTANTS
// ============================================================

const CURSOR_CLI_COMMAND = 'cursor-agent';
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PROJECT_ROOT = process.cwd();
const DEFAULT_TIMEOUT_SECONDS = 300; // 5 minutes

// ============================================================
// TYPES
// ============================================================

/**
 * Cursor CLI stream event types
 */
interface CursorStreamEvent {
    type: 'system' | 'user' | 'assistant' | 'start' | 'text' | 'tool_use' | 'tool_result' | 'result' | 'error';
    subtype?: string;       // For system events (e.g., 'init')
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
    // For assistant/user message events (--stream-partial-output)
    message?: {
        role?: string;
        content?: Array<{
            type: string;
            text?: string;
            name?: string;      // Tool name
            input?: Record<string, unknown>; // Tool input
        }>;
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

    get model(): string {
        return getModelForLibrary('cursor');
    }

    readonly capabilities: AgentLibraryCapabilities = {
        streaming: true,
        fileRead: true,
        fileWrite: true,
        webFetch: false, // Cursor CLI does not support web fetch natively
        customTools: true, // Cursor supports MCP servers for custom tools
        timeout: true,
        planMode: true, // Cursor supports --mode=plan
    };

    private initialized = false;

    async init(): Promise<void> {
        // Verify agent is available
        try {
            const { exitCode } = await this.executeCommand(['--version'], {
                timeout: 5000,
                suppressOutput: true,
            });
            if (exitCode !== 0) {
                throw new Error('CLI not installed (cursor-agent --version failed)');
            }
        } catch (error) {
            const innerError = error instanceof Error ? error.message : String(error);
            // Check if it's our own error or a spawn error
            if (innerError.includes('CLI not installed')) {
                throw error;
            }
            throw new Error(`CLI not installed (${innerError}). Run: curl https://cursor.com/install -fsS | bash`);
        }

        // Verify authentication status
        try {
            const { stdout } = await this.executeCommand(['status'], {
                timeout: 5000,
                suppressOutput: true,
            });
            if (stdout.toLowerCase().includes('not logged in')) {
                throw new Error('Not authenticated. Run: cursor-agent login');
            }
            this.initialized = true;
        } catch (error) {
            // If status check fails with auth error, throw it
            if (error instanceof Error && error.message.includes('Not authenticated')) {
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
            planMode = false,
            mcpServers,
            outputFormat,
        } = options;

        // Build the effective prompt - inject schema if outputFormat is provided
        let effectivePrompt = prompt;
        if (outputFormat && outputFormat.type === 'json_schema' && outputFormat.schema) {
            const schemaJson = JSON.stringify(outputFormat.schema, null, 2);
            effectivePrompt = `${prompt}

## REQUIRED OUTPUT FORMAT

You MUST return your response as a valid JSON object matching this schema:

\`\`\`json
${schemaJson}
\`\`\`

IMPORTANT:
- Your final response MUST be ONLY the JSON object (no markdown code fences, no extra text)
- All required fields in the schema MUST be present
- The JSON must be valid and parseable`;
        }

        // Set up MCP servers if provided
        if (mcpServers && Object.keys(mcpServers).length > 0) {
            await this.setupMCPServers(mcpServers);
        }

        const startTime = Date.now();
        let toolCallCount = 0;
        const filesExamined: string[] = [];
        let lastResult = '';

        // Buffer for accumulating streaming text responses (for logging)
        let textBuffer = '';
        const TEXT_BUFFER_FLUSH_SIZE = 500; // Flush to log after this many characters

        // Buffer for console display (shows progress without fragment spam)
        let displayBuffer = '';
        const DISPLAY_BUFFER_SIZE = 100; // Display every ~100 chars (1-2 lines)

        const flushTextBuffer = () => {
            if (textBuffer.trim() && logCtx) {
                logTextResponse(logCtx, textBuffer.trim());
            }
            textBuffer = '';
        };

        const flushDisplayBuffer = () => {
            if (displayBuffer.trim()) {
                // Print buffered text as a single line (gray, indented)
                console.log(`    \x1b[90m${displayBuffer.trim()}\x1b[0m`);
            }
            displayBuffer = '';
        };

        let spinnerInterval: NodeJS.Timeout | null = null;
        let spinnerFrame = 0;

        // Build CLI arguments
        const hasMcpServers = mcpServers && Object.keys(mcpServers).length > 0;
        const args = this.buildArgs(effectivePrompt, {
            allowWrite,
            stream,
            planMode,
            useMcp: hasMcpServers,
        });

        // Log prompt if context is available
        const logCtx = getCurrentLogContext();
        if (logCtx) {
            logPrompt(logCtx, prompt, {
                model: this.model,
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
                                // Buffer text responses instead of logging each one
                                // Add newline between text chunks if previous chunk ended with sentence punctuation
                                const needsNewline = textBuffer.length > 0 &&
                                    /[.!?]$/.test(textBuffer.trim()) &&
                                    /^[A-Z]/.test(event.content.trim());
                                if (needsNewline) {
                                    textBuffer += '\n';
                                    displayBuffer += '\n';
                                }
                                textBuffer += event.content;
                                displayBuffer += event.content;
                                lastResult = event.content;

                                // Flush to log if buffer is large enough
                                if (textBuffer.length >= TEXT_BUFFER_FLUSH_SIZE) {
                                    flushTextBuffer();
                                }

                                // Flush to console periodically for progress feedback
                                if (displayBuffer.length >= DISPLAY_BUFFER_SIZE) {
                                    flushDisplayBuffer();
                                }
                            }

                            if (event.type === 'tool_use') {
                                // Flush buffers before logging tool call
                                flushDisplayBuffer();
                                flushTextBuffer();
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
                                // Flush any remaining buffers before processing result
                                flushDisplayBuffer();
                                flushTextBuffer();
                                if (event.result) {
                                    lastResult = event.result;
                                }
                            }
                        },
                    }
                );

                // Flush any remaining text in buffers
                flushDisplayBuffer();
                flushTextBuffer();

                const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
                const usage = this.extractUsageFromResult(result.stdout);

                // Log usage if available
                if (logCtx && usage) {
                    logTokenUsage(logCtx, {
                        inputTokens: usage.inputTokens,
                        outputTokens: usage.outputTokens,
                        cost: usage.totalCostUSD,
                        cacheReadInputTokens: usage.cacheReadInputTokens,
                        cacheCreationInputTokens: usage.cacheCreationInputTokens,
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
                        toolCallsCount: toolCallCount,
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
                        toolCallsCount: toolCallCount,
                    };
                }

                console.log(`  \x1b[32m✓ ${progressLabel} complete (${durationSeconds}s, ${toolCallCount} tool calls${usageInfo})\x1b[0m`);

                // Extract structured output if outputFormat was provided
                const structuredOutput = outputFormat ? this.extractStructuredOutput(lastResult) : undefined;

                return {
                    success: true,
                    content: lastResult,
                    filesExamined,
                    usage,
                    durationSeconds,
                    structuredOutput,
                    toolCallsCount: toolCallCount,
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
                        cacheReadInputTokens: usage.cacheReadInputTokens,
                        cacheCreationInputTokens: usage.cacheCreationInputTokens,
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
                        toolCallsCount: toolCallCount,
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
                        toolCallsCount: toolCallCount,
                    };
                }

                console.log(`\r  \x1b[32m✓ ${progressLabel} complete (${durationSeconds}s, ${toolCallCount} tool calls${usageInfo})\x1b[0m\x1b[K`);

                // Extract structured output if outputFormat was provided
                const structuredOutput = outputFormat ? this.extractStructuredOutput(content || lastResult) : undefined;

                return {
                    success: true,
                    content: content || lastResult,
                    filesExamined,
                    usage,
                    durationSeconds,
                    structuredOutput,
                    toolCallsCount: toolCallCount,
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
                toolCallsCount: toolCallCount,
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
        planMode?: boolean;
        useMcp?: boolean;
    }): string[] {
        const args = [prompt];

        // Use -p (print) for non-interactive mode
        args.push('-p');

        // Specify model from config
        args.push('--model', this.model);

        // Output format: stream-json for streaming, json for non-streaming
        args.push('--output-format', options.stream ? 'stream-json' : 'json');

        // Enable partial output streaming for real-time text output
        if (options.stream) {
            args.push('--stream-partial-output');
        }

        // Plan mode for read-only exploration (overrides allowWrite)
        if (options.planMode) {
            args.push('--mode=plan');
        } else if (options.allowWrite) {
            // Allow write operations (only if not in plan mode)
            args.push('--force');
        }

        // Auto-approve MCP servers in headless mode
        if (options.useMcp) {
            args.push('--approve-mcps');
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
                // Transform assistant message events to text events for easier handling
                if (event.type === 'assistant' && event.message?.content) {
                    for (const block of event.message.content) {
                        if (block.type === 'text' && block.text) {
                            // Emit as text event
                            onEvent({ type: 'text', content: block.text, session_id: event.session_id });
                        } else if (block.type === 'tool_use' && block.name) {
                            // Emit as tool_use event
                            onEvent({
                                type: 'tool_use',
                                name: block.name,
                                input: block.input,
                                session_id: event.session_id,
                            });
                        }
                    }
                    return;
                }
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
     * Extract structured output from response content
     * Tries to parse JSON from the response, handling various formats
     */
    private extractStructuredOutput(content: string | null): unknown {
        if (!content) return undefined;

        // Try direct JSON parse first
        try {
            return JSON.parse(content.trim());
        } catch {
            // Not direct JSON
        }

        // Try to extract JSON from markdown code block
        const jsonBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (jsonBlockMatch) {
            try {
                return JSON.parse(jsonBlockMatch[1].trim());
            } catch {
                // Invalid JSON in code block
            }
        }

        // Try to find JSON object in the content (starts with { ends with })
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch {
                // Invalid JSON
            }
        }

        return undefined;
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

    // ============================================================
    // MCP SERVER SUPPORT
    // ============================================================

    /**
     * Set up MCP servers for the agent
     *
     * Cursor uses .cursor/mcp.json for MCP configuration.
     * This method:
     * 1. Writes/updates the MCP config file
     * 2. Enables each MCP server via cursor-agent mcp enable
     */
    private async setupMCPServers(mcpServers: Record<string, MCPServerConfig>): Promise<void> {
        const mcpConfigPath = path.join(PROJECT_ROOT, '.cursor', 'mcp.json');
        const mcpConfigDir = path.dirname(mcpConfigPath);

        // Ensure .cursor directory exists
        if (!fs.existsSync(mcpConfigDir)) {
            fs.mkdirSync(mcpConfigDir, { recursive: true });
        }

        // Read existing config or create new one
        let existingConfig: { mcpServers?: Record<string, MCPServerConfig> } = {};
        if (fs.existsSync(mcpConfigPath)) {
            try {
                const content = fs.readFileSync(mcpConfigPath, 'utf-8');
                existingConfig = JSON.parse(content);
            } catch {
                // Invalid JSON, start fresh
                existingConfig = {};
            }
        }

        // Merge new MCP servers with existing config
        const updatedConfig = {
            ...existingConfig,
            mcpServers: {
                ...(existingConfig.mcpServers || {}),
                ...mcpServers,
            },
        };

        // Write updated config
        fs.writeFileSync(mcpConfigPath, JSON.stringify(updatedConfig, null, 2));

        // Enable each MCP server
        for (const identifier of Object.keys(mcpServers)) {
            await this.enableMCPServer(identifier);
        }
    }

    /**
     * Enable an MCP server via cursor-agent mcp enable
     */
    private async enableMCPServer(identifier: string): Promise<void> {
        try {
            const { exitCode, stderr } = await this.executeCommand(['mcp', 'enable', identifier], {
                timeout: 10000,
                suppressOutput: true,
            });

            // Exit code 0 = success, or server already enabled
            if (exitCode !== 0) {
                // Check if it's just "already enabled" which is fine
                if (!stderr.toLowerCase().includes('already')) {
                    console.log(`  \x1b[33m⚠ Warning: Failed to enable MCP server '${identifier}': ${stderr}\x1b[0m`);
                }
            }
        } catch (error) {
            // Non-fatal - log warning and continue
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`  \x1b[33m⚠ Warning: Could not enable MCP server '${identifier}': ${errorMsg}\x1b[0m`);
        }
    }
}

// Export singleton instance
const cursorAdapter = new CursorAdapter();
export default cursorAdapter;
