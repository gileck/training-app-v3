/**
 * Change analysis utilities
 */

import * as path from 'path';
import { SyncContext, FileChange, AnalysisResult, TEMPLATE_DIR, PackageJsonMergeResult } from '../types';
import { exec } from '../utils';
import { logVerbose } from '../utils/logging';
import { shouldIgnoreByProjectSpecificFiles } from '../files';
import { getChangeStatus } from '../files/comparison';
import {
  mergePackageJsonFiles,
  readPackageJson,
  formatMergeSummary,
  formatConflictMessage,
} from '../utils/package-json-merge';

/**
 * Check if a file existed in the template at the last sync commit.
 * Used to determine if a file is truly NEW in the template.
 */
export function fileExistedInTemplateAtLastSync(context: SyncContext, filePath: string): boolean {
  if (!context.config.lastSyncCommit) {
    return false; // First sync - all files are "new" to us
  }

  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
  try {
    // Check if the file existed at the lastSyncCommit
    exec(
      `git cat-file -e ${context.config.lastSyncCommit}:${filePath}`,
      context.projectRoot,
      { cwd: templatePath, silent: true }
    );
    return true; // File existed at last sync
  } catch {
    return false; // File didn't exist at last sync (it's new)
  }
}

/**
 * Get the content of a file from the template at the last sync commit.
 * Used for 3-way merge of package.json.
 */
export function getTemplateFileContentAtLastSync(context: SyncContext, filePath: string): string | null {
  if (!context.config.lastSyncCommit) {
    return null; // First sync - no baseline
  }

  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
  try {
    const content = exec(
      `git show ${context.config.lastSyncCommit}:${filePath}`,
      context.projectRoot,
      { cwd: templatePath, silent: true }
    );
    return content.trim();
  } catch {
    return null; // File didn't exist at last sync
  }
}

/**
 * Get the baseline package.json for 3-way merge.
 * Returns the package.json content from the template at the last sync commit.
 */
export function getBaselinePackageJson(context: SyncContext): Record<string, unknown> | null {
  const content = getTemplateFileContentAtLastSync(context, 'package.json');
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Try to auto-merge package.json when both template and project changed it.
 * Returns the merge result or null if merge is not possible.
 */
export function tryMergePackageJson(context: SyncContext): PackageJsonMergeResult | null {
  const basePackageJson = getBaselinePackageJson(context);
  const mergeResult = mergePackageJsonFiles(context.projectRoot, basePackageJson);

  if (!mergeResult.success) {
    logVerbose(context.options, 'package.json merge failed - unable to read files');
    return null;
  }

  // Log merge details if verbose
  logVerbose(context.options, 'package.json merge result:');
  logVerbose(context.options, formatMergeSummary(mergeResult));

  if (mergeResult.conflicts.length > 0) {
    logVerbose(context.options, formatConflictMessage(mergeResult.conflicts));
  }

  return mergeResult;
}

/**
 * Analyze file changes and categorize them into safe/conflict/project-only
 */
export function analyzeChanges(context: SyncContext, changes: FileChange[]): AnalysisResult {
  const result: AnalysisResult = {
    safeChanges: [],
    conflictChanges: [],
    projectOnlyChanges: [],
    skipped: [],
    newChanges: new Set<string>(),
  };

  // Track if we need to handle package.json separately
  let packageJsonChange: FileChange | null = null;
  let packageJsonIsConflict = false;

  for (const change of changes) {
    // Skip project-specific files (with glob pattern support)
    if (shouldIgnoreByProjectSpecificFiles(context.config, change.path)) {
      result.skipped.push(change.path);
      continue;
    }

    if (change.status === 'added') {
      // New file in template (not in project) - safe to add
      result.newChanges.add(change.path);
      result.safeChanges.push(change);
    } else if (change.status === 'modified') {
      // File exists in both but differs - use hash-based comparison
      const status = getChangeStatus(context, change.path);

      if (!status.hasBaseline) {
        // No baseline hash - check if this is a NEW file in the template
        const isNewInTemplate = !fileExistedInTemplateAtLastSync(context, change.path);

        if (isNewInTemplate) {
          // File is NEW in template (didn't exist at last sync)
          // Even though project has a different version, treat as safe change
          // Template's new file takes precedence
          logVerbose(context.options, `${change.path} is NEW in template (no baseline) - treating as safe change`);
          result.newChanges.add(change.path);
          result.safeChanges.push(change);
        } else {
          // File existed in template at last sync but has no baseline hash
          // This means it was synced before the hash system was introduced
          // Files differ but we don't know who changed what - treat as conflict
          logVerbose(context.options, `No baseline hash for ${change.path} (existed at last sync) - treating as conflict`);

          // Special handling for package.json - try to auto-merge
          if (change.path === 'package.json') {
            packageJsonChange = change;
            packageJsonIsConflict = true;
          } else {
            result.conflictChanges.push(change);
          }
        }
      } else if (status.templateChanged && status.projectChanged) {
        // Both changed - conflict
        result.newChanges.add(change.path);  // Mark as new since template changed

        // Special handling for package.json - try to auto-merge
        if (change.path === 'package.json') {
          packageJsonChange = change;
          packageJsonIsConflict = true;
        } else {
          result.conflictChanges.push(change);
        }
      } else if (status.templateChanged && !status.projectChanged) {
        // Only template changed - safe to apply
        result.newChanges.add(change.path);
        result.safeChanges.push(change);
      } else if (!status.templateChanged && status.projectChanged) {
        // Only project changed - project customization, keep as-is
        result.projectOnlyChanges.push(change);
      } else {
        // Neither changed but files differ - shouldn't happen if hashes are tracked correctly
        // This could happen if files were modified outside of sync
        logVerbose(context.options, `Hash mismatch for ${change.path} - files differ but neither changed from baseline`);

        // Special handling for package.json
        if (change.path === 'package.json') {
          packageJsonChange = change;
          packageJsonIsConflict = true;
        } else {
          result.conflictChanges.push(change);
        }
      }
    }
  }

  // Handle package.json auto-merge if it was detected as a conflict
  if (packageJsonChange && packageJsonIsConflict) {
    logVerbose(context.options, 'Attempting to auto-merge package.json...');
    const mergeResult = tryMergePackageJson(context);

    if (mergeResult && mergeResult.success) {
      // Store the merge result for later use in sync operations
      result.packageJsonMerge = mergeResult;

      // Add to newChanges since template changed
      result.newChanges.add('package.json');

      // Treat as a safe change since we have a merged version ready
      // The actual merge will be applied in sync/operations.ts
      result.safeChanges.push(packageJsonChange);

      logVerbose(context.options, 'package.json will be auto-merged');

      if (mergeResult.conflicts.length > 0) {
        logVerbose(context.options, `package.json has ${mergeResult.conflicts.length} field conflict(s) - project values will be kept`);
      }
    } else {
      // Merge failed - treat as regular conflict
      logVerbose(context.options, 'package.json auto-merge failed - treating as regular conflict');
      result.conflictChanges.push(packageJsonChange);
    }
  }

  return result;
}
