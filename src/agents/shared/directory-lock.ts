/**
 * Directory-level lock for preventing concurrent agent runs on the same working directory.
 *
 * Lock file: {tmpdir()}/agent-dir-{sha256(cwd)}.lock
 * Uses O_EXCL for atomic creation after stale lock cleanup.
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { hostname, tmpdir } from 'os';
import path from 'path';

interface DirectoryLockContent {
    pid: number;
    cwd: string;
    startTime: string;
    hostname: string;
    agents: string[];
}

interface AcquireOptions {
    staleTimeoutMinutes: number;
    agents: string[];
}

// In-memory state for the current lock
let lockFilePath: string | null = null;
let lockStartTime: Date | null = null;
let cleanupRegistered = false;

function getLockFilePath(): string {
    const hash = createHash('sha256').update(process.cwd()).digest('hex');
    return path.join(tmpdir(), `agent-dir-${hash}.lock`);
}

function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatAge(startTime: string): string {
    const ageMs = Date.now() - new Date(startTime).getTime();
    return formatDuration(ageMs);
}

function registerCleanupHandlers(): void {
    if (cleanupRegistered) return;
    cleanupRegistered = true;

    const cleanup = () => {
        releaseDirectoryLock();
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => {
        console.log('\n🛑 Interrupted - cleaning up lock...');
        cleanup();
        process.exit(130);
    });
    process.on('SIGTERM', () => {
        console.log('\n🛑 Terminated - cleaning up lock...');
        cleanup();
        process.exit(143);
    });
    process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught exception:', error);
        cleanup();
        process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
        console.error('❌ Unhandled rejection:', reason);
        cleanup();
        process.exit(1);
    });
}

/**
 * Acquire a directory-level lock to prevent concurrent agent runs.
 *
 * Stale detection (checked in order):
 * 1. Lock exists, PID dead → stale from crash, clear & acquire
 * 2. Lock exists, age > staleTimeoutMinutes → stale even if PID alive, warn & force-clear
 * 3. Lock exists, PID alive, not stale → print lock info, return false
 *
 * @returns true if lock acquired, false if blocked by another instance
 */
export function acquireDirectoryLock(options: AcquireOptions): boolean {
    const filePath = getLockFilePath();
    const cwd = process.cwd();

    console.log(`\n🔒 [LOCK] Acquiring directory lock for ${cwd}...`);

    if (existsSync(filePath)) {
        let lockInfo: DirectoryLockContent;

        try {
            const content = readFileSync(filePath, 'utf-8');
            lockInfo = JSON.parse(content);
        } catch {
            console.warn('⚠️  [LOCK] Invalid lock file found — removing');
            try { unlinkSync(filePath); } catch { /* ignore */ }
            return writeLockFile(filePath, cwd, options);
        }

        const pidAlive = lockInfo.pid ? isProcessAlive(lockInfo.pid) : false;
        const ageMs = Date.now() - new Date(lockInfo.startTime).getTime();
        const ageMinutes = ageMs / 60000;

        // Case 1: PID dead → stale from crash
        if (!pidAlive) {
            console.warn(`⚠️  [LOCK] Stale lock from crashed process (PID ${lockInfo.pid} is dead) — clearing`);
            try { unlinkSync(filePath); } catch { /* ignore */ }
            return writeLockFile(filePath, cwd, options);
        }

        // Case 2: PID alive but age > staleTimeout → force-clear
        if (options.staleTimeoutMinutes > 0 && ageMinutes > options.staleTimeoutMinutes) {
            console.warn(`⚠️  [LOCK] Lock held by PID ${lockInfo.pid} (started ${formatAge(lockInfo.startTime)} ago at ${lockInfo.startTime})`);
            console.warn(`⚠️  [LOCK] Stale lock (>${options.staleTimeoutMinutes}m) — force-clearing and acquiring`);
            try { unlinkSync(filePath); } catch { /* ignore */ }
            return writeLockFile(filePath, cwd, options);
        }

        // Case 2b: staleTimeoutMinutes === 0 → always force-clear
        if (options.staleTimeoutMinutes === 0) {
            console.warn(`⚠️  [LOCK] Force-clearing lock (--stale-timeout 0)`);
            try { unlinkSync(filePath); } catch { /* ignore */ }
            return writeLockFile(filePath, cwd, options);
        }

        // Case 3: PID alive, not stale → blocked
        console.error(`⚠️  [LOCK] Lock held by PID ${lockInfo.pid} (started ${formatAge(lockInfo.startTime)} ago at ${lockInfo.startTime})`);
        console.error(`   Agents: ${lockInfo.agents.join(', ')}`);
        console.error(`   Hostname: ${lockInfo.hostname}`);
        console.error(`   Lock file: ${filePath}`);
        console.error(`   To force-clear: use --stale-timeout 0`);
        return false;
    }

    return writeLockFile(filePath, cwd, options);
}

/**
 * Write the lock file atomically using O_EXCL flag.
 */
function writeLockFile(filePath: string, cwd: string, options: AcquireOptions): boolean {
    const lockContent: DirectoryLockContent = {
        pid: process.pid,
        cwd,
        startTime: new Date().toISOString(),
        hostname: hostname(),
        agents: options.agents,
    };

    try {
        writeFileSync(filePath, JSON.stringify(lockContent, null, 2), { flag: 'wx' });
    } catch (error) {
        // O_EXCL failure means another process created the file between our check and write
        if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'EEXIST') {
            console.error('⚠️  [LOCK] Lock acquired by another process (race condition) — aborting');
            return false;
        }
        console.error(`❌ [LOCK] Failed to create lock file: ${error instanceof Error ? error.message : 'unknown'}`);
        return false;
    }

    lockFilePath = filePath;
    lockStartTime = new Date(lockContent.startTime);

    registerCleanupHandlers();

    console.log(`🔒 [LOCK] Lock acquired (PID: ${process.pid}, time: ${lockContent.startTime})`);
    return true;
}

/**
 * Release the directory lock. Logs duration held.
 * Only deletes if this process owns the lock (PID check).
 */
export function releaseDirectoryLock(): void {
    if (!lockFilePath) return;

    const filePath = lockFilePath;

    if (existsSync(filePath)) {
        try {
            const content = readFileSync(filePath, 'utf-8');
            const lockInfo = JSON.parse(content) as DirectoryLockContent;

            if (lockInfo.pid !== process.pid) {
                // Not our lock — don't delete
                lockFilePath = null;
                lockStartTime = null;
                return;
            }

            unlinkSync(filePath);
        } catch {
            // Best effort cleanup
            try { unlinkSync(filePath); } catch { /* ignore */ }
        }
    }

    if (lockStartTime) {
        const duration = formatDuration(Date.now() - lockStartTime.getTime());
        console.log(`🔓 [LOCK] Lock released (held for ${duration})`);
    }

    lockFilePath = null;
    lockStartTime = null;
}
