/**
 * Claude SDK Runner
 *
 * Provides a shared interface for running Claude Code SDK agents
 * with consistent progress indicators, timeout handling, and usage tracking.
 */

import { query, type SDKAssistantMessage, type SDKResultMessage, type SDKToolProgressMessage } from '@anthropic-ai/claude-agent-sdk';
import { agentConfig } from './config';
import type { AgentResult, UsageStats } from './types';

// ============================================================
// CONSTANTS
// ============================================================

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const PROJECT_ROOT = process.cwd();

// ============================================================
// TYPES
// ============================================================

export interface RunAgentOptions {
    /** Prompt to send to Claude */
    prompt: string;
    /** Tools to allow (default: read-only tools) */
    allowedTools?: string[];
    /** Whether to allow write operations (adds Edit, Write, Bash to allowed tools) */
    allowWrite?: boolean;
    /** Whether to stream output */
    stream?: boolean;
    /** Whether to show verbose output */
    verbose?: boolean;
    /** Timeout in seconds (default: from config) */
    timeout?: number;
    /** Custom label for progress indicator */
    progressLabel?: string;
    /** Enable Claude Code slash commands (requires settingSources: ['project']) */
    useSlashCommands?: boolean;
}

// ============================================================
// AGENT RUNNER
// ============================================================

/**
 * Run a Claude agent with the given prompt
 */
export async function runAgent(options: RunAgentOptions): Promise<AgentResult> {
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
    let usage: UsageStats | null = null;

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

// ============================================================
// OUTPUT PARSING
// ============================================================

/**
 * Extract markdown content from agent output
 *
 * Handles nested code blocks by properly matching opening and closing fence markers.
 */
export function extractMarkdown(text: string): string | null {
    if (!text) return null;

    try {
        // Try to find ```markdown ... ``` pattern with proper fence matching
        const markdownStart = text.indexOf('```markdown');
        if (markdownStart !== -1) {
            // Start after the opening fence and newline
            const contentStart = text.indexOf('\n', markdownStart) + 1;
            if (contentStart === 0) return null;

            // Find the matching closing fence by counting nested blocks
            let depth = 1; // We're inside the first markdown block
            let pos = contentStart;

            while (pos < text.length && depth > 0) {
                // Find next occurrence of ```
                const nextFence = text.indexOf('```', pos);
                if (nextFence === -1) break;

                // Check if it's at the start of a line (valid fence)
                const lineStart = text.lastIndexOf('\n', nextFence) + 1;
                const beforeFence = text.slice(lineStart, nextFence).trim();

                if (beforeFence === '') {
                    // It's a valid fence at line start
                    // Check if it's an opening or closing fence
                    const afterFence = text.slice(nextFence + 3, nextFence + 20);
                    if (/^[a-z]+/.test(afterFence)) {
                        // Opening fence (has language identifier)
                        depth++;
                    } else {
                        // Closing fence
                        depth--;
                        if (depth === 0) {
                            // Found the matching closing fence
                            return text.slice(contentStart, nextFence).trim();
                        }
                    }
                }

                pos = nextFence + 3;
            }

            // If we didn't find a closing fence, take everything after the opening
            return text.slice(contentStart).trim();
        }

        // Try plain ``` blocks (might not have markdown specifier)
        const plainCodeStart = text.indexOf('```');
        if (plainCodeStart !== -1) {
            const contentStart = text.indexOf('\n', plainCodeStart) + 1;
            if (contentStart === 0) return null;

            // Find the next ``` at line start
            let pos = contentStart;
            while (pos < text.length) {
                const nextFence = text.indexOf('```', pos);
                if (nextFence === -1) break;

                const lineStart = text.lastIndexOf('\n', nextFence) + 1;
                const beforeFence = text.slice(lineStart, nextFence).trim();

                if (beforeFence === '') {
                    const content = text.slice(contentStart, nextFence).trim();
                    // Check if it looks like a design document
                    if (content.includes('# ') && (content.includes('Overview') || content.includes('Design'))) {
                        return content;
                    }
                    break;
                }

                pos = nextFence + 3;
            }
        }

        // If no code block, check if the entire output is a design document
        if (text.includes('# ') && (text.includes('Overview') || text.includes('Design'))) {
            return text.trim();
        }

        return null;
    } catch (error) {
        console.error('  Markdown parse error:', error);
        return null;
    }
}

/**
 * Extract JSON from agent output
 */
export function extractJSON<T>(text: string): T | null {
    if (!text) return null;

    try {
        // Try to find JSON block in the text
        // Look for ```json ... ``` pattern first
        const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        let jsonStr = jsonBlockMatch?.[1];

        // If no code block, try to find raw JSON object
        if (!jsonStr) {
            const rawJsonMatch = text.match(/\{[\s\S]*\}/);
            jsonStr = rawJsonMatch?.[0];
        }

        if (!jsonStr) {
            return null;
        }

        return JSON.parse(jsonStr) as T;
    } catch (error) {
        console.error('  JSON parse error:', error);
        return null;
    }
}

/**
 * Extract review content from agent output
 */
export function extractReview(text: string): string | null {
    if (!text) return null;

    try {
        // Look for ```review ... ``` pattern
        const reviewBlockMatch = text.match(/```review\s*([\s\S]*?)\s*```/);
        if (reviewBlockMatch?.[1]) {
            return reviewBlockMatch[1].trim();
        }

        // If no code block, return the entire text if it looks like a review
        if (text.includes('## Review Decision') || text.includes('DECISION:')) {
            return text.trim();
        }

        return null;
    } catch (error) {
        console.error('  Review parse error:', error);
        return null;
    }
}

/**
 * Parse review decision from review content
 */
export function parseReviewDecision(reviewContent: string): 'approved' | 'request_changes' | null {
    if (!reviewContent) return null;

    const decisionMatch = reviewContent.match(/DECISION:\s*(APPROVED|REQUEST_CHANGES)/i);
    if (decisionMatch) {
        return decisionMatch[1].toUpperCase() === 'APPROVED' ? 'approved' : 'request_changes';
    }

    return null;
}

// ============================================================
// DESIGN DOCUMENT HELPERS
// ============================================================

/**
 * Design section markers
 */
export const DESIGN_MARKERS = {
    productStart: '<!-- AUTO-GENERATED: PRODUCT DESIGN -->',
    productEnd: '<!-- END PRODUCT DESIGN -->',
    techStart: '<!-- AUTO-GENERATED: TECHNICAL DESIGN -->',
    techEnd: '<!-- END TECHNICAL DESIGN -->',
};

/**
 * Extract the original description from issue body (before any design sections)
 */
export function extractOriginalDescription(issueBody: string): string {
    // Find the first design marker
    const markers = [DESIGN_MARKERS.productStart, DESIGN_MARKERS.techStart, '---\n\n## Product Design', '---\n\n## Technical Design'];

    let endIndex = issueBody.length;
    for (const marker of markers) {
        const idx = issueBody.indexOf(marker);
        if (idx !== -1 && idx < endIndex) {
            endIndex = idx;
        }
    }

    return issueBody.slice(0, endIndex).trim();
}

/**
 * Extract product design from issue body
 */
export function extractProductDesign(issueBody: string): string | null {
    const startIdx = issueBody.indexOf(DESIGN_MARKERS.productStart);
    const endIdx = issueBody.indexOf(DESIGN_MARKERS.productEnd);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        return issueBody.slice(startIdx + DESIGN_MARKERS.productStart.length, endIdx).trim();
    }

    // Try alternate format
    const altStart = issueBody.indexOf('## Product Design\n');
    if (altStart !== -1) {
        const altEnd = issueBody.indexOf('## Technical Design', altStart);
        if (altEnd !== -1) {
            return issueBody.slice(altStart, altEnd).trim();
        }
        return issueBody.slice(altStart).trim();
    }

    return null;
}

