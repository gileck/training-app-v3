import fs from 'fs';
import path from 'path';
import { isS3LoggingEnabled, s3LogExists, s3WriteLog, s3AppendToLog } from './s3-writer';

/**
 * Base directory for agent logs
 */
const LOGS_DIR = path.join(process.cwd(), 'agent-logs');

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

    // If S3 logging is enabled, write to S3 asynchronously
    if (isS3LoggingEnabled()) {
        s3WriteLog(issueNumber, header).catch((err) => {
            console.error(`Failed to write log header to S3 for issue #${issueNumber}:`, err);
        });
        return;
    }

    // Fall back to local file
    ensureLogDir();
    const logPath = getLogPath(issueNumber);
    fs.writeFileSync(logPath, header, 'utf-8');
}

/**
 * Append content to a log file
 * When S3 logging is enabled, appends to S3 with fire-and-forget async
 */
export function appendToLog(issueNumber: number, content: string): void {
    // If S3 logging is enabled, append to S3 asynchronously
    if (isS3LoggingEnabled()) {
        s3AppendToLog(issueNumber, content).catch((err) => {
            console.error(`Failed to append to S3 log for issue #${issueNumber}:`, err);
        });
        return;
    }

    // Fall back to local file
    ensureLogDir();
    const logPath = getLogPath(issueNumber);
    fs.appendFileSync(logPath, content, 'utf-8');
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
 * Write the entire log file content (overwrites existing)
 */
export function writeLog(issueNumber: number, content: string): void {
    ensureLogDir();
    const logPath = getLogPath(issueNumber);
    fs.writeFileSync(logPath, content, 'utf-8');
}
