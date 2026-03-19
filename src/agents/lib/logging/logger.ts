import type {
    LogContext,
    GitHubAction,
    ExecutionSummary,
    ExternalLogSource,
    ExternalLogEvent,
} from './types';
import { appendToLog, writeLogHeader, logExists, getLogPath, flushPendingLogs } from './writer';
import { updateCostSummary } from './cost-summary';

/**
 * Format timestamp as HH:MM:SS
 */
function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

/**
 * Format duration in seconds
 */
function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format cost in USD
 */
function formatCost(cost: number): string {
    return `$${cost.toFixed(4)}`;
}

/**
 * Escape markdown special characters in code blocks
 */
function escapeCodeBlock(content: string): string {
    // Replace triple backticks with quadruple backticks for nested code blocks
    return content.replace(/```/g, '````');
}

/**
 * Log execution start
 */
export function logExecutionStart(ctx: LogContext): void {
    const logPath = getLogPath(ctx.issueNumber);
    const fileExists = logExists(ctx.issueNumber);

    if (!fileExists) {
        writeLogHeader(ctx.issueNumber, ctx.issueTitle, ctx.issueType);
        console.log(`  📝 Agent log created: ${logPath}`);
    } else {
        console.log(`  📝 Agent log found: ${logPath}`);
    }

    // Build status line if status info is available
    const statusLine = ctx.currentStatus
        ? `**Current Status:** ${ctx.currentStatus}${ctx.currentReviewStatus ? ` | **Review Status:** ${ctx.currentReviewStatus}` : ''}\n`
        : '';

    // Build library and model line if info is available
    const libraryInfo = ctx.library
        ? ctx.model
            ? `**Library:** ${ctx.library} | **Model:** ${ctx.model}\n`
            : `**Library:** ${ctx.library}\n`
        : ctx.model
            ? `**Model:** ${ctx.model}\n`
            : '';

    // Get working directory
    const workingDir = process.cwd();
    console.log(`  📁 Working directory: ${workingDir}`);

    const content = `## [LOG:PHASE_START] Phase: ${ctx.phase}

**Agent:** ${ctx.workflow}
**Working Directory:** ${workingDir}
${ctx.mode ? `**Mode:** ${ctx.mode}\n` : ''}${libraryInfo}${statusLine}**Started:** ${formatTime(ctx.startTime)}

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log full prompt
 */
export function logPrompt(
    ctx: LogContext,
    prompt: string,
    options?: { model?: string; tools?: string[]; timeout?: number }
): void {
    const toolsList = options?.tools?.join(', ') || 'None';
    const model = options?.model || 'Unknown';
    const timeout = options?.timeout ? `${options.timeout}s` : 'None';

    const content = `### [LOG:PROMPT] Prompt

**Model:** ${model} | **Tools:** ${toolsList} | **Timeout:** ${timeout}

\`\`\`
${escapeCodeBlock(prompt)}
\`\`\`

### [LOG:PROMPT_END] End of Prompt

### [LOG:EXECUTION_START] Agent Execution

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log tool call
 */
export function logToolCall(
    ctx: LogContext,
    toolId: string,
    toolName: string,
    input: unknown
): void {
    const timestamp = formatTime(new Date());
    const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);

    const content = `**[${timestamp}]** [LOG:TOOL_CALL] 🔧 Tool: ${toolName} (ID: ${toolId})

\`\`\`json
${escapeCodeBlock(inputStr)}
\`\`\`

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log tool result
 */
export function logToolResult(
    ctx: LogContext,
    toolId: string,
    toolName: string,
    output: unknown
): void {
    const timestamp = formatTime(new Date());
    const outputStr =
        typeof output === 'string'
            ? output
            : JSON.stringify(output, null, 2);

    // Truncate very long outputs
    const truncated = outputStr.length > 5000;
    const displayOutput = truncated
        ? outputStr.slice(0, 5000) + '\n\n... (truncated)'
        : outputStr;

    const content = `**[${timestamp}]** [LOG:TOOL_RESULT] ✅ Result: ${toolName} (ID: ${toolId})

\`\`\`
${escapeCodeBlock(displayOutput)}
\`\`\`

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log thinking block
 */
export function logThinking(ctx: LogContext, thinking: string): void {
    const timestamp = formatTime(new Date());

    const content = `**[${timestamp}]** [LOG:THINKING] 💭 Thinking:

> ${thinking.split('\n').join('\n> ')}

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log text response
 */
export function logTextResponse(ctx: LogContext, text: string): void {
    const timestamp = formatTime(new Date());

    const content = `**[${timestamp}]** [LOG:RESPONSE] 📝 Response:

${text}

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log status transition
 */
export function logStatusTransition(
    ctx: LogContext,
    from: string,
    to: string
): void {
    const timestamp = formatTime(new Date());

    const content = `**[${timestamp}]** [LOG:STATUS] 🔄 Status: ${from} → ${to}

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log GitHub action
 */
export function logGitHubAction(
    ctx: LogContext,
    action: GitHubAction['action'],
    details: string
): void {
    const timestamp = formatTime(new Date());
    const emoji =
        action === 'comment'
            ? '💬'
            : action === 'pr_created'
              ? '🔀'
              : action === 'issue_updated'
                ? '📝'
                : '🏷️';

    const content = `**[${timestamp}]** [LOG:GITHUB] ${emoji} ${action.replace('_', ' ')}: ${details}

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log info message
 */
export function logInfo(
    ctx: LogContext,
    message: string,
    emoji = 'ℹ️'
): void {
    const timestamp = formatTime(new Date());

    const content = `**[${timestamp}]** [LOG:INFO] ${emoji} ${message}

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log feature branch workflow event
 * Used for multi-phase feature branch operations
 */
export function logFeatureBranch(
    issueNumber: number,
    message: string
): void {
    const timestamp = formatTime(new Date());

    const content = `**[${timestamp}]** [LOG:FEATURE_BRANCH] 🌿 ${message}

`;

    appendToLog(issueNumber, content);
}

/**
 * Log error
 */
export function logError(
    ctx: LogContext,
    error: Error | string,
    isFatal = false
): void {
    const timestamp = formatTime(new Date());
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;

    const marker = isFatal ? '[LOG:FATAL]' : '[LOG:ERROR]';
    const content = `**[${timestamp}]** ${marker} ❌ Error:

\`\`\`
${message}
${stack ? `\n\nStack trace:\n${stack}` : ''}
\`\`\`

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log token usage
 *
 * Includes cached tokens in the total when available. Total input tokens
 * is calculated as: inputTokens + cacheReadInputTokens + cacheCreationInputTokens
 *
 * @param ctx - Log context
 * @param usage - Token usage stats including optional cache tokens
 */
export function logTokenUsage(
    ctx: LogContext,
    usage: {
        inputTokens: number;
        outputTokens: number;
        cost?: number;
        cacheReadInputTokens?: number;
        cacheCreationInputTokens?: number;
    }
): void {
    const timestamp = formatTime(new Date());

    // Calculate total input tokens including cache tokens
    // According to Anthropic SDK: total input = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
    const cacheRead = usage.cacheReadInputTokens ?? 0;
    const cacheCreation = usage.cacheCreationInputTokens ?? 0;
    const totalInputTokens = usage.inputTokens + cacheRead + cacheCreation;
    const totalTokens = totalInputTokens + usage.outputTokens;
    const costStr = usage.cost ? ` | **Cost:** ${formatCost(usage.cost)}` : '';

    // Show cache breakdown if cache tokens are present
    const hasCacheTokens = cacheRead > 0 || cacheCreation > 0;
    let inputDisplay: string;
    if (hasCacheTokens) {
        // Show: "150 in (50 new + 100 cached)" format
        const cachedTotal = cacheRead + cacheCreation;
        inputDisplay = `${totalInputTokens} in (${usage.inputTokens} new + ${cachedTotal} cached)`;
    } else {
        inputDisplay = `${usage.inputTokens} in`;
    }

    const content = `**[${timestamp}]** [LOG:TOKENS] 📊 Tokens: ${inputDisplay} / ${usage.outputTokens} out (${totalTokens} total)${costStr}

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log execution end with summary
 */
export async function logExecutionEnd(
    ctx: LogContext,
    summary: Partial<ExecutionSummary>
): Promise<void> {
    const duration = Date.now() - ctx.startTime.getTime();
    const durationStr = formatDuration(duration);

    const content = `### [LOG:EXECUTION_END] Agent Execution

---

## [LOG:PHASE_END] Phase: ${ctx.phase}

**Duration:** ${durationStr}
**Tool calls:** ${summary.toolCallsCount || 0}
**Tokens:** ${summary.totalTokens || 0}
**Cost:** ${summary.totalCost ? formatCost(summary.totalCost) : '$0.00'}
**Status:** ${summary.success ? '✅ Success' : '❌ Failed'}

`;

    appendToLog(ctx.issueNumber, content);

    // Flush pending S3 writes so cost summary reads the latest content
    await flushPendingLogs();

    // Update cumulative cost summary (awaited so S3 writes complete before exit)
    try {
        await updateCostSummary(ctx, {
            name: ctx.phase,
            duration,
            toolCallsCount: summary.toolCallsCount || 0,
            totalTokens: summary.totalTokens || 0,
            totalCost: summary.totalCost || 0,
        });
    } catch (error) {
        console.error('Failed to update cost summary:', error);
    }

    // Flush any remaining S3 writes from cost summary
    await flushPendingLogs();

    // Print log file location
    const logPath = getLogPath(ctx.issueNumber);
    console.log(`  📝 Agent log saved: ${logPath}`);
}

/**
 * Log final summary (called at the end of all phases)
 */
export function logFinalSummary(
    ctx: LogContext,
    phases: Array<{
        name: string;
        duration: number;
        toolCallsCount: number;
        totalTokens: number;
        totalCost: number;
    }>
): void {
    const totalDuration = phases.reduce((sum, p) => sum + p.duration, 0);
    const totalTools = phases.reduce((sum, p) => sum + p.toolCallsCount, 0);
    const totalTokens = phases.reduce((sum, p) => sum + p.totalTokens, 0);
    const totalCost = phases.reduce((sum, p) => sum + p.totalCost, 0);

    const rows = phases.map(
        (p) =>
            `| ${p.name} | ${formatDuration(p.duration)} | ${p.toolCallsCount} | ${p.totalTokens} | ${formatCost(p.totalCost)} |`
    );

    const content = `---

## [LOG:SUMMARY] Summary

| Phase | Duration | Tools | Tokens | Cost |
|-------|----------|-------|--------|------|
${rows.join('\n')}
| **Total** | **${formatDuration(totalDuration)}** | **${totalTools}** | **${totalTokens}** | **${formatCost(totalCost)}** |

**Completed:** ${formatTime(new Date())}
`;

    appendToLog(ctx.issueNumber, content);
}

// =============================================================================
// External Event Logging (Webhooks, GitHub Actions, etc.)
// =============================================================================
// These functions don't require a full LogContext - they're designed for
// external services to write to agent logs via API calls.

/**
 * Log external event (webhook, GitHub Action, etc.)
 *
 * This is a standalone function that doesn't require a LogContext.
 * Used by the agent-log API endpoint for external services.
 */
export function logExternalEvent(
    issueNumber: number,
    event: ExternalLogEvent
): void {
    const timestamp = formatTime(new Date());
    const marker = getExternalMarker(event.source);
    const emoji = getExternalEmoji(event.source, event.action);

    let content = `**[${timestamp}]** ${marker} ${emoji} ${event.action}`;

    if (event.details) {
        content += `: ${event.details}`;
    }

    content += '\n\n';

    // Add metadata if present
    if (event.metadata && Object.keys(event.metadata).length > 0) {
        content += `\`\`\`json\n${JSON.stringify(event.metadata, null, 2)}\n\`\`\`\n\n`;
    }

    appendToLog(issueNumber, content);
}

/**
 * Log webhook phase start
 */
export function logWebhookPhaseStart(
    issueNumber: number,
    phase: string,
    source: ExternalLogSource = 'webhook'
): void {
    const timestamp = formatTime(new Date());
    const startMarker =
        source === 'webhook'
            ? '[LOG:WEBHOOK_START]'
            : source === 'github_action'
              ? '[LOG:ACTION_START]'
              : '[LOG:EXTERNAL_START]';
    const emoji = source === 'github_action' ? '🚀' : '📥';

    const content = `## ${startMarker} ${emoji} ${phase}

**Source:** ${source}
**Started:** ${timestamp}

`;

    appendToLog(issueNumber, content);
}

/**
 * Log webhook phase end
 */
export function logWebhookPhaseEnd(
    issueNumber: number,
    phase: string,
    result: 'success' | 'failed' | 'skipped',
    source: ExternalLogSource = 'webhook'
): void {
    const timestamp = formatTime(new Date());
    const endMarker =
        source === 'webhook'
            ? '[LOG:WEBHOOK_END]'
            : source === 'github_action'
              ? '[LOG:ACTION_END]'
              : '[LOG:EXTERNAL_END]';
    const statusEmoji = result === 'success' ? '✅' : result === 'failed' ? '❌' : '⏭️';

    const content = `---

## ${endMarker} ${phase}

**Status:** ${statusEmoji} ${result.charAt(0).toUpperCase() + result.slice(1)}
**Completed:** ${timestamp}

`;

    appendToLog(issueNumber, content);
}

/**
 * Log webhook action (approval, routing, merge, etc.)
 */
export function logWebhookAction(
    issueNumber: number,
    action: string,
    details: string,
    metadata?: Record<string, unknown>
): void {
    logExternalEvent(issueNumber, {
        source: 'webhook',
        action,
        details,
        metadata,
    });
}

/**
 * Log GitHub Action event
 */
export function logGitHubActionEvent(
    issueNumber: number,
    action: string,
    details: string,
    metadata?: Record<string, unknown>
): void {
    logExternalEvent(issueNumber, {
        source: 'github_action',
        action,
        details,
        metadata,
    });
}

/**
 * Log external error
 */
export function logExternalError(
    issueNumber: number,
    source: ExternalLogSource,
    error: string | Error,
    isFatal = false
): void {
    const timestamp = formatTime(new Date());
    const marker = isFatal ? '[LOG:FATAL]' : '[LOG:ERROR]';
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack;

    const content = `**[${timestamp}]** ${marker} ❌ ${source} Error:

\`\`\`
${message}
${stack ? `\n\nStack trace:\n${stack}` : ''}
\`\`\`

`;

    appendToLog(issueNumber, content);
}

/**
 * Get marker for external source
 */
function getExternalMarker(source: ExternalLogSource): string {
    switch (source) {
        case 'webhook':
            return '[LOG:WEBHOOK]';
        case 'github_action':
            return '[LOG:ACTION]';
        case 'telegram':
            return '[LOG:TELEGRAM]';
        default:
            return '[LOG:EXTERNAL]';
    }
}

/**
 * Get emoji for external event
 */
function getExternalEmoji(source: ExternalLogSource, action: string): string {
    // Telegram/webhook specific actions
    if (source === 'webhook' || source === 'telegram') {
        if (action.includes('approv')) return '✅';
        if (action.includes('reject')) return '❌';
        if (action.includes('route')) return '🔀';
        if (action.includes('merge')) return '🔀';
        if (action.includes('review')) return '👀';
        if (action.includes('feedback')) return '💬';
        if (action.includes('advance')) return '⏩';
        return '📥';
    }

    // GitHub Action specific
    if (source === 'github_action') {
        if (action.includes('deploy')) return '🚀';
        if (action.includes('build')) return '🔨';
        if (action.includes('test')) return '🧪';
        if (action.includes('pr')) return '📋';
        if (action.includes('merge')) return '🔀';
        return '⚡';
    }

    return '📌';
}
