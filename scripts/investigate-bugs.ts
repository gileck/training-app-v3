#!/usr/bin/env tsx
/**
 * Bug Investigation CLI Script
 *
 * Automatically investigates bug reports using Claude Code SDK.
 * Performs read-only analysis to find root causes and propose fixes.
 *
 * Prerequisites:
 *   - Claude Code CLI installed and authenticated (run `claude login`)
 *
 * Usage:
 *   yarn investigate-bugs                    # Investigate all uninvestigated reports
 *   yarn investigate-bugs --id <id>          # Investigate specific report
 *   yarn investigate-bugs --limit 5          # Limit to 5 reports
 *   yarn investigate-bugs --timeout 300      # Set timeout to 5 minutes (default: 600s)
 *   yarn investigate-bugs --dry-run          # Don't save results
 *   yarn investigate-bugs --stream           # Stream Claude's full thinking in real-time
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { query, type SDKAssistantMessage, type SDKResultMessage, type SDKToolProgressMessage } from '@anthropic-ai/claude-agent-sdk';
import {
    ReportDocument,
    Investigation,
    InvestigationStatus,
    ConfidenceLevel,
    SessionLogEntry,
    ReportSummary,
} from '../src/server/database/collections/reports';

// ============================================================
// CONFIGURATION
// ============================================================
const MODEL = 'sonnet';
const MAX_TURNS = 100;
const DEFAULT_TIMEOUT_SECONDS = 600; // 10 minutes
const PROJECT_ROOT = process.cwd();

// ============================================================
// TYPES
// ============================================================
interface InvestigationOutput {
    status: InvestigationStatus;
    headline: string;
    summary: string;
    confidence: ConfidenceLevel;
    rootCause?: string;
    proposedFix?: {
        description: string;
        files: Array<{ path: string; changes: string }>;
        complexity: 'low' | 'medium' | 'high';
    };
    analysisNotes?: string;
    filesExamined?: string[];
}

interface CLIOptions {
    id?: string;
    limit?: number;
    timeout: number;
    dryRun: boolean;
    verbose: boolean;
    stream: boolean;
}

// ============================================================
// DATABASE CONNECTION
// ============================================================

// Load environment variables
function loadEnv(): void {
    const envPath = path.join(PROJECT_ROOT, '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const match = line.match(/^([^=]+)=["']?(.+?)["']?$/);
            if (match && !process.env[match[1]]) {
                process.env[match[1]] = match[2];
            }
        }
    }

    const envLocalPath = path.join(PROJECT_ROOT, '.env.local');
    if (fs.existsSync(envLocalPath)) {
        const content = fs.readFileSync(envLocalPath, 'utf-8');
        for (const line of content.split('\n')) {
            const match = line.match(/^([^=]+)=["']?(.+?)["']?$/);
            if (match) {
                process.env[match[1]] = match[2];
            }
        }
    }
}

// Dynamic import for database (ESM compatibility)
async function getDatabase() {
    const { reports, closeDbConnection } = await import('../src/server/database');
    return { reports, closeDbConnection };
}

// ============================================================
// PROMPT BUILDING
// ============================================================

function formatSessionLogs(logs: SessionLogEntry[]): string {
    if (!logs || logs.length === 0) return 'No session logs available';

    return logs
        .map((log) => {
            const time = log.performanceTime ? `[${(log.performanceTime / 1000).toFixed(1)}s]` : '';
            const meta = log.meta ? ` | ${JSON.stringify(log.meta)}` : '';
            return `${time} [${log.level.toUpperCase()}] ${log.feature}: ${log.message}${meta}`;
        })
        .join('\n');
}

function formatBrowserInfo(browserInfo: ReportDocument['browserInfo']): string {
    if (!browserInfo) return 'No browser info available';
    return `User Agent: ${browserInfo.userAgent}
Viewport: ${browserInfo.viewport.width}x${browserInfo.viewport.height}
Language: ${browserInfo.language}`;
}

function formatUserInfo(userInfo: ReportDocument['userInfo']): string {
    if (!userInfo) return 'Anonymous user';
    const parts: string[] = [];
    if (userInfo.username) parts.push(`Username: ${userInfo.username}`);
    if (userInfo.email) parts.push(`Email: ${userInfo.email}`);
    if (userInfo.userId) parts.push(`User ID: ${userInfo.userId}`);
    return parts.length > 0 ? parts.join(', ') : 'Anonymous user';
}

function hasReactMinifiedError(errorMessage: string | undefined, stackTrace: string | undefined): string | null {
    // React minified errors contain URLs like: https://reactjs.org/docs/error-decoder.html?invariant=XXX
    // or https://react.dev/errors/XXX
    const text = `${errorMessage || ''} ${stackTrace || ''}`;

    const reactErrorMatch = text.match(/https:\/\/react\.dev\/errors\/\d+[^\s)"]*/);
    if (reactErrorMatch) {
        return reactErrorMatch[0];
    }

    const legacyMatch = text.match(/https:\/\/reactjs\.org\/docs\/error-decoder\.html\?invariant=\d+[^\s)"]*/);
    if (legacyMatch) {
        return legacyMatch[0];
    }

    return null;
}

