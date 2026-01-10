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
} from '../src/server/database/collections/reports/types';

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

function buildInvestigationPrompt(report: ReportDocument): string {
    return `You are investigating a bug report. Your task is to:
1. Understand the bug from the report details
2. Search the codebase to find the relevant code
3. Identify the root cause (if possible)
4. Propose a high-level fix (files to change and what to change)

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, and Grep tools.

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

## Guidelines

1. Start by understanding the error/route mentioned in the report
2. Search for relevant files using Glob and Grep
3. Read the code to understand the flow
4. Identify where the bug might occur
5. Track all files you examine for the filesExamined list
6. Be honest about confidence - don't overclaim

Now investigate the bug and provide your JSON findings at the end.`;
}

// ============================================================
// PROGRESS INDICATOR
// ============================================================

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ============================================================
// CLAUDE CODE SDK EXECUTION
// ============================================================

async function runInvestigation(
    prompt: string,
    options: { verbose: boolean; stream: boolean; timeout: number }
): Promise<{ result: string; filesExamined: string[] }> {
    const startTime = Date.now();
    let lastResult = '';
    let toolCallCount = 0;
    const filesExamined: string[] = [];

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
                allowedTools: ['Read', 'Glob', 'Grep'],
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
            }
        }

        clearTimeout(timeoutId);
        if (spinnerInterval) clearInterval(spinnerInterval);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        console.log(`\r  \x1b[32m✓ Investigation complete (${elapsed}s, ${toolCallCount} tool calls)\x1b[0m\x1b[K`);

        return { result: lastResult, filesExamined };
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
): Promise<Investigation | null> {
    const prompt = buildInvestigationPrompt(report);

    if (options.verbose && !options.stream) {
        console.log('\n--- Investigation Prompt (truncated) ---');
        console.log(prompt.slice(0, 500) + '...');
        console.log('----------------------------------------\n');
    }

    try {
        console.log(''); // New line before spinner
        const { result, filesExamined } = await runInvestigation(prompt, {
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

        return investigation;
    } catch (error) {
        console.error('  Investigation error:', error instanceof Error ? error.message : error);
        return null;
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

            const investigation = await investigateReport(report, options);

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
                } else {
                    console.log(`    [DRY RUN] Would save to database.`);
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
