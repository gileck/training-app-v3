import fs from 'fs';
import path from 'path';

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
 */
export function writeLogHeader(
    issueNumber: number,
    title: string,
    issueType?: string
): void {
    ensureLogDir();
    const logPath = getLogPath(issueNumber);

    const header = `# Issue #${issueNumber}: ${title}

**Type:** ${issueType || 'Unknown'}
**Started:** ${new Date().toISOString()}

---

`;

    fs.writeFileSync(logPath, header, 'utf-8');
}

/**
 * Append content to a log file
 */
export function appendToLog(issueNumber: number, content: string): void {
    ensureLogDir();
    const logPath = getLogPath(issueNumber);

    fs.appendFileSync(logPath, content, 'utf-8');
}

/**
 * Check if a log file exists
 */
export function logExists(issueNumber: number): boolean {
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