function buildInvestigationPrompt(report: ReportDocument): string {
    const reactErrorUrl = hasReactMinifiedError(report.errorMessage, report.stackTrace);

    return `You are investigating a bug report. Your task is to:
1. Understand the bug from the report details
2. Search the codebase to find the relevant code
3. Identify the root cause (if possible)
4. Propose a high-level fix (files to change and what to change)

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## CRITICAL: First Steps Before Investigation

${reactErrorUrl ? `### 🚨 REACT MINIFIED ERROR DETECTED
The error contains a React minified error URL. You MUST fetch the full unminified error FIRST before doing anything else:

**Fetch this URL immediately:** ${reactErrorUrl}

Use WebFetch to get the full error message, then proceed with investigation.

` : ''}### 🎯 Route-Based Investigation
The bug occurred on route: \`${report.route}\`

**Your first step:** Read \`src/client/routes/index.ts\` to find which component handles this route.
The file maps routes to components like: \`'/path': ComponentName\` or \`'/path/:param': ComponentName\`

Once you identify the component, investigate it at \`src/client/routes/{ComponentName}/\`

## Bug Report Details

**Report ID:** ${report._id.toString()}
**Type:** ${report.type}
**Category:** ${report.category || 'bug'}
**Status:** ${report.status}
**Route:** ${report.route}
**Network Status:** ${report.networkStatus}
**Created At:** ${report.createdAt.toISOString()}

**Description:** ${report.description || 'No description provided'}

**Error Message:** ${report.errorMessage || 'None'}

**Stack Trace:**
\`\`\`
${report.stackTrace || 'None'}
\`\`\`

## User & Environment

**User:** ${formatUserInfo(report.userInfo)}
**Browser:**
${formatBrowserInfo(report.browserInfo)}

## Session Logs (ALL)

${formatSessionLogs(report.sessionLogs || [])}

${
    report.category === 'performance' && report.performanceEntries && report.performanceEntries.length > 0
        ? `## Performance Entries
\`\`\`json
${JSON.stringify(report.performanceEntries, null, 2)}
\`\`\``
        : ''
}

## Your Task

Investigate this bug and provide your findings. At the END of your investigation, you MUST output a JSON block with your findings.

## Investigation Strategy

1. ${reactErrorUrl ? '**FIRST**: Fetch the React error URL to get the full unminified error message' : '**FIRST**: Read `src/client/routes/index.ts` to find the component for route `' + report.route + '`'}
2. ${reactErrorUrl ? '**THEN**: Read `src/client/routes/index.ts` to find the component for route `' + report.route + '`' : 'Read the component at `src/client/routes/{ComponentName}/`'}
3. Look at hooks, stores, and API calls used by this component
4. Check session logs for clues about what happened before the error
5. Identify the root cause and propose a fix

## Output Schema

