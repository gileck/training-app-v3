/**
 * Gemini CLI Adapter
 *
 * Adapter implementation for Google's Gemini CLI tool (@google/gemini-cli).
 *
 * Prerequisites:
 * - Install Gemini CLI: npm install -g @google/gemini-cli
 * - Authenticate: Set GEMINI_API_KEY or run `gemini` for interactive setup
 *
 * CLI Reference:
 * - gemini "<prompt>" - Run with prompt
 * - --output-format json|stream-json - Output format
 * - --yolo - Allow all tools (file read/write/shell)
 * - --allowed-tools <tools> - Restrict to specific tools
 *
 * Output Format (JSON):
 * {
 *   "response": "text response",
 *   "stats": {
 *     "models": {
 *       "gemini-2.5-flash": {
 *         "tokens": { "input": 8060, "output": 1, "total": 8077, "cached": 0 }
 *       }
 *     },
 *     "tools": { "totalCalls": 5 }
 *   }
 * }
 *
 * Streaming Output (stream-json):
 * {"type":"init","session_id":"uuid","model":"auto-gemini-2.5"}
 * {"type":"message","role":"assistant","content":"thinking...","delta":true}
 * {"type":"tool_use","tool_name":"read_file","parameters":{"path":"..."}}
 * {"type":"tool_result","tool_id":"id","status":"success","output":"..."}
 * {"type":"result","status":"success","stats":{"total_tokens":123}}
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
import { getModelForLibrary } from '../config';
import { calculateCost } from '../pricing';

// ============================================================
// CONSTANTS
// ============================================================

const GEMINI_CLI_COMMAND = 'gemini';
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PROJECT_ROOT = process.cwd();
const DEFAULT_TIMEOUT_SECONDS = 300; // 5 minutes

// Read-only tools for restricted mode
const READ_ONLY_TOOLS = ['ReadFile', 'FindFiles', 'SearchText', 'ReadManyFiles', 'GlobTool', 'GrepTool'];

// ============================================================
// TYPES
// ============================================================

/**
 * Gemini CLI stream event types
 */
interface GeminiStreamEvent {
    type: 'init' | 'message' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'text';
    session_id?: string;
    model?: string;
    role?: string;
    content?: string;
    delta?: boolean;
    tool_name?: string;
    tool_id?: string;
    parameters?: {
        path?: string;
        command?: string;
        [key: string]: unknown;
    };
    status?: string;
    output?: string;
    error?: string;
    response?: string;
    stats?: {
        models?: Record<string, {
            tokens?: {
                input?: number;
                output?: number;
                total?: number;
                cached?: number;
            };
        }>;
        tools?: {
            totalCalls?: number;
        };
        total_tokens?: number;
    };
}

/**
 * Result from executing the Gemini CLI
 */
interface GeminiExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
}

// ============================================================
// GEMINI ADAPTER
// ============================================================

class GeminiAdapter implements AgentLibraryAdapter {
    readonly name = 'gemini';

    get model(): string {
        return getModelForLibrary('gemini');
    }

    readonly capabilities: AgentLibraryCapabilities = {
        streaming: true,
        fileRead: true,
        fileWrite: true,
        webFetch: false, // Not exposed via CLI by default
        customTools: false, // Uses built-in tools
        timeout: true,
    };

    private initialized = false;