/**
 * Extract technical design from issue body
 */
export function extractTechDesign(issueBody: string): string | null {
    const startIdx = issueBody.indexOf(DESIGN_MARKERS.techStart);
    const endIdx = issueBody.indexOf(DESIGN_MARKERS.techEnd);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        return issueBody.slice(startIdx + DESIGN_MARKERS.techStart.length, endIdx).trim();
    }

    // Try alternate format
    const altStart = issueBody.indexOf('## Technical Design\n');
    if (altStart !== -1) {
        return issueBody.slice(altStart).trim();
    }

    return null;
}

/**
 * Build updated issue body with new design content
 */
export function buildUpdatedIssueBody(
    originalDescription: string,
    productDesign: string | null,
    techDesign: string | null
): string {
    const parts: string[] = [originalDescription];

    if (productDesign) {
        const timestamp = new Date().toISOString();
        parts.push(`
---

## Product Design

${DESIGN_MARKERS.productStart}
<!-- Generated: ${timestamp} -->

${productDesign}

${DESIGN_MARKERS.productEnd}`);
    }

    if (techDesign) {
        const timestamp = new Date().toISOString();
        parts.push(`
---

## Technical Design

${DESIGN_MARKERS.techStart}
<!-- Generated: ${timestamp} -->

${techDesign}

${DESIGN_MARKERS.techEnd}`);
    }

    return parts.join('\n');
}