Your final output MUST be a JSON object in this exact format (wrapped in \`\`\`json code block):

\`\`\`json
{
  "status": "<investigation_status>",
  "headline": "<single_line_summary_max_80_chars>",
  "summary": "<detailed_1_to_3_sentence_summary>",
  "confidence": "<low|medium|high>",
  "rootCause": "<root_cause_description_if_found>",
  "proposedFix": {
    "description": "<fix_description>",
    "files": [
      { "path": "<relative_file_path>", "changes": "<what_to_change_high_level>" }
    ],
    "complexity": "<low|medium|high>"
  },
  "analysisNotes": "<additional_notes_optional>",
  "filesExamined": ["<list_of_files_you_read>"]
}
\`\`\`

## Status Field Definitions

Choose ONE status:

- **needs_info**: You understand the bug but need more details to find root cause. Use when: report lacks reproduction steps, logs don't show the issue, or context is missing.

- **root_cause_found**: You identified exactly why the bug happens AND can propose specific file changes. Use when: you can point to specific code and describe concrete changes.

- **complex_fix**: You found the root cause but the fix requires many files or architectural decisions. Use when: fix spans multiple systems or needs team discussion.

- **not_a_bug**: This isn't a bug. Use when: it's a feature request, expected behavior, already fixed, or invalid report.

- **inconclusive**: You thoroughly investigated but couldn't determine the cause. Use when: you hit a dead end despite checking relevant code.

## Confidence Levels

- **high**: Clear evidence in code, reproducible logic path identified
- **medium**: Reasonably confident but some assumptions made
- **low**: Best guess based on limited evidence

Now investigate the bug and provide your JSON findings at the end.`;
}

// ============================================================
// PROGRESS INDICATOR
// ============================================================

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ============================================================
// CLAUDE CODE SDK EXECUTION
// ============================================================

interface UsageStats {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    totalCostUSD: number;
}

async function runInvestigation(
    prompt: string,
    options: { verbose: boolean; stream: boolean; timeout: number }
): Promise<{ result: string; filesExamined: string[]; usage: UsageStats | null }> {
    const startTime = Date.now();
    let lastResult = '';
    let toolCallCount = 0;
    const filesExamined: string[] = [];
    let usage: UsageStats | null = null;

    let spinnerInterval: NodeJS.Timeout | null = null;
    let spinnerFrame = 0;

    // Set up timeout abort controller
    const abortController = new AbortController();
    const timeoutMs = options.timeout * 1000;
    const timeoutId = setTimeout(() => {
        abortController.abort();
    }, timeoutMs);

    if (!options.stream) {
        spinnerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
            const timeoutInfo = options.timeout > 0 ? `/${options.timeout}s` : '';
            process.stdout.write(`\r  ${frame} Investigating... (${elapsed}s${timeoutInfo}, ${toolCallCount} tools)\x1b[K`);
            spinnerFrame++;
        }, 100);
    }

    try {
        for await (const message of query({
            prompt,
            options: {
                allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch'],
                cwd: PROJECT_ROOT,
                model: MODEL,
                maxTurns: MAX_TURNS,
                permissionMode: 'bypassPermissions',
                allowDangerouslySkipPermissions: true,
                abortController,
            },
        })) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);

            // Handle assistant messages
            if (message.type === 'assistant') {
                const assistantMsg = message as SDKAssistantMessage;
                // Extract text content from the message
                const textParts: string[] = [];
                for (const block of assistantMsg.message.content) {
                    if (block.type === 'text') {
                        textParts.push((block as { type: 'text'; text: string }).text);
                    }
                }
                const textContent = textParts.join('\n');

                if (textContent && options.stream) {
                    const lines = textContent.split('\n').filter((l: string) => l.trim());
                    for (const line of lines) {
                        console.log(`    \x1b[90m${line}\x1b[0m`);
                    }
                }

                // Track tool uses within assistant message
                for (const block of assistantMsg.message.content) {
                    if (block.type === 'tool_use') {
                        toolCallCount++;
                        const toolUse = block as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
                        const toolName = toolUse.name;
                        const toolInput = toolUse.input;

                        if (toolName === 'Read' && toolInput?.file_path) {
                            const filePath = String(toolInput.file_path).replace(PROJECT_ROOT + '/', '');
                            if (!filesExamined.includes(filePath)) {
                                filesExamined.push(filePath);
                            }
                        }

                        if (options.stream) {
                            let target = '';
                            if (toolInput) {
                                if (toolInput.file_path) {
                                    target = ` → ${String(toolInput.file_path).split('/').slice(-2).join('/')}`;
                                } else if (toolInput.pattern) {
                                    target = ` → "${toolInput.pattern}"`;
                                }
                            }
                            console.log(`  \x1b[36m[${elapsed}s] 🔧 ${toolName}${target}\x1b[0m`);
                        }
                    }
                }

                // Keep track of last text content
                if (textContent) {
                    lastResult = textContent;
                }
            }

            // Handle tool progress (shows when tool is running)
            if (message.type === 'tool_progress') {
                const progressMsg = message as SDKToolProgressMessage;
                if (options.stream && options.verbose) {
                    console.log(`  \x1b[33m[${elapsed}s] ⏳ ${progressMsg.tool_name} running...\x1b[0m`);
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

        clearTimeout(timeoutId);
        if (spinnerInterval) clearInterval(spinnerInterval);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        // Format usage info for display
        let usageInfo = '';
        if (usage) {
            const totalTokens = usage.inputTokens + usage.outputTokens;
            usageInfo = `, ${totalTokens.toLocaleString()} tokens, $${usage.totalCostUSD.toFixed(4)}`;
        }
        console.log(`\r  \x1b[32m✓ Investigation complete (${elapsed}s, ${toolCallCount} tool calls${usageInfo})\x1b[0m\x1b[K`);

        return { result: lastResult, filesExamined, usage };
    } catch (error) {
        clearTimeout(timeoutId);
        if (spinnerInterval) clearInterval(spinnerInterval);

        // Check if it was a timeout
        if (abortController.signal.aborted) {
            console.log(`\r  \x1b[31m✗ Timeout after ${options.timeout}s\x1b[0m\x1b[K`);
            throw new Error(`Investigation timed out after ${options.timeout} seconds`);
        }

        console.log(`\r  \x1b[31m✗ Error\x1b[0m\x1b[K`);
        throw error;
    }
}