    async init(): Promise<void> {
        // Verify gemini CLI is available
        try {
            const { exitCode, stderr } = await this.executeCommand(['--version'], {
                timeout: 10000,
                suppressOutput: true,
            });
            if (exitCode !== 0) {
                throw new Error('CLI not installed (gemini --version failed)');
            }
            // Check for auth errors in stderr
            if (stderr && stderr.toLowerCase().includes('not authenticated')) {
                throw new Error(
                    'Not authenticated. Set GEMINI_API_KEY environment variable or run: gemini (interactive setup)\n' +
                    'Get API key from: https://aistudio.google.com/apikey'
                );
            }
        } catch (error) {
            const innerError = error instanceof Error ? error.message : String(error);
            // Check if it's our own error or a spawn error
            if (innerError.includes('CLI not installed') || innerError.includes('Not authenticated')) {
                throw error;
            }
            // Check for ENOENT (command not found)
            if (innerError.includes('ENOENT') || innerError.includes('not found')) {
                throw new Error(
                    'Gemini CLI not installed. Run: npm install -g @google/gemini-cli\n' +
                    'Or visit: https://www.npmjs.com/package/@google/gemini-cli'
                );
            }
            throw new Error(`CLI not available (${innerError}). Run: npm install -g @google/gemini-cli`);
        }

        // Test authentication with a simple query
        try {
            const { exitCode, stderr } = await this.executeCommand(
                ['--help'],
                { timeout: 10000, suppressOutput: true }
            );

            // Check for auth-related errors
            if (stderr && (
                stderr.toLowerCase().includes('api key') ||
                stderr.toLowerCase().includes('authentication') ||
                stderr.toLowerCase().includes('unauthorized')
            )) {
                throw new Error(
                    'Not authenticated. Set GEMINI_API_KEY environment variable or run: gemini (interactive setup)\n' +
                    'Get API key from: https://aistudio.google.com/apikey'
                );
            }

            if (exitCode !== 0 && stderr) {
                throw new Error(`CLI check failed: ${stderr}`);
            }

            this.initialized = true;
        } catch (error) {
            // If auth check fails, propagate the error
            if (error instanceof Error && (
                error.message.includes('Not authenticated') ||
                error.message.includes('api key')
            )) {
                throw error;
            }
            // Otherwise, assume help command isn't the issue and proceed
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
                model: this.model,
                tools: allowWrite ? ['ReadFile', 'WriteFile', 'Shell'] : READ_ONLY_TOOLS,
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

                            if ((event.type === 'message' || event.type === 'text') && event.content) {
                                // Log text response
                                if (logCtx) {
                                    logTextResponse(logCtx, event.content);
                                }
                                console.log(`    \x1b[90m${event.content}\x1b[0m`);
                                lastResult = event.content;
                            }

                            if (event.type === 'tool_use') {
                                toolCallCount++;
                                const toolName = event.tool_name || 'unknown';
                                const toolInput = event.parameters || {};

                                // Log tool call
                                if (logCtx) {
                                    logToolCall(logCtx, event.tool_id || '', toolName, toolInput);
                                }

                                // Track files examined
                                const filePath = event.parameters?.path;
                                if (filePath && typeof filePath === 'string') {
                                    const relativePath = filePath.replace(PROJECT_ROOT + '/', '');
                                    if (!filesExamined.includes(relativePath)) {
                                        filesExamined.push(relativePath);
                                    }
                                }

                                // Display tool use
                                let target = '';
                                if (filePath && typeof filePath === 'string') {
                                    target = ` → ${filePath.split('/').slice(-2).join('/')}`;
                                }
                                console.log(`  \x1b[36m[${elapsed}s] Tool: ${toolName}${target}\x1b[0m`);
                            }

                            if (event.type === 'result') {
                                if (event.response) {
                                    lastResult = event.response;
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
                        cacheReadInputTokens: usage.cacheReadInputTokens,
                        cacheCreationInputTokens: usage.cacheCreationInputTokens,
                    });
                }

                // Format usage info for display
                let usageInfo = '';
                if (usage) {
                    const totalTokens = usage.inputTokens + usage.outputTokens;
                    usageInfo = `, ${totalTokens.toLocaleString()} tokens`;
                    if (usage.totalCostUSD > 0) {
                        usageInfo += `, $${usage.totalCostUSD.toFixed(4)}`;
                    }
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

                return {
                    success: true,
                    content: lastResult,
                    filesExamined,
                    usage,
                    durationSeconds,
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
                    usageInfo = `, ${totalTokens.toLocaleString()} tokens`;
                    if (usage.totalCostUSD > 0) {
                        usageInfo += `, $${usage.totalCostUSD.toFixed(4)}`;
                    }
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

                return {
                    success: true,
                    content: content || lastResult,
                    filesExamined,
                    usage,
                    durationSeconds,
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
    }): string[] {
        const args: string[] = [];

        // Add prompt
        args.push(prompt);

        // Output format: stream-json for streaming, json for non-streaming
        args.push('--output-format', options.stream ? 'stream-json' : 'json');

        // Tool permissions
        if (options.allowWrite) {
            // --yolo allows all tools (file read/write/shell)
            args.push('--yolo');
        } else {
            // Restrict to read-only tools
            args.push('--allowed-tools', READ_ONLY_TOOLS.join(','));
        }

        return args;
    }

    /**
     * Execute Gemini CLI command
     */
    private async executeCommand(
        args: string[],
        options: {
            timeout?: number;
            suppressOutput?: boolean;
        } = {}
    ): Promise<GeminiExecutionResult> {
        const { timeout = 30000, suppressOutput = false } = options;

        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let timeoutId: NodeJS.Timeout | null = null;

            const proc = spawn(GEMINI_CLI_COMMAND, args, {
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
            onEvent?: (event: GeminiStreamEvent) => void;
        } = {}
    ): Promise<GeminiExecutionResult> {
        const { timeout = 300000, onEvent } = options;

        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let timeoutId: NodeJS.Timeout | null = null;
            let buffer = '';

            const proc = spawn(GEMINI_CLI_COMMAND, args, {
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
        onEvent?: (event: GeminiStreamEvent) => void
    ): void {
        if (!onEvent) return;

        try {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            if (parsed && typeof parsed === 'object') {
                if ('type' in parsed) {
                    // Standard streaming event format
                    onEvent(parsed as unknown as GeminiStreamEvent);
                } else if ('response' in parsed) {
                    // Final JSON output format (non-streaming)
                    onEvent({
                        type: 'result',
                        response: parsed.response as string,
                        stats: parsed.stats as GeminiStreamEvent['stats'],
                    });
                }
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
            const parsed = JSON.parse(output) as GeminiStreamEvent;

            // Extract response content
            if (parsed.response) {
                result.content = parsed.response;
            }

            // Extract usage stats from nested models structure
            if (parsed.stats?.models) {
                let totalInput = 0;
                let totalOutput = 0;

                for (const modelStats of Object.values(parsed.stats.models)) {
                    const tokens = modelStats.tokens;
                    if (tokens) {
                        totalInput += tokens.input || 0;
                        totalOutput += tokens.output || 0;
                    }
                }

                result.usage = {
                    inputTokens: totalInput,
                    outputTokens: totalOutput,
                    cacheReadInputTokens: 0,
                    cacheCreationInputTokens: 0,
                    totalCostUSD: calculateCost(this.model, totalInput, totalOutput),
                };
            }

            // Extract tool call count
            if (parsed.stats?.tools?.totalCalls) {
                result.toolCalls = parsed.stats.tools.totalCalls;
            }

            return result;
        } catch {
            // Not valid JSON, try line-by-line parsing
            const lines = output.split('\n');
            const jsonLines: GeminiStreamEvent[] = [];

            for (const line of lines) {
                if (line.trim().startsWith('{')) {
                    try {
                        const event = JSON.parse(line.trim()) as GeminiStreamEvent;
                        jsonLines.push(event);
                    } catch {
                        // Skip invalid JSON lines
                    }
                }
            }

            // Extract data from parsed events
            for (const event of jsonLines) {
                if (event.type === 'result' && event.response) {
                    result.content = event.response;
                }
                if (event.type === 'tool_use') {
                    result.toolCalls++;
                    const path = event.parameters?.path;
                    if (path && typeof path === 'string') {
                        result.files.push(path.replace(PROJECT_ROOT + '/', ''));
                    }
                }
                if (event.stats?.models) {
                    let totalInput = 0;
                    let totalOutput = 0;

                    for (const modelStats of Object.values(event.stats.models)) {
                        const tokens = modelStats.tokens;
                        if (tokens) {
                            totalInput += tokens.input || 0;
                            totalOutput += tokens.output || 0;
                        }
                    }

                    result.usage = {
                        inputTokens: totalInput,
                        outputTokens: totalOutput,
                        cacheReadInputTokens: 0,
                        cacheCreationInputTokens: 0,
                        totalCostUSD: calculateCost(this.model, totalInput, totalOutput),
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
                        const parsed = JSON.parse(line.trim()) as GeminiStreamEvent;

                        if (parsed.stats?.models) {
                            let totalInput = 0;
                            let totalOutput = 0;

                            for (const modelStats of Object.values(parsed.stats.models)) {
                                const tokens = modelStats.tokens;
                                if (tokens) {
                                    totalInput += tokens.input || 0;
                                    totalOutput += tokens.output || 0;
                                }
                            }

                            return {
                                inputTokens: totalInput,
                                outputTokens: totalOutput,
                                cacheReadInputTokens: 0,
                                cacheCreationInputTokens: 0,
                                totalCostUSD: calculateCost(this.model, totalInput, totalOutput),
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
const geminiAdapter = new GeminiAdapter();
export default geminiAdapter;
