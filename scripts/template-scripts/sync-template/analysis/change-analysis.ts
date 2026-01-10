/**
 * Change analysis utilities
 */

import * as path from 'path';
import { SyncContext, FileChange, AnalysisResult, TEMPLATE_DIR } from '../types';
import { exec } from '../utils';
import { logVerbose } from '../utils/logging';
import { shouldIgnoreByProjectSpecificFiles } from '../files';
import { getChangeStatus } from '../files/comparison';

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
          result.conflictChanges.push(change);
        }
      } else if (status.templateChanged && status.projectChanged) {
        // Both changed - conflict
        result.newChanges.add(change.path);  // Mark as new since template changed
        result.conflictChanges.push(change);
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
        result.conflictChanges.push(change);
      }
    }
  }

  return result;
}