// ============================================================
// INVESTIGATION LOGIC
// ============================================================

async function investigateReport(
    report: ReportDocument,
    options: CLIOptions
): Promise<{ investigation: Investigation | null; usage: UsageStats | null }> {
    const prompt = buildInvestigationPrompt(report);

    if (options.verbose && !options.stream) {
        console.log('\n--- Investigation Prompt (truncated) ---');
        console.log(prompt.slice(0, 500) + '...');
        console.log('----------------------------------------\n');
    }

    try {
        console.log(''); // New line before spinner
        const { result, filesExamined, usage } = await runInvestigation(prompt, {
            verbose: options.verbose,
            stream: options.stream,
            timeout: options.timeout,
        });

        if (options.verbose) {
            console.log('\n--- Claude Output (last 2000 chars) ---');
            console.log(result.slice(-2000));
            console.log('---------------------------------------\n');
        }

        // Parse the JSON output
        const parsed = parseInvestigationOutput(result);

        // Build the Investigation object
        let investigation: Investigation;

        if (parsed) {
            investigation = {
                status: parsed.status,
                headline: parsed.headline.slice(0, 100),
                summary: parsed.summary,
                confidence: parsed.confidence,
                rootCause: parsed.rootCause,
                proposedFix: parsed.proposedFix,
                analysisNotes: parsed.analysisNotes,
                filesExamined: parsed.filesExamined || filesExamined,
                investigatedAt: new Date(),
                investigatedBy: 'agent',
            };
        } else {
            // Fallback: create an inconclusive investigation with the raw output
            console.warn('  JSON parsing failed, creating fallback investigation');
            const lastLines = result.split('\n').filter(l => l.trim()).slice(-10).join(' ');
            investigation = {
                status: 'inconclusive',
                headline: 'Investigation incomplete - no structured output',
                summary: `Agent investigated but did not produce structured findings. Last output: ${lastLines.slice(0, 500)}`,
                confidence: 'low',
                analysisNotes: result.slice(-2000),
                filesExamined,
                investigatedAt: new Date(),
                investigatedBy: 'agent',
            };
        }

        return { investigation, usage };
    } catch (error) {
        console.error('  Investigation error:', error instanceof Error ? error.message : error);
        return { investigation: null, usage: null };
    }
}

