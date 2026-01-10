/**
 * Sync history and commit message utilities
 */

import * as path from 'path';
import { SyncContext, SyncHistoryEntry, SyncResult, MAX_SYNC_HISTORY, TEMPLATE_DIR } from '../types';
import { exec, stripAnsi } from '../utils';
import { logVerbose } from '../utils/logging';

/**
 * Get the list of template commits since the last sync.
 * Returns full commit messages including subject, body, and date.
 */
export function getTemplateCommitsSinceLastSync(context: SyncContext): string[] {
  if (!context.config.lastSyncCommit) {
    return []; // First sync, no previous commits to show
  }

  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);

  try {
    // Get full commit messages between lastSyncCommit and HEAD
    // Format: hash, date, subject, then body - separated by a delimiter
    const log = exec(
      `git log ${context.config.lastSyncCommit}..HEAD --pretty=format:"---COMMIT---%n%h|%ad|%s%n%b" --date=format:"%d/%m/%Y" --no-decorate`,
      context.projectRoot,
      { cwd: templatePath, silent: true }
    );

    if (!log.trim()) {
      return [];
    }

    // Split by delimiter and process each commit
    const commits = log
      .split('---COMMIT---')
      .map(commit => commit.trim())
      .filter(commit => commit.length > 0)
      .map(commit => {
        const lines = commit.split('\n');
        // First line is "hash|date|subject"
        const firstLine = lines[0];
        const [hash, date, ...subjectParts] = firstLine.split('|');
        const subject = subjectParts.join('|'); // In case subject contains |

        // Remaining lines are the body
        const bodyLines = lines.slice(1);
        // Remove trailing empty lines from body
        while (bodyLines.length > 0 && !bodyLines[bodyLines.length - 1].trim()) {
          bodyLines.pop();
        }

        // Format: "hash subject (date)\nbody"
        const header = `${hash} ${subject} \x1b[90m(${date})\x1b[0m`;
        if (bodyLines.length > 0 && bodyLines.some(l => l.trim())) {
          // Indent body lines relative to header
          return header + '\n' + bodyLines.map(l => `  ${l}`).join('\n');
        }
        return header;
      });

    return commits;
  } catch {
    // If lastSyncCommit doesn't exist in template (force push, etc.), return empty
    return [];
  }
}

/**
 * Format template commits for the sync commit message.
 */
export function formatSyncCommitMessage(templateCommit: string, templateCommits: string[]): string {
  const shortCommit = templateCommit.slice(0, 7);

  if (templateCommits.length === 0) {
    return `chore: sync template (${shortCommit})`;
  }

  const header = `chore: sync template (${shortCommit})`;

  // Format commits with proper indentation for multi-line messages
  // Strip ANSI codes as they shouldn't be in commit messages
  const formattedCommits = templateCommits.map(commit => {
    const cleanCommit = stripAnsi(commit);
    const lines = cleanCommit.split('\n');
    if (lines.length === 1) {
      return `- ${cleanCommit}`;
    }
    // First line with bullet, rest indented
    return `- ${lines[0]}\n${lines.slice(1).map(l => `  ${l}`).join('\n')}`;
  });

  const body = '\n\nTemplate commits synced:\n\n' + formattedCommits.join('\n\n');

  return header + body;
}

/**
 * Add an entry to sync history
 */
export function addSyncHistoryEntry(
  context: SyncContext,
  templateCommit: string,
  projectCommit: string,
  result: SyncResult,
  templateCommits: string[]
): void {
  if (!context.config.syncHistory) {
    context.config.syncHistory = [];
  }

  const entry: SyncHistoryEntry = {
    date: new Date().toISOString(),
    templateCommit,
    projectCommit,
    filesApplied: result.autoMerged.length,
    filesSkipped: result.skipped.length,
    filesConflicted: result.conflicts.length,
    templateCommits,
  };

  context.config.syncHistory.unshift(entry);

  // Keep only last N entries
  if (context.config.syncHistory.length > MAX_SYNC_HISTORY) {
    context.config.syncHistory = context.config.syncHistory.slice(0, MAX_SYNC_HISTORY);
  }

  logVerbose(context.options, `Added sync history entry: ${templateCommit.slice(0, 7)}`);
}
