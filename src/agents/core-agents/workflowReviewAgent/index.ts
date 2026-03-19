#!/usr/bin/env tsx
/**
 * Workflow Review Agent
 *
 * Pipeline agent that runs as the last step in ALL_ORDER.
 * Picks up Done items (where reviewed !== true), analyzes their
 * agent execution logs via LLM, stores summary, notifies admin,
 * and creates improvement issues.
 */

import { spawnSync } from 'child_process';
import { existsSync, statSync, openSync, readSync, closeSync, appendFileSync } from 'fs';
import { resolve } from 'path';
import {
    createCLI,
    runAgent,
    WORKFLOW_REVIEW_OUTPUT_FORMAT,
    notifyWorkflowReviewComplete,
    notifyAgentError,
    type CommonCLIOptions,
    type WorkflowReviewOutput,
    runAgentMain,
    calcTotalTokens,
} from '../../shared';
import {
    createLogContext,
    runWithLogContext,
    logExecutionStart,
    logExecutionEnd,
    logError,
    logInfo,
} from '../../lib/logging';
import { findAllWorkflowItems, setWorkflowReviewData } from '@/server/database/collections/template/workflow-items/workflow-items';
import type { WorkflowItemDocument } from '@/server/database/collections/template/workflow-items/types';

// ============================================================
// CONSTANTS
// ============================================================

const LOG_REVIEW_MARKER = '[LOG:REVIEW]';
const DEFAULT_LIMIT = 1;
const TAIL_BYTES = 4096; // Read last 4KB to check for review marker

// ============================================================
// PROMPT
// ============================================================

interface ExistingWorkflowItem {
    title: string;
    description: string;
}