function parseInvestigationOutput(text: string): InvestigationOutput | null {
    if (!text) return null;

    try {
        // Try to find JSON block in the text
        // Look for ```json ... ``` pattern first
        const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        let jsonStr = jsonBlockMatch?.[1];

        // If no code block, try to find raw JSON object
        if (!jsonStr) {
            const rawJsonMatch = text.match(/\{[\s\S]*"status"[\s\S]*"headline"[\s\S]*\}/);
            jsonStr = rawJsonMatch?.[0];
        }

        if (!jsonStr) {
            console.error('  Could not find JSON in output');
            return null;
        }

        const parsed = JSON.parse(jsonStr);

        // Validate required fields
        if (!parsed.status || !parsed.headline || !parsed.summary || !parsed.confidence) {
            console.error('  Missing required fields in output');
            return null;
        }

        // Validate status
        const validStatuses: InvestigationStatus[] = [
            'needs_info',
            'root_cause_found',
            'complex_fix',
            'not_a_bug',
            'inconclusive',
        ];
        if (!validStatuses.includes(parsed.status)) {
            console.error(`  Invalid status: ${parsed.status}`);
            return null;
        }

        // Validate confidence
        const validConfidence: ConfidenceLevel[] = ['low', 'medium', 'high'];
        if (!validConfidence.includes(parsed.confidence)) {
            console.error(`  Invalid confidence: ${parsed.confidence}`);
            return null;
        }

        return parsed;
    } catch (error) {
        console.error('  JSON parse error:', error);
        return null;
    }
}

// ============================================================
// DUPLICATE DETECTION
// ============================================================

function buildDuplicateDetectionPrompt(
    investigatedReport: ReportDocument,
    potentialDuplicates: ReportSummary[]
): string {
    const duplicatesList = potentialDuplicates
        .map((r, i) => {
            return `${i + 1}. ID: ${r._id.toString()}
   Description: "${r.description || 'None'}"
   Error: "${r.errorMessage || 'None'}"
   Route: ${r.route}
   Created: ${r.createdAt.toISOString()}`;
        })
        .join('\n\n');

    return `You just investigated a bug report. Now identify if any other reports in the same time period are DUPLICATES of this report.

## Investigated Report

**ID:** ${investigatedReport._id.toString()}
**Description:** "${investigatedReport.description || 'None'}"
**Error:** "${investigatedReport.errorMessage || 'None'}"
**Route:** ${investigatedReport.route}

## Potential Duplicates

${duplicatesList}

## Instructions

A report is a DUPLICATE if:
- It describes the SAME underlying bug/issue (not just similar symptoms)
- The error message is identical or nearly identical
- It's on the same route with the same failure mode

A report is NOT a duplicate if:
- It's a different bug that just happened around the same time
- It's on a different route (unless it's clearly the same underlying issue)
- The error is different even if the route is the same

## Response Format

Respond with ONLY a JSON array of duplicate report IDs. Include only reports you are confident are duplicates.

Examples:
- If reports 1 and 3 are duplicates: ["${potentialDuplicates[0]?._id.toString() || 'abc123'}", "${potentialDuplicates[2]?._id.toString() || 'def456'}"]
- If no duplicates found: []

Your response (JSON array only):`;
}

