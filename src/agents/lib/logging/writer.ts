import fs from 'fs';
import path from 'path';
import { isS3LoggingEnabled, s3LogExists, s3ReadLog, s3WriteLog, s3AppendToLog } from './s3-writer';

/**
 * Base directory for agent logs
 */
const LOGS_DIR = path.join(process.cwd(), 'agent-logs');

/**
 * Track pending S3 log write promises so they can be flushed before process exit.
 * This prevents log loss in short-lived environments like Vercel serverless functions.
 */
const pendingLogWrites: Promise<void>[] = [];

/**
 * Ensure the logs directory exists
 */
export function ensureLogDir(): void {
    if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
}

/**
 * Get the log file path for an issue
 */
export function getLogPath(issueNumber: number): string {
    return path.join(LOGS_DIR, `issue-${issueNumber}.md`);
}

/**
 * Write the log file header
 * When S3 logging is enabled, writes to S3 with fire-and-forget async
 */
export function writeLogHeader(
    issueNumber: number,
    title: string,
    issueType?: string
): void {
    const header = `# Issue #${issueNumber}: ${title}

**Type:** ${issueType || 'Unknown'}
**Started:** ${new Date().toISOString()}

---

`;

    // If S3 logging is enabled, write to S3 and track the promise
    if (isS3LoggingEnabled()) {
        const promise = s3WriteLog(issueNumber, header).catch((err) => {
            console.error(`Failed to write log header to S3 for issue #${issueNumber}:`, err);
        });
        pendingLogWrites.push(promise);
        return;
    }

    // Fall back to local file (may fail on read-only filesystems like Vercel)
    try {
        ensureLogDir();
        const logPath = getLogPath(issueNumber);
        fs.writeFileSync(logPath, header, 'utf-8');
    } catch (err) {
        console.warn(`Failed to write local log for issue #${issueNumber}:`, err instanceof Error ? err.message : err);
    }
}

/**
 * Append content to a log file
 * When S3 logging is enabled, appends to S3 with fire-and-forget async
 */
export function appendToLog(issueNumber: number, content: string): void {
    // If S3 logging is enabled, append to S3 and track the promise
    if (isS3LoggingEnabled()) {
        const promise = s3AppendToLog(issueNumber, content).catch((err) => {
            console.error(`Failed to append to S3 log for issue #${issueNumber}:`, err);
        });
        pendingLogWrites.push(promise);
        return;
    }

    // Fall back to local file (may fail on read-only filesystems like Vercel)
    try {
        ensureLogDir();
        const logPath = getLogPath(issueNumber);
        fs.appendFileSync(logPath, content, 'utf-8');
    } catch (err) {
        console.warn(`Failed to append to local log for issue #${issueNumber}:`, err instanceof Error ? err.message : err);
    }
}

/**
 * Check if a log file exists
 * Note: For S3, this returns a cached/sync check - actual S3 check is async
 */
export function logExists(issueNumber: number): boolean {
    // For S3 logging, we can't do a sync check, so we always return true
    // to allow logging attempts (they'll be fire-and-forget anyway)
    if (isS3LoggingEnabled()) {
        return true;
    }

    // Fall back to local file check
    return fs.existsSync(getLogPath(issueNumber));
}

/**
 * Check if a log file exists (async version for S3)
 */
export async function logExistsAsync(issueNumber: number): Promise<boolean> {
    if (isS3LoggingEnabled()) {
        return await s3LogExists(issueNumber);
    }

    return fs.existsSync(getLogPath(issueNumber));
}

/**
 * Read the entire log file content
 */
export function readLog(issueNumber: number): string {
    const logPath = getLogPath(issueNumber);
    if (!fs.existsSync(logPath)) {
        return '';
    }
    return fs.readFileSync(logPath, 'utf-8');
}

/**
 * Read the entire log file content (async, S3-aware)
 * When S3 logging is enabled, reads from S3; otherwise reads from local disk.
 */
export async function readLogAsync(issueNumber: number): Promise<string> {
    if (isS3LoggingEnabled()) {
        return await s3ReadLog(issueNumber);
    }

    const logPath = getLogPath(issueNumber);
    if (!fs.existsSync(logPath)) {
        return '';
    }
    return fs.readFileSync(logPath, 'utf-8');
}

/**
 * Write the entire log file content (overwrites existing)
 */
export function writeLog(issueNumber: number, content: string): void {
    try {
        ensureLogDir();
        const logPath = getLogPath(issueNumber);
        fs.writeFileSync(logPath, content, 'utf-8');
    } catch (err) {
        console.warn(`Failed to write local log for issue #${issueNumber}:`, err instanceof Error ? err.message : err);
    }
}

/**
 * Write the entire log file content (async, S3-aware)
 * When S3 logging is enabled, writes to S3; otherwise writes to local disk.
 */
export async function writeLogAsync(issueNumber: number, content: string): Promise<void> {
    if (isS3LoggingEnabled()) {
        await s3WriteLog(issueNumber, content);
        return;
    }

    try {
        ensureLogDir();
        const logPath = getLogPath(issueNumber);
        fs.writeFileSync(logPath, content, 'utf-8');
    } catch (err) {
        console.warn(`Failed to write local log for issue #${issueNumber}:`, err instanceof Error ? err.message : err);
    }
}

/**
 * Flush all pending S3 log writes.
 * Call this before the process exits to ensure no logs are lost.
 * In non-S3 mode (local filesystem), this is a no-op.
 */
export async function flushPendingLogs(): Promise<void> {
    if (pendingLogWrites.length === 0) {
        return;
    }
    const writes = pendingLogWrites.splice(0, pendingLogWrites.length);
    await Promise.allSettled(writes);
}
