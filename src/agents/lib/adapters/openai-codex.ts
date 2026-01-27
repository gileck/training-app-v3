/**
 * OpenAI Codex CLI Adapter
 *
 * Adapter implementation for OpenAI's Codex CLI tool (@openai/codex).
 *
 * Prerequisites:
 * - Install Codex CLI: npm install -g @openai/codex or brew install --cask codex
 * - Login: codex login (requires ChatGPT Plus/Pro subscription or API key)
 *
 * CLI Reference:
 * - codex exec "<prompt>" - Run agent with prompt in non-interactive mode
 * - --json - Output newline-delimited JSON events
 * - --sandbox <mode> - Sandbox mode (read-only, workspace-write, danger-full-access)
 * - --model <model> - Specify model (e.g., gpt-5-codex, gpt-5)
 *
 * Output Format (--json):
 * {"type":"init","session_id":"uuid"}
 * {"type":"message","role":"assistant","content":"thinking..."}
 * {"type":"tool_use","tool":"read_file","path":"..."}
 * {"type":"tool_result","status":"success"}
 * {"type":"result","usage":{"input_tokens":100,"output_tokens":50}}
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

const CODEX_CLI_COMMAND = 'codex';
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PROJECT_ROOT = process.cwd();
const DEFAULT_TIMEOUT_SECONDS = 300; // 5 minutes

// Sandbox modes
const SANDBOX_READ_ONLY = 'read-only';
const SANDBOX_WORKSPACE_WRITE = 'workspace-write';

// ============================================================
// TYPES
// ============================================================

/**
 * OpenAI Codex CLI stream event types
 */
interface CodexStreamEvent {
    type: 'init' | 'message' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'text';
    session_id?: string;
    role?: string;
    content?: string;
    tool?: string;
    tool_id?: string;
    path?: string;
    input?: Record<string, unknown>;
    status?: string;
    output?: string;
    error?: string;
    result?: string;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        total_cost_usd?: number;
    };
}

/**
 * Result from executing the Codex CLI
 */
interface CodexExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
}

// ============================================================
// OPENAI CODEX ADAPTER
// ============================================================

class OpenAICodexAdapter implements AgentLibraryAdapter {
    readonly name = 'openai-codex';

    get model(): string {
        return getModelForLibrary('openai-codex');
    }

    readonly capabilities: AgentLibraryCapabilities = {
        streaming: true,
        fileRead: true,
        fileWrite: true,
        webFetch: false, // Not exposed via CLI
        customTools: false, // Uses built-in tools
        timeout: true,
    };

    private initialized = false;