async function detectDuplicates(
    investigatedReport: ReportDocument,
    options: CLIOptions,
    reportsModule: Awaited<ReturnType<typeof getDatabase>>['reports']
): Promise<string[]> {
    // Fetch reports in +/- 2 day window
    const potentialDuplicates = await reportsModule.findReportsInTimeRange(
        investigatedReport.createdAt,
        2, // days before
        2, // days after
        [investigatedReport._id] // exclude the investigated report itself
    );

    if (potentialDuplicates.length === 0) {
        if (options.verbose) {
            console.log('    No potential duplicates found in time range.');
        }
        return [];
    }

    console.log(`    Checking ${potentialDuplicates.length} potential duplicate(s)...`);

    const prompt = buildDuplicateDetectionPrompt(investigatedReport, potentialDuplicates);

    try {
        // Use a simpler query for duplicate detection (no tools needed)
        let lastResult = '';

        for await (const message of query({
            prompt,
            options: {
                allowedTools: [], // No tools needed - just analysis
                cwd: PROJECT_ROOT,
                model: MODEL,
                maxTurns: 1, // Single turn response
                permissionMode: 'bypassPermissions',
                allowDangerouslySkipPermissions: true,
            },
        })) {
            if (message.type === 'assistant') {
                const assistantMsg = message as SDKAssistantMessage;
                for (const block of assistantMsg.message.content) {
                    if (block.type === 'text') {
                        lastResult += (block as { type: 'text'; text: string }).text;
                    }
                }
            }
            if (message.type === 'result') {
                const resultMsg = message as SDKResultMessage;
                if (resultMsg.subtype === 'success' && resultMsg.result) {
                    lastResult = resultMsg.result;
                }
            }
        }

        // Parse the response - expect a JSON array of IDs
        const cleanedResult = lastResult.trim();

        // Try to extract JSON array from the response
        let jsonStr = cleanedResult;

        // If wrapped in code block, extract it
        const codeBlockMatch = cleanedResult.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1];
        }

        // Try to find array pattern
        const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            jsonStr = arrayMatch[0];
        }

        const duplicateIds: string[] = JSON.parse(jsonStr);

        if (!Array.isArray(duplicateIds)) {
            console.warn('    Duplicate detection returned non-array, skipping.');
            return [];
        }

        // Validate that returned IDs are in the potential duplicates list
        const validIds = potentialDuplicates.map(r => r._id.toString());
        const confirmedDuplicates = duplicateIds.filter(id => validIds.includes(id));

        if (confirmedDuplicates.length !== duplicateIds.length) {
            console.warn(`    Warning: Some returned IDs were not in the candidate list.`);
        }

        return confirmedDuplicates;
    } catch (error) {
        console.warn('    Duplicate detection failed:', error instanceof Error ? error.message : error);
        return [];
    }
}

