/**
 * Diff generation and AI description utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, DiffSummary, TEMPLATE_DIR } from '../types';
import { exec } from '../utils';
import { describeChanges, isAgentAvailable, analyzeConflict } from '../../ai-agents/claude-code-agent';

// Re-export AI types
export type { ConflictAnalysis } from '../../ai-agents/claude-code-agent';
export { isAgentAvailable };

/**
 * Get a brief diff summary for a file (lines added/removed).
 */
export function getFileDiffSummary(context: SyncContext, filePath: string): DiffSummary {
  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
  const templateFilePath = path.join(templatePath, filePath);
  const projectFilePath = path.join(context.projectRoot, filePath);

  try {
    const diff = exec(
      `diff -u "${projectFilePath}" "${templateFilePath}" || true`,
      context.projectRoot,
      { silent: true }
    );

    if (!diff.trim()) {
      return { added: 0, removed: 0, preview: [], diff: '' };
    }

    const lines = diff.split('\n');
    let added = 0;
    let removed = 0;
    const preview: string[] = [];

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added++;
        if (preview.length < 5) preview.push(line);
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed++;
        if (preview.length < 5) preview.push(line);
      }
    }

    return { added, removed, preview, diff };
  } catch {
    return { added: 0, removed: 0, preview: [], diff: '' };
  }
}

/**
 * Format diff stats as colored string like "+15/-8" for display.
 */
export function formatDiffStats(context: SyncContext, filePath: string): string {
  const { added, removed } = getFileDiffSummary(context, filePath);

  if (added === 0 && removed === 0) {
    return '';
  }

  const parts: string[] = [];
  if (added > 0) {
    parts.push(`\x1b[32m+${added}\x1b[0m`);
  }
  if (removed > 0) {
    parts.push(`\x1b[31m-${removed}\x1b[0m`);
  }

  return ` (${parts.join('/')})`;
}

/**
 * Get the local diff for a file (changes since last sync)
 */
export function getLocalDiff(context: SyncContext, filePath: string): string {
  if (!context.config.lastSyncCommit) return '';

  try {
    return exec(
      `git diff ${context.config.lastSyncCommit} HEAD -- "${filePath}" || true`,
      context.projectRoot,
      { silent: true }
    );
  } catch {
    return '';
  }
}

/**
 * Get the template diff for a file (changes in template since last sync)
 */
export function getTemplateDiff(context: SyncContext, filePath: string): string {
  if (!context.config.lastSyncCommit) return '';

  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);

  try {
    return exec(
      `git diff ${context.config.lastSyncCommit} HEAD -- "${filePath}" || true`,
      context.projectRoot,
      { cwd: templatePath, silent: true }
    );
  } catch {
    return '';
  }
}

/**
 * Generate a unified diff for a file
 */
export function generateFileDiff(context: SyncContext, filePath: string): string {
  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
  const templateFilePath = path.join(templatePath, filePath);
  const projectFilePath = path.join(context.projectRoot, filePath);

  const templateExists = fs.existsSync(templateFilePath);
  const projectExists = fs.existsSync(projectFilePath);

  if (!templateExists) {
    return '';
  }

  if (!projectExists) {
    // New file in template - show full content
    // Handle symlinks to directories specially
    const stat = fs.lstatSync(templateFilePath);
    if (stat.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(templateFilePath);
      try {
        const targetStat = fs.statSync(templateFilePath);
        if (targetStat.isDirectory()) {
          return `+++ NEW SYMLINK (to directory) +++\n-> ${linkTarget}`;
        }
      } catch {
        // Broken symlink
        return `+++ NEW SYMLINK (broken) +++\n-> ${linkTarget}`;
      }
    }
    if (stat.isDirectory()) {
      return ''; // Skip regular directories
    }
    const content = fs.readFileSync(templateFilePath, 'utf-8');
    return `+++ NEW FILE +++\n${content}`;
  }

  // Both exist - generate unified diff
  try {
    const diff = exec(
      `diff -u "${projectFilePath}" "${templateFilePath}" || true`,
      context.projectRoot,
      { silent: true }
    );

    if (diff) {
      // Replace file paths in diff header for clarity
      return diff
        .replace(projectFilePath, `a/${filePath} (current)`)
        .replace(templateFilePath, `b/${filePath} (template)`);
    }
    return '(no differences)';
  } catch {
    return '(unable to generate diff)';
  }
}

/**
 * Get AI-generated description of changes (returns null if unavailable)
 */
export async function getAIDescription(diff: string, aiContext: string): Promise<string | null> {
  if (!diff.trim()) return null;

  try {
    return await describeChanges(diff, aiContext);
  } catch {
    return null;
  }
}

/**
 * Analyze a conflict using AI and return structured analysis
 */
export async function getConflictAnalysis(
  context: SyncContext,
  filePath: string
): Promise<ReturnType<typeof analyzeConflict>> {
  const templateDiff = getTemplateDiff(context, filePath);
  const projectDiff = getLocalDiff(context, filePath);

  // If we don't have diffs, fall back to file comparison
  const fallbackDiff = templateDiff || projectDiff ? null : getFileDiffSummary(context, filePath).diff;

  return analyzeConflict(
    filePath,
    templateDiff || fallbackDiff || '',
    projectDiff || ''
  );
}
