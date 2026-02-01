#!/usr/bin/env tsx
/**
 * View Agent Logs
 *
 * Simple CLI to list and view agent execution logs.
 * Since logs are Markdown, you can also just open them directly in your editor.
 *
 * Usage:
 *   yarn agent:logs --list               # List all log files
 *   yarn agent:logs --issue 42           # Display log for issue #42
 *   yarn agent:logs --recent             # Show most recent log
 */

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';

const LOGS_DIR = path.join(process.cwd(), 'agent-logs');

/**
 * Get all log files
 */
function getLogFiles(): Array<{ issueNumber: number; path: string; mtime: Date }> {
    if (!fs.existsSync(LOGS_DIR)) {
        return [];
    }

    const files = fs.readdirSync(LOGS_DIR);
    return files
        .filter((f) => f.startsWith('issue-') && f.endsWith('.md'))
        .map((f) => {
            const match = f.match(/issue-(\d+)\.md/);
            const issueNumber = match ? parseInt(match[1], 10) : 0;
            const filePath = path.join(LOGS_DIR, f);
            const stats = fs.statSync(filePath);
            return { issueNumber, path: filePath, mtime: stats.mtime };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

/**
 * List all log files
 */
function listLogs(): void {
    const logs = getLogFiles();

    if (logs.length === 0) {
        console.log('No agent logs found.');
        console.log(`Logs will be created in: ${LOGS_DIR}`);
        return;
    }

    console.log(`Found ${logs.length} agent log(s):\n`);
    for (const log of logs) {
        const content = fs.readFileSync(log.path, 'utf-8');
        const titleMatch = content.match(/# Issue #\d+: (.+)/);
        const title = titleMatch ? titleMatch[1] : 'Unknown';
        const relativeTime = getRelativeTime(log.mtime);

        console.log(`  • Issue #${log.issueNumber}: ${title}`);
        console.log(`    ${log.path}`);
        console.log(`    Last modified: ${relativeTime}\n`);
    }

    console.log('💡 Tip: Open these files in your editor or use:');
    console.log('   yarn agent:logs --issue <number>');
}

/**
 * Display a specific log
 */
function displayLog(issueNumber: number): void {
    const logPath = path.join(LOGS_DIR, `issue-${issueNumber}.md`);

    if (!fs.existsSync(logPath)) {
        console.error(`Log not found for issue #${issueNumber}`);
        console.log('\nAvailable logs:');
        listLogs();
        process.exit(1);
    }

    const content = fs.readFileSync(logPath, 'utf-8');
    console.log(content);
}

/**
 * Show most recent log
 */
function showRecent(): void {
    const logs = getLogFiles();

    if (logs.length === 0) {
        console.log('No agent logs found.');
        return;
    }

    const recent = logs[0];
    console.log(`Showing most recent log: Issue #${recent.issueNumber}\n`);
    displayLog(recent.issueNumber);
}

/**
 * Get relative time string
 */
function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
}

// ============================================================
// CLI
// ============================================================

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('view-agent-logs')
        .description('View agent execution logs')
        .option('--list', 'List all available logs', false)
        .option('--issue <number>', 'Display log for specific issue', parseInt)
        .option('--recent', 'Show most recent log', false)
        .parse(process.argv);

    const options = program.opts();

    if (options.issue) {
        displayLog(options.issue);
    } else if (options.recent) {
        showRecent();
    } else {
        // Default: list all logs
        listLogs();
    }
}

main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