// ============================================================
// MAIN CLI
// ============================================================

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('investigate-bugs')
        .description('Automatically investigate bug reports using Claude Code SDK')
        .option('--id <reportId>', 'Investigate a specific report by ID')
        .option('--limit <number>', 'Limit number of reports to process', parseInt)
        .option('--timeout <seconds>', 'Timeout per investigation in seconds (default: 600)', parseInt)
        .option('--dry-run', 'Run without saving results to database', false)
        .option('--stream', "Stream Claude's full thinking and tool calls in real-time", false)
        .option('--verbose', 'Show additional debug output (prompt, final result, tool progress)', false)
        .parse(process.argv);

    const opts = program.opts();
    const options: CLIOptions = {
        id: opts.id as string | undefined,
        limit: opts.limit as number | undefined,
        timeout: (opts.timeout as number | undefined) ?? DEFAULT_TIMEOUT_SECONDS,
        dryRun: Boolean(opts.dryRun),
        verbose: Boolean(opts.verbose),
        stream: Boolean(opts.stream),
    };

    console.log('\n========================================');
    console.log('  Bug Investigation Agent');
    console.log('========================================');
    console.log(`  Timeout: ${options.timeout}s per report\n`);

    // Load environment
    loadEnv();

    if (!process.env.MONGO_URI) {
        console.error('Error: MONGO_URI environment variable is not set.');
        console.error('Please ensure your .env or .env.local file contains MONGO_URI.');
        process.exit(1);
    }

    // Connect to database
    console.log('Connecting to database...');
    const { reports, closeDbConnection } = await getDatabase();

    try {
        let reportsToInvestigate: ReportDocument[];

        if (options.id) {
            // Investigate specific report
            console.log(`Fetching report: ${options.id}`);
            const report = await reports.findReportById(options.id);
            if (!report) {
                console.error(`Report not found: ${options.id}`);
                process.exit(1);
            }
            reportsToInvestigate = [report];
        } else {
            // Fetch uninvestigated reports
            console.log('Fetching uninvestigated reports...');
            reportsToInvestigate = await reports.findUninvestigatedReports(options.limit);
        }

        if (reportsToInvestigate.length === 0) {
            console.log('\nNo uninvestigated reports found.');
            return;
        }

        console.log(`\nFound ${reportsToInvestigate.length} report(s) to investigate.\n`);

        // Track results
        const results = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            statuses: {} as Record<InvestigationStatus, number>,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCostUSD: 0,
        };

        // Process each report
        for (const report of reportsToInvestigate) {
            results.processed++;
            const reportId = report._id.toString();

            console.log(`----------------------------------------`);
            console.log(`[${results.processed}/${reportsToInvestigate.length}] Report: ${reportId}`);
            console.log(`  Type: ${report.type}`);
            console.log(`  Route: ${report.route}`);
            console.log(`  Description: ${report.description?.slice(0, 100) || 'None'}...`);
            console.log(`  Investigating...`);

            const { investigation, usage } = await investigateReport(report, options);

            // Accumulate usage stats
            if (usage) {
                results.totalInputTokens += usage.inputTokens;
                results.totalOutputTokens += usage.outputTokens;
                results.totalCostUSD += usage.totalCostUSD;
            }

            if (investigation) {
                results.succeeded++;
                results.statuses[investigation.status] = (results.statuses[investigation.status] || 0) + 1;

                console.log(`\n  Result:`);
                console.log(`    Status: ${investigation.status}`);
                console.log(`    Headline: ${investigation.headline}`);
                console.log(`    Confidence: ${investigation.confidence}`);
                console.log(`    Files examined: ${investigation.filesExamined.length}`);

                if (investigation.rootCause) {
                    console.log(`    Root cause: ${investigation.rootCause.slice(0, 100)}...`);
                }

                if (investigation.proposedFix) {
                    console.log(`    Fix complexity: ${investigation.proposedFix.complexity}`);
                    console.log(`    Files to change: ${investigation.proposedFix.files.length}`);
                }

                // Save to database (unless dry run)
                if (!options.dryRun) {
                    await reports.updateReportInvestigation(reportId, investigation);
                    console.log(`    Saved to database.`);

                    // Detect and mark duplicates
                    const duplicateIds = await detectDuplicates(report, options, reports);
                    if (duplicateIds.length > 0) {
                        console.log(`    Found ${duplicateIds.length} duplicate(s):`);
                        for (const dupId of duplicateIds) {
                            await reports.markReportAsDuplicate(dupId, report._id);
                            console.log(`      - Marked ${dupId} as duplicate`);
                        }
                    }
                } else {
                    console.log(`    [DRY RUN] Would save to database.`);

                    // Still run duplicate detection in dry-run mode to show what would happen
                    const duplicateIds = await detectDuplicates(report, options, reports);
                    if (duplicateIds.length > 0) {
                        console.log(`    [DRY RUN] Would mark ${duplicateIds.length} duplicate(s):`);
                        for (const dupId of duplicateIds) {
                            console.log(`      - Would mark ${dupId} as duplicate`);
                        }
                    }
                }
            } else {
                results.failed++;
                console.log(`  Failed to investigate.`);
            }

            console.log('');
        }

        // Print summary
        console.log('========================================');
        console.log('  Summary');
        console.log('========================================');
        console.log(`  Processed: ${results.processed}`);
        console.log(`  Succeeded: ${results.succeeded}`);
        console.log(`  Failed: ${results.failed}`);
        console.log('');
        console.log('  Status breakdown:');
        for (const [status, count] of Object.entries(results.statuses)) {
            console.log(`    ${status}: ${count}`);
        }
        console.log('');
        console.log('  Token usage:');
        console.log(`    Input tokens:  ${results.totalInputTokens.toLocaleString()}`);
        console.log(`    Output tokens: ${results.totalOutputTokens.toLocaleString()}`);
        console.log(`    Total tokens:  ${(results.totalInputTokens + results.totalOutputTokens).toLocaleString()}`);
        console.log(`    Total cost:    $${results.totalCostUSD.toFixed(4)}`);
        console.log('========================================\n');
    } finally {
        await closeDbConnection();
    }
}

// Run
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
