import type {
    LogContext,
    GitHubAction,
    ExecutionSummary,
} from './types';
import { appendToLog, writeLogHeader, logExists, getLogPath } from './writer';
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

    const content = `## Phase: ${ctx.phase}

**Agent:** ${ctx.workflow}
${ctx.mode ? `**Mode:** ${ctx.mode}\n` : ''}**Started:** ${formatTime(ctx.startTime)}

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

    const content = `### Prompt

**Model:** ${model} | **Tools:** ${toolsList} | **Timeout:** ${timeout}

\`\`\`
${escapeCodeBlock(prompt)}
\`\`\`

### Agent Execution

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

    const content = `**[${timestamp}]** 🔧 Tool: ${toolName} (ID: ${toolId})

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

    const content = `**[${timestamp}]** ✅ Tool Result: ${toolName} (ID: ${toolId})

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

    const content = `**[${timestamp}]** 💭 Thinking:

> ${thinking.split('\n').join('\n> ')}

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log text response
 */
export function logTextResponse(ctx: LogContext, text: string): void {
    const timestamp = formatTime(new Date());

    const content = `**[${timestamp}]** 📝 Response:

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

    const content = `**[${timestamp}]** 🔄 Status changed: ${from} → ${to}

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

    const content = `**[${timestamp}]** ${emoji} GitHub: ${action.replace('_', ' ')} - ${details}

`;

    appendToLog(ctx.issueNumber, content);
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

    const content = `**[${timestamp}]** ❌ ${isFatal ? 'FATAL ' : ''}Error:

\`\`\`
${message}
${stack ? `\n\nStack trace:\n${stack}` : ''}
\`\`\`

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log token usage
 */
export function logTokenUsage(
    ctx: LogContext,
    usage: { inputTokens: number; outputTokens: number; cost?: number }
): void {
    const timestamp = formatTime(new Date());
    const total = usage.inputTokens + usage.outputTokens;
    const costStr = usage.cost ? ` | **Cost:** ${formatCost(usage.cost)}` : '';

    const content = `**[${timestamp}]** 📊 Tokens: ${usage.inputTokens} in / ${usage.outputTokens} out (${total} total)${costStr}

`;

    appendToLog(ctx.issueNumber, content);
}

/**
 * Log execution end with summary
 */
export function logExecutionEnd(
    ctx: LogContext,
    summary: Partial<ExecutionSummary>
): void {
    const duration = Date.now() - ctx.startTime.getTime();
    const durationStr = formatDuration(duration);

    const content = `---

### Phase Result

**Duration:** ${durationStr}
**Tool calls:** ${summary.toolCallsCount || 0}
**Tokens:** ${summary.totalTokens || 0}
**Cost:** ${summary.totalCost ? formatCost(summary.totalCost) : '$0.00'}
**Status:** ${summary.success ? '✅ Success' : '❌ Failed'}

`;

    appendToLog(ctx.issueNumber, content);

    // Update cumulative cost summary
    updateCostSummary(ctx, {
        name: ctx.phase,
        duration,
        toolCallsCount: summary.toolCallsCount || 0,
        totalTokens: summary.totalTokens || 0,
        totalCost: summary.totalCost || 0,
    }).catch((error) => {
        console.error('Failed to update cost summary:', error);
    });

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

## Summary

| Phase | Duration | Tools | Tokens | Cost |
|-------|----------|-------|--------|------|
${rows.join('\n')}
| **Total** | **${formatDuration(totalDuration)}** | **${totalTools}** | **${totalTokens}** | **${formatCost(totalCost)}** |

**Completed:** ${formatTime(new Date())}
`;

    appendToLog(ctx.issueNumber, content);
}