    async init(): Promise<void> {
        // Verify codex CLI is available
        try {
            const { exitCode, stderr } = await this.executeCommand(['--version'], {
                timeout: 10000,
                suppressOutput: true,
            });
            if (exitCode !== 0) {
                throw new Error('CLI not installed (codex --version failed)');
            }
            // Check for auth errors in stderr
            if (stderr && stderr.toLowerCase().includes('not logged in')) {
                throw new Error(
                    'Not authenticated. Run: codex login\n' +
                    'Requires ChatGPT Plus/Pro subscription or API key'
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
                    'OpenAI Codex CLI not installed. Run: npm install -g @openai/codex\n' +
                    'Or: brew install --cask codex\n' +
                    'Visit: https://developers.openai.com/codex/cli/'
                );
            }
            throw new Error(`CLI not available (${innerError}). Run: npm install -g @openai/codex`);
        }

        // Test authentication status
        try {
            // Check login status (if the command exists)
            const { stdout, stderr, exitCode } = await this.executeCommand(
                ['login', 'status'],
                { timeout: 10000, suppressOutput: true }
            );

            // Check for "not logged in" message
            const output = (stdout + stderr).toLowerCase();
            if (output.includes('not logged in') || output.includes('please login')) {
                throw new Error(
                    'Not authenticated. Run: codex login\n' +
                    'Requires ChatGPT Plus/Pro subscription or API key'
                );
            }

            // Non-zero exit code might indicate not logged in
            if (exitCode !== 0 && !output.includes('logged in')) {
                throw new Error(
                    'Not authenticated. Run: codex login\n' +
                    'Requires ChatGPT Plus/Pro subscription or API key'
                );
            }

            this.initialized = true;
        } catch (error) {
            // If auth check fails with auth error, propagate it
            if (error instanceof Error && (
                error.message.includes('Not authenticated') ||
                error.message.includes('not logged in')
            )) {
                throw error;
            }
            // If "login status" command doesn't exist, proceed anyway
            // Some versions might not have this subcommand
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
                tools: allowWrite ? ['read_file', 'write_file', 'shell'] : ['read_file'],
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
                                const toolName = event.tool || 'unknown';
                                const toolInput = event.input || {};

                                // Log tool call
                                if (logCtx) {
                                    logToolCall(logCtx, event.tool_id || '', toolName, toolInput);
                                }

                                // Track files examined
                                const filePath = event.path;
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
        const args: string[] = [];

        // Use exec subcommand for non-interactive mode
        args.push('exec');

        // Add prompt
        args.push(prompt);

        // Always use JSON output for parsing
        args.push('--json');

        // Sandbox mode based on write permissions
        args.push('--sandbox', options.allowWrite ? SANDBOX_WORKSPACE_WRITE : SANDBOX_READ_ONLY);

        // Specify model from config
        args.push('--model', this.model);

        return args;
    }

    /**
     * Execute Codex CLI command
     */
    private async executeCommand(
        args: string[],
        options: {
            timeout?: number;
            suppressOutput?: boolean;
        } = {}
    ): Promise<CodexExecutionResult> {
        const { timeout = 30000, suppressOutput = false } = options;

        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let timeoutId: NodeJS.Timeout | null = null;

            const proc = spawn(CODEX_CLI_COMMAND, args, {
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
            onEvent?: (event: CodexStreamEvent) => void;
        } = {}
    ): Promise<CodexExecutionResult> {
        const { timeout = 300000, onEvent } = options;

        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let timeoutId: NodeJS.Timeout | null = null;
            let buffer = '';

            const proc = spawn(CODEX_CLI_COMMAND, args, {
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
        onEvent?: (event: CodexStreamEvent) => void
    ): void {
        if (!onEvent) return;

        try {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            if (parsed && typeof parsed === 'object') {
                if ('type' in parsed) {
                    // Standard streaming event format
                    onEvent(parsed as unknown as CodexStreamEvent);
                } else if ('result' in parsed) {
                    // Final result format
                    onEvent({
                        type: 'result',
                        result: parsed.result as string,
                        usage: parsed.usage as CodexStreamEvent['usage'],
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

        // Parse line-by-line JSON events
        const lines = output.split('\n');
        const jsonLines: CodexStreamEvent[] = [];

        for (const line of lines) {
            if (line.trim().startsWith('{')) {
                try {
                    const event = JSON.parse(line.trim()) as CodexStreamEvent;
                    jsonLines.push(event);
                } catch {
                    // Skip invalid JSON lines
                }
            }
        }

        // Extract data from parsed events
        for (const event of jsonLines) {
            // Extract result content
            if (event.type === 'result' && event.result) {
                result.content = event.result;
            }
            if (event.type === 'message' && event.content) {
                // Keep track of last message content
                result.content = event.content;
            }

            // Count tool calls and track files
            if (event.type === 'tool_use') {
                result.toolCalls++;
                const path = event.path;
                if (path && typeof path === 'string') {
                    result.files.push(path.replace(PROJECT_ROOT + '/', ''));
                }
            }

            // Extract usage stats
            if (event.usage) {
                const inputTokens = event.usage.input_tokens || 0;
                const outputTokens = event.usage.output_tokens || 0;
                const providedCost = event.usage.total_cost_usd || 0;
                result.usage = {
                    inputTokens,
                    outputTokens,
                    cacheReadInputTokens: 0,
                    cacheCreationInputTokens: 0,
                    totalCostUSD: providedCost > 0 ? providedCost : calculateCost(this.model, inputTokens, outputTokens),
                };
            }
        }

        // If no content found, use raw output
        if (!result.content && output.trim()) {
            result.content = output.trim();
        }

        return result;
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
                        const parsed = JSON.parse(line.trim()) as CodexStreamEvent;

                        if (parsed.usage) {
                            const inputTokens = parsed.usage.input_tokens || 0;
                            const outputTokens = parsed.usage.output_tokens || 0;
                            const providedCost = parsed.usage.total_cost_usd || 0;
                            return {
                                inputTokens,
                                outputTokens,
                                cacheReadInputTokens: 0,
                                cacheCreationInputTokens: 0,
                                totalCostUSD: providedCost > 0 ? providedCost : calculateCost(this.model, inputTokens, outputTokens),
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
const openaiCodexAdapter = new OpenAICodexAdapter();
export default openaiCodexAdapter;
