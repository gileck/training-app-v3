import type { LogContext, PhaseData } from './types';
import { readLog, writeLog } from './writer';
import { budgetConfig } from '@/agents/shared/config';
import { sendNotificationToOwner } from '@/server/telegram';

/**
 * Format duration in milliseconds to human-readable string
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
 * Parse existing cost summary from log content
 * Returns array of phase data from the existing summary table
 * Fails gracefully - returns empty array if parsing fails
 */
export function parseCostSummary(logContent: string): PhaseData[] {
    try {
        // Match the Summary section
        const summaryMatch = logContent.match(/## Summary.*?\n([\s\S]*?)(?=\n##[^#]|$)/);
        if (!summaryMatch) {
            console.log('  💰 No existing cost summary found - creating new one');
            return [];
        }

        const summarySection = summaryMatch[1];

        // Extract table rows (skip header, divider, and total row)
        // Match: header row -> divider row (with proper column separators) -> data rows
        const tableMatch = summarySection.match(/\|.*\|.*\|.*\|.*\|.*\|\n\|[-:| ]+\|[-:| ]+\|[-:| ]+\|[-:| ]+\|[-:| ]+\|\n([\s\S]*?)(?=\n\|.*Total.*\||$)/);
        if (!tableMatch) {
            console.warn('  ⚠️ Found summary section but could not parse table - creating new summary');
            return [];
        }

        const tableContent = tableMatch[1];
        const rows = tableContent.trim().split('\n');

        const phases: PhaseData[] = [];

    for (const row of rows) {
        // Skip empty rows or rows that don't look like data
        if (!row.trim() || !row.includes('|')) {
            continue;
        }

        // Parse row: | Phase Name | Duration | Tools | Tokens | Cost |
        const cells = row.split('|').map(c => c.trim()).filter(Boolean);
        if (cells.length < 5) {
            continue;
        }

        const [name, durationStr, toolsStr, tokensStr, costStr] = cells;

        // Skip the Total row (starts with **)
        if (name.startsWith('**')) {
            continue;
        }

        // Parse duration (e.g., "4m 32s" or "45s")
        let durationMs = 0;
        const minutesMatch = durationStr.match(/(\d+)m/);
        const secondsMatch = durationStr.match(/(\d+)s/);
        if (minutesMatch) {
            durationMs += parseInt(minutesMatch[1]) * 60 * 1000;
        }
        if (secondsMatch) {
            durationMs += parseInt(secondsMatch[1]) * 1000;
        }

        // Parse tools count
        const toolCallsCount = parseInt(toolsStr) || 0;

        // Parse tokens
        const totalTokens = parseInt(tokensStr.replace(/,/g, '')) || 0;

        // Parse cost (e.g., "$0.3421")
        const totalCost = parseFloat(costStr.replace('$', '')) || 0;

        phases.push({
            name,
            duration: durationMs,
            toolCallsCount,
            totalTokens,
            totalCost,
        });
    }

    if (phases.length > 0) {
        console.log(`  💰 Parsed ${phases.length} existing phase(s) from cost summary`);
    }

    return phases;
    } catch (error) {
        console.warn('  ⚠️ Error parsing cost summary - continuing with empty summary:', error instanceof Error ? error.message : String(error));
        return [];
    }
}

/**
 * Remove existing Summary section from log content
 * Fails gracefully - returns original content if removal fails
 */
function removeSummarySection(logContent: string): string {
    try {
        // Remove from "## Summary" to the next "##" heading or end of file
        const updated = logContent.replace(/---\n\n## Summary[\s\S]*?(?=\n##[^#]|$)/, '');

        // If replacement happened (content changed), log it
        if (updated !== logContent) {
            console.log('  💰 Removed previous cost summary');
        }

        return updated;
    } catch (error) {
        console.warn('  ⚠️ Error removing previous summary - appending new summary:', error instanceof Error ? error.message : String(error));
        return logContent;
    }
}

/**
 * Generate summary markdown from phase data
 * Fails gracefully - returns minimal summary if generation fails
 */
function generateSummaryMarkdown(
    phases: PhaseData[],
    currentPhaseName: string,
    totalCost: number
): string {
    try {
        const totalDuration = phases.reduce((sum, p) => sum + p.duration, 0);
        const totalTools = phases.reduce((sum, p) => sum + p.toolCallsCount, 0);
        const totalTokens = phases.reduce((sum, p) => sum + p.totalTokens, 0);

        const rows = phases.map(
            (p) => `| ${p.name} | ${formatDuration(p.duration)} | ${p.toolCallsCount} | ${p.totalTokens.toLocaleString()} | ${formatCost(p.totalCost)} |`
        );

        // Determine budget status
        let budgetStatus: string;
        if (totalCost >= budgetConfig.alertThresholdUSD) {
            budgetStatus = `🚨 **Cost Alert:** Exceeded threshold ($${budgetConfig.alertThresholdUSD.toFixed(2)})!`;
        } else if (totalCost >= budgetConfig.warningThresholdUSD) {
            budgetStatus = `⚠️ **Cost Warning:** Approaching threshold ($${budgetConfig.warningThresholdUSD.toFixed(2)})`;
        } else {
            budgetStatus = `✅ **Cost Status:** Within budget (Alert threshold: $${budgetConfig.alertThresholdUSD.toFixed(2)})`;
        }

        return `---

## Summary (Updated after ${currentPhaseName})

| Phase | Duration | Tools | Tokens | Cost |
|-------|----------|-------|--------|------|
${rows.join('\n')}
| **Total** | **${formatDuration(totalDuration)}** | **${totalTools}** | **${totalTokens.toLocaleString()}** | **${formatCost(totalCost)}** |

**Last Updated:** ${formatTime(new Date())}
${budgetStatus}
`;
    } catch (error) {
        console.error('  ❌ Error generating summary markdown:', error instanceof Error ? error.message : String(error));
        // Return minimal summary as fallback
        return `---

## Summary

**Total Cost:** $${totalCost.toFixed(4)}
**Last Updated:** ${formatTime(new Date())}
**Note:** Error generating detailed summary - see logs

`;
    }
}

/**
 * Check budget threshold and send Telegram alert if exceeded
 * Fails gracefully - logs errors but never throws
 */
async function checkBudgetThreshold(
    issueNumber: number,
    totalCost: number,
    currentPhaseName: string,
    previousPhases: PhaseData[]
): Promise<void> {
    try {
        if (!budgetConfig.telegramAlertsEnabled) {
            return;
        }

        // Check if we just crossed the alert threshold
        const previousTotalCost = previousPhases.reduce((sum, p) => sum + p.totalCost, 0);
        const justCrossedAlert = previousTotalCost < budgetConfig.alertThresholdUSD &&
                                 totalCost >= budgetConfig.alertThresholdUSD;

        const justCrossedWarning = previousTotalCost < budgetConfig.warningThresholdUSD &&
                                   totalCost >= budgetConfig.warningThresholdUSD &&
                                   totalCost < budgetConfig.alertThresholdUSD;

        if (justCrossedAlert) {
            console.log(`  🚨 Cost alert triggered: $${totalCost.toFixed(2)} >= $${budgetConfig.alertThresholdUSD.toFixed(2)}`);
            await sendNotificationToOwner(
                `🚨 *Cost Alert: Issue #${issueNumber}*\n\n` +
                `Total cost exceeded alert threshold!\n\n` +
                `💰 Current total: $${totalCost.toFixed(2)}\n` +
                `🔴 Alert threshold: $${budgetConfig.alertThresholdUSD.toFixed(2)}\n` +
                `📊 Latest phase: ${currentPhaseName}\n\n` +
                `Review costs at: \`agent-logs/issue-${issueNumber}.md\``
            );
        } else if (justCrossedWarning) {
            console.log(`  ⚠️ Cost warning triggered: $${totalCost.toFixed(2)} >= $${budgetConfig.warningThresholdUSD.toFixed(2)}`);
            await sendNotificationToOwner(
                `⚠️ *Cost Warning: Issue #${issueNumber}*\n\n` +
                `Total cost approaching alert threshold.\n\n` +
                `💰 Current total: $${totalCost.toFixed(2)}\n` +
                `🟡 Warning threshold: $${budgetConfig.warningThresholdUSD.toFixed(2)}\n` +
                `📊 Latest phase: ${currentPhaseName}\n\n` +
                `Review costs at: \`agent-logs/issue-${issueNumber}.md\``
            );
        }
    } catch (error) {
        console.error('  ❌ Error in budget threshold check:', error instanceof Error ? error.message : String(error));
        // Don't throw - budget alerts are not critical
    }
}

/**
 * Update cumulative cost summary in the log file
 * Called after each agent phase completes
 * Fails gracefully - logs errors but never throws (cost summary is not critical)
 */
export async function updateCostSummary(
    ctx: LogContext,
    currentPhase: PhaseData
): Promise<void> {
    try {
        console.log(`  💰 Updating cost summary for issue #${ctx.issueNumber}...`);

        // 1. Read existing log file
        const logContent = readLog(ctx.issueNumber);
        if (!logContent) {
            console.warn(`  ⚠️ Log file not found for issue #${ctx.issueNumber}, skipping cost summary`);
            return;
        }

        // 2. Parse existing summary (if exists) - fails gracefully
        const existingPhases = parseCostSummary(logContent);

        // 3. Add current phase to the list
        const allPhases = [...existingPhases, currentPhase];

        // 4. Calculate total cost
        const totalCost = allPhases.reduce((sum, p) => sum + p.totalCost, 0);

        // 5. Check budget threshold and send alerts if needed - wrapped in try-catch
        try {
            await checkBudgetThreshold(ctx.issueNumber, totalCost, currentPhase.name, existingPhases);
        } catch (alertError) {
            console.warn('  ⚠️ Failed to send budget alert:', alertError instanceof Error ? alertError.message : String(alertError));
            // Continue anyway - alert failure shouldn't stop summary update
        }

        // 6. Remove old summary section (if exists) - fails gracefully
        const contentWithoutSummary = removeSummarySection(logContent);

        // 7. Generate new summary - pure function, should not fail
        const summaryMarkdown = generateSummaryMarkdown(allPhases, currentPhase.name, totalCost);

        // 8. Write updated log - wrapped in try-catch
        try {
            writeLog(ctx.issueNumber, contentWithoutSummary + summaryMarkdown);
            console.log(`  ✅ Cost summary updated: $${totalCost.toFixed(2)} total (${allPhases.length} phase${allPhases.length !== 1 ? 's' : ''})`);
        } catch (writeError) {
            console.error(`  ❌ Failed to write cost summary to log file:`, writeError instanceof Error ? writeError.message : String(writeError));
            // Don't throw - cost summary is not critical
        }
    } catch (error) {
        console.error(`  ❌ Unexpected error updating cost summary for issue #${ctx.issueNumber}:`, error instanceof Error ? error.message : String(error));
        // Don't throw - cost summary is not critical, agent should continue
    }
}