function buildWorkflowReviewPrompt(item: WorkflowItemDocument, logFilePath: string, existingItems: ExistingWorkflowItem[] = []): string {
    const phases = item.artifacts?.phases ?? [];
    const designs = item.artifacts?.designs ?? [];
    const history = item.history ?? [];

    const phasesInfo = phases.length > 0
        ? phases.map(p => `  - Phase ${p.order}: ${p.name} (status: ${p.status}, size: ${p.estimatedSize}${p.prNumber ? `, PR #${p.prNumber}` : ''})`).join('\n')
        : '  (no phases)';

    const designsInfo = designs.length > 0
        ? designs.map(d => `  - ${d.type}: ${d.path} (status: ${d.status}${d.prNumber ? `, PR #${d.prNumber}` : ''})`).join('\n')
        : '  (no designs)';

    const historyInfo = history.length > 0
        ? history.map(h => `  - [${h.timestamp}] ${h.action}: ${h.description}${h.actor ? ` (${h.actor})` : ''}`).join('\n')
        : '  (no history)';

    return `You are a senior engineer reviewing the execution of an AI agent workflow pipeline.
Your job is to analyze the agent logs for a completed workflow item and identify issues,
inefficiencies, and systemic improvements.

## Workflow Item Metadata

- **Issue #${item.githubIssueNumber}**: ${item.title}
- **Type**: ${item.type}
- **Priority**: ${item.priority ?? 'not set'}
- **Size**: ${item.size ?? 'not set'}
- **Complexity**: ${item.complexity ?? 'not set'}
- **Status**: ${item.status}

### Phases
${phasesInfo}

### Designs
${designsInfo}

### History Timeline
${historyInfo}

## Log File

The agent execution log is at: \`${logFilePath}\`

Use the Read, Grep, and Glob tools to analyze it incrementally. **DO NOT read the entire file at once** — it can be very large.

### Efficient Reading Strategy

1. **Read header** (first 30 lines) — get issue title, type, start time
2. **Read summary/tail** (last 50 lines) — get totals, phase breakdown
3. **Grep for errors**: \`[LOG:ERROR]\` and \`[LOG:FATAL]\` markers
4. **Grep for phase results**: \`[LOG:PHASE_END]\`
5. **Grep for cost data**: \`[LOG:TOKENS]\`
6. **Read specific line ranges** around issues found

## Task Runner Logs (for debugging agent-level issues)

If you find errors, missing phases, or anomalies in the issue log, cross-reference with the task runner logs:
- Task runner logs are in \`agent-tasks/all/runs/\` (relative to project root)
- Status files: \`status-YYYYMMDD-HHMMSS-mmm.json\` — contain run status, exit code, timestamps
- Output logs: \`output-YYYYMMDD-HHMMSS-mmm.log\` — contain raw stdout/stderr from agent runs
- Use the phase timestamp from the issue log to find the matching run
- Search for: \`[ERR]\`, \`fatal:\`, \`failed with exit code\`, \`Connect Timeout\`
- This is critical for understanding WHY a phase failed — the issue log shows WHAT happened, task runner logs show the process context

## Analysis Checklist

### Errors & Failures
- Search for \`[LOG:ERROR]\` and \`[LOG:FATAL]\` markers
- For EACH error: investigate root cause — what system mechanism should have prevented this? Why didn't it?
- Check for missing \`[LOG:PHASE_END]\` (indicates killed/crashed phase)
- If you find errors or missing phases, CHECK THE TASK RUNNER LOGS to understand process-level context

### Efficiency
- Same file read 3+ times within a SINGLE phase is a finding (reads across different phases are expected)
- High token counts relative to task complexity
- Redundant search patterns

### Workflow
- Phase transitions (\`[LOG:PHASE_START]\` / \`[LOG:PHASE_END]\`)
- Missing PHASE_END = likely killed (timeout, crash)
- Multiple PHASE_START for same phase = retry

### Cost
- Check \`[LOG:TOKENS]\` entries
- Compare cost to item size/complexity

### Prompts
- Agent confusion indicators in \`[LOG:RESPONSE]\`
- Missing context that caused incorrect behavior

## What NOT to Flag
- Repeated reads across different phases (expected — no shared state between agents)
- Transient failures that self-recovered in the next cycle
- Issues consistent with documented workflow patterns
- Formatting/naming preferences

## Systemic Improvement Priority
1. **First: Update project docs** (\`docs/\`) — missing patterns, incomplete guides
2. **Second: Verify pipeline worked** — did tech design include relevant docs as related files?
3. **Third: General prompt principles** — only if truly universal across ALL features
4. **Last resort: Feature-specific prompt additions** — avoid, usually means a missing doc

## Existing Workflow Items (DO NOT DUPLICATE)

The following items already exist in the workflow pipeline. **Do NOT create findings that duplicate these items.** If your analysis identifies an issue that matches an existing item below, skip it — it is already tracked.

${existingItems.length > 0
        ? existingItems.map((ei, i) => `${i + 1}. **${ei.title}**\n   ${ei.description}`).join('\n')
        : '(No existing items)'}

## Output

Return structured output with findings, executive summary, and systemic improvements.
Every finding MUST include a root cause — if unknown, say so and recommend logging improvements.
IMPORTANT: Do NOT create findings that duplicate any of the existing workflow items listed above.`;
}

// ============================================================
// REVIEW SECTION FORMATTING
// ============================================================

function formatReviewSection(output: WorkflowReviewOutput, issueNumber: number): string {
    const timestamp = new Date().toISOString();
    const { executiveSummary, findings, systemicImprovements } = output;

    const findingLines = findings.length > 0
        ? findings.map(f => `- [ ] [${f.severity}] ${f.title} — ${f.description.split('\n')[0]}`).join('\n')
        : 'None found.';

    const improvementRows = systemicImprovements.length > 0
        ? systemicImprovements.map(s => `| ${s.type} | \`${s.targetFile}\` | ${s.recommendation} |`).join('\n')
        : '| — | — | No systemic improvements identified |';

    return `

---

## ${LOG_REVIEW_MARKER} Issue Review

**Reviewed:** ${timestamp}
**Reviewer:** workflow-review-agent
**Issue:** #${issueNumber}

### Executive Summary
- **Status**: ${executiveSummary.status}
- **Total Cost**: ${executiveSummary.totalCost}
- **Duration**: ${executiveSummary.duration}
- **Overall Assessment**: ${executiveSummary.overallAssessment}

### Findings (${findings.length})

${findingLines}

### Systemic Improvements

| Type | Target File | Recommendation |
|------|-------------|----------------|
${improvementRows}
`;
}

// ============================================================
// PROCESSING
// ============================================================

export async function processItem(
    item: WorkflowItemDocument,
    options: CommonCLIOptions
): Promise<{ success: boolean; findingsCount: number }> {
    const issueNumber = item.githubIssueNumber!;
    const logFilePath = resolve(process.cwd(), `agent-logs/issue-${issueNumber}.md`);

    console.log(`\n  Processing issue #${issueNumber}: ${item.title}`);

    // Check log file exists
    if (!existsSync(logFilePath)) {
        console.log(`    Skipping: log file not found at ${logFilePath}`);
        return { success: false, findingsCount: 0 };
    }

    // Safety net: check if already reviewed in log (read only tail to avoid loading large files)
    const fileSize = statSync(logFilePath).size;
    const readStart = Math.max(0, fileSize - TAIL_BYTES);
    const fd = openSync(logFilePath, 'r');
    const tailBuffer = Buffer.alloc(Math.min(TAIL_BYTES, fileSize));
    readSync(fd, tailBuffer, 0, tailBuffer.length, readStart);
    closeSync(fd);
    const tailContent = tailBuffer.toString('utf-8');
    if (tailContent.includes(LOG_REVIEW_MARKER)) {
        console.log(`    Skipping: ${LOG_REVIEW_MARKER} marker already present in log`);
        // Still mark as reviewed in DB
        if (!options.dryRun) {
            await setWorkflowReviewData(issueNumber, true, 'Previously reviewed (marker found in log)');
        }
        return { success: true, findingsCount: 0 };
    }

    // Create log context for structured logging
    const logCtx = createLogContext({
        issueNumber,
        workflow: 'workflow-review',
        phase: 'Workflow Review',
        mode: 'Review',
        issueTitle: item.title,
        issueType: item.type === 'bug' ? 'bug' : 'feature',
        currentStatus: item.status,
    });

    return runWithLogContext(logCtx, async () => {
        logExecutionStart(logCtx);

        try {
            // Fetch recent workflow items to avoid creating duplicate findings
            // Limited to last 7 days and capped at 50 items to keep prompt size manageable
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const allItems = await findAllWorkflowItems();
            const existingItems: ExistingWorkflowItem[] = allItems
                .filter(wi =>
                    String(wi._id) !== String(item._id) &&
                    new Date(wi.createdAt) >= sevenDaysAgo
                )
                .slice(0, 50)
                .map(wi => ({
                    title: wi.title,
                    description: (wi.description ?? '').split('\n')[0].slice(0, 200),
                }));

            // Build prompt
            const prompt = buildWorkflowReviewPrompt(item, logFilePath, existingItems);

            console.log('    Running LLM analysis...');

            if (options.dryRun) {
                console.log('    [DRY RUN] Would run LLM agent and process results');
                return { success: true, findingsCount: 0 };
            }

            // Run agent
            const result = await runAgent({
                prompt,
                allowedTools: ['Read', 'Grep', 'Glob'],
                stream: options.stream,
                verbose: options.verbose,
                timeout: options.timeout,
                outputFormat: WORKFLOW_REVIEW_OUTPUT_FORMAT,
                workflow: 'workflow-review',
            });

            if (!result.success || !result.structuredOutput) {
                const errorMsg = result.error ?? 'No structured output';
                logError(logCtx, errorMsg, true);
                await notifyAgentError('Workflow Review', item.title, issueNumber, errorMsg);
                await logExecutionEnd(logCtx, {
                    success: false,
                    toolCallsCount: 0,
                    totalTokens: 0,
                    totalCost: 0,
                });
                return { success: false, findingsCount: 0 };
            }

            const output = result.structuredOutput as WorkflowReviewOutput;
            const findingsCount = output.findings.length;

            console.log(`    Analysis complete: ${findingsCount} finding(s)`);
            logInfo(logCtx, `Analysis complete: ${findingsCount} finding(s)`);

            // Create workflow items for findings
            let failedFindings = 0;
            for (const finding of output.findings) {
                console.log(`    Creating issue: ${finding.title}`);
                const createResult = spawnSync('yarn', [
                    'agent-workflow', 'create',
                    '--type', finding.type === 'bug' ? 'bug' : 'feature',
                    '--title', finding.title,
                    '--description', `${finding.description}\n\nSource: Workflow review of issue #${finding.relatedIssue}\nCategory: ${finding.category}\nAffected files: ${finding.affectedFiles.join(', ')}`,
                    '--priority', finding.priority,
                    '--size', finding.size,
                    '--complexity', finding.complexity,
                    '--created-by', 'workflow-review',
                ], {
                    encoding: 'utf-8',
                    cwd: process.cwd(),
                    env: process.env,
                });

                if (createResult.status !== 0) {
                    failedFindings++;
                    const failMsg = `Failed to create issue for finding "${finding.title}"`;
                    console.warn(`    Warning: ${failMsg}`);
                    logError(logCtx, failMsg, false);
                    if (createResult.stderr) console.warn(`    ${createResult.stderr.slice(0, 200)}`);
                }
            }

            // If some findings failed to create, don't mark as reviewed so it gets retried
            if (failedFindings > 0 && failedFindings === findingsCount) {
                const allFailedMsg = `All ${failedFindings} finding(s) failed to create — not marking as reviewed`;
                console.warn(`    ${allFailedMsg}`);
                logError(logCtx, allFailedMsg, true);
                await logExecutionEnd(logCtx, {
                    success: false,
                    toolCallsCount: result.toolCallsCount ?? 0,
                    totalTokens: calcTotalTokens(result.usage),
                    totalCost: result.usage?.totalCostUSD ?? 0,
                });
                return { success: false, findingsCount: 0 };
            }
            if (failedFindings > 0) {
                console.warn(`    ${failedFindings}/${findingsCount} finding(s) failed to create — proceeding with partial results`);
            }

            // Append review section to log file
            const reviewSection = formatReviewSection(output, issueNumber);
            try {
                appendFileSync(logFilePath, reviewSection);
                console.log(`    Appended ${LOG_REVIEW_MARKER} section to log file`);
            } catch (err) {
                const appendErr = `Failed to append review section to log file: ${err}`;
                console.warn(`    Warning: ${appendErr}`);
                logError(logCtx, appendErr, false);
            }

            // Update DB
            const summaryText = output.executiveSummary.overallAssessment;
            await setWorkflowReviewData(issueNumber, true, summaryText);
            console.log('    Updated DB: reviewed = true');

            // Send Telegram notification
            await notifyWorkflowReviewComplete(item.title, issueNumber, summaryText, findingsCount);

            // Log execution end
            await logExecutionEnd(logCtx, {
                success: true,
                toolCallsCount: result.toolCallsCount ?? 0,
                totalTokens: calcTotalTokens(result.usage),
                totalCost: result.usage?.totalCostUSD ?? 0,
            });

            return { success: true, findingsCount };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`    Error: ${errorMsg}`);

            logError(logCtx, error instanceof Error ? error : errorMsg, true);
            await logExecutionEnd(logCtx, {
                success: false,
                toolCallsCount: 0,
                totalTokens: 0,
                totalCost: 0,
            });

            return { success: false, findingsCount: 0 };
        }
    });
}

// ============================================================
// MAIN
// ============================================================

async function run(options: CommonCLIOptions): Promise<void> {
    // Query Done items that haven't been reviewed
    console.log('  Fetching Done items...');
    const doneItems = await findAllWorkflowItems({ status: 'Done' });
    const candidates = doneItems
        .filter(item => item.reviewed !== true && item.githubIssueNumber != null)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    console.log(`  Found ${candidates.length} unreviewed Done item(s)`);

    if (candidates.length === 0) {
        console.log('  No items to review.');
        return;
    }

    // Filter by ID if specified
    let itemsToProcess = candidates;
    if (options.id) {
        itemsToProcess = candidates.filter(item =>
            String(item.githubIssueNumber) === options.id ||
            String(item._id).startsWith(options.id!)
        );
        if (itemsToProcess.length === 0) {
            console.log(`  No matching item found for ID: ${options.id}`);
            return;
        }
    }

    // Apply limit
    const limit = options.limit ?? DEFAULT_LIMIT;
    itemsToProcess = itemsToProcess.slice(0, limit);

    console.log(`  Processing ${itemsToProcess.length} item(s) (limit: ${limit})`);

    // Process each item
    let succeeded = 0;
    let failed = 0;
    let totalFindings = 0;

    for (const item of itemsToProcess) {
        try {
            const result = await processItem(item, options);
            if (result.success) {
                succeeded++;
                totalFindings += result.findingsCount;
            } else {
                failed++;
            }
        } catch (error) {
            failed++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`    Error processing issue #${item.githubIssueNumber}: ${errorMessage}`);
        }
    }

    // Print summary
    console.log('\n  ----------------------------------------');
    console.log(`  Review Summary: ${succeeded} succeeded, ${failed} failed, ${totalFindings} total finding(s)`);
    console.log('  ----------------------------------------\n');
}

async function main(): Promise<void> {
    const { options } = createCLI({
        name: 'workflow-review',
        displayName: 'Workflow Review Agent',
        description: 'Review completed workflow items and create improvement issues',
    });

    await run(options);
}

runAgentMain(main, { skipInTest: true });
