/**
 * Merge package.json mode - only merge package.json from template
 */

import * as path from 'path';
import { SyncContext, TEMPLATE_DIR } from '../types';
import { log } from '../utils/logging';
import { exec } from '../utils';
import { cloneTemplate, cleanupTemplate } from '../git';
import {
  mergePackageJsonFiles,
  writePackageJson,
  formatMergeSummary,
  formatConflictMessage,
  resolveFieldConflictsInteractively,
} from '../utils/package-json-merge';
import { getBaselinePackageJson } from '../analysis';

/**
 * Run merge-package-json mode - only merge package.json from template
 */
export async function runMergePackageJson(context: SyncContext): Promise<void> {
  log(context.options, '📦 Merge package.json from template');
  log(context.options, '='.repeat(60));

  // Clone template to get current template package.json
  cloneTemplate(context);

  try {
    const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
    const templateCommit = exec('git rev-parse HEAD', context.projectRoot, {
      cwd: templatePath,
      silent: true,
    });

    log(context.options, `\n📍 Template commit: ${templateCommit}`);

    if (context.config.lastSyncCommit) {
      log(context.options, `📍 Last synced:     ${context.config.lastSyncCommit}`);
    }

    // Get the baseline package.json for 3-way merge
    const basePackageJson = getBaselinePackageJson(context);

    // Perform the merge
    let mergeResult = mergePackageJsonFiles(context.projectRoot, basePackageJson);

    if (!mergeResult.success) {
      log(context.options, '\n❌ Failed to merge package.json - unable to read files');
      return;
    }

    // Check if there are any changes to apply
    const hasChanges = mergeResult.autoMergedFields.length > 0 ||
                       mergeResult.templateOnlyFields.length > 0 ||
                       mergeResult.conflicts.length > 0;

    // Show diff between project and template package.json
    const projectPackageJsonPath = path.join(context.projectRoot, 'package.json');
    const templatePackageJsonPath = path.join(context.projectRoot, TEMPLATE_DIR, 'package.json');
    
    try {
      const diff = exec(
        `git diff --no-index --color=always "${projectPackageJsonPath}" "${templatePackageJsonPath}"`,
        context.projectRoot,
        { silent: true }
      );
      if (diff.trim()) {
        log(context.options, '\n📋 DIFF (project vs template):');
        log(context.options, '─'.repeat(60));
        log(context.options, diff);
        log(context.options, '─'.repeat(60));
      } else {
        log(context.options, '\n📋 Files are identical.');
      }
    } catch {
      // git diff --no-index returns exit code 1 when files differ, which throws
      // Try to get the diff output anyway
      try {
        const diff = exec(
          `git diff --no-index --color=always "${projectPackageJsonPath}" "${templatePackageJsonPath}" || true`,
          context.projectRoot,
          { silent: true }
        );
        if (diff.trim()) {
          log(context.options, '\n📋 DIFF (project vs template):');
          log(context.options, '─'.repeat(60));
          log(context.options, diff);
          log(context.options, '─'.repeat(60));
        }
      } catch {
        // Ignore diff errors
      }
    }

    if (!hasChanges) {
      const hasProjectChanges = mergeResult.projectKeptFields.length > 0 || mergeResult.projectOnlyFields.length > 0;
      if (hasProjectChanges) {
        log(context.options, '\n✅ No changes to merge from template. Your project-specific changes are preserved.');
      } else {
        log(context.options, '\n✅ Your package.json is in sync with the template.');
      }
      return;
    }

    // Show merge summary
    log(context.options, '\n📊 MERGE ANALYSIS');
    log(context.options, '─'.repeat(60));
    log(context.options, formatMergeSummary(mergeResult));

    // Handle field conflicts interactively if any
    if (mergeResult.conflicts.length > 0) {
      log(context.options, formatConflictMessage(mergeResult.conflicts));
      mergeResult = await resolveFieldConflictsInteractively(mergeResult);
    }

    // Dry run - show what would be done without applying
    if (context.options.dryRun) {
      log(context.options, '\n🔍 DRY RUN - Changes that would be applied:');
      log(context.options, '─'.repeat(60));
      log(context.options, JSON.stringify(mergeResult.merged, null, 2));
      log(context.options, '\n🔍 DRY RUN - No changes were actually applied.');
      return;
    }

    // Apply the merged package.json
    if (mergeResult.merged) {
      const packageJsonPath = path.join(context.projectRoot, 'package.json');
      writePackageJson(packageJsonPath, mergeResult.merged);
      log(context.options, '\n✅ package.json has been updated!');

      // Show what changed
      if (mergeResult.autoMergedFields.length > 0) {
        log(context.options, `   ✅ Auto-merged from template: ${mergeResult.autoMergedFields.join(', ')}`);
      }
      if (mergeResult.templateOnlyFields.length > 0) {
        log(context.options, `   ➕ Added from template: ${mergeResult.templateOnlyFields.join(', ')}`);
      }
      if (mergeResult.projectKeptFields.length > 0) {
        log(context.options, `   📌 Kept project values: ${mergeResult.projectKeptFields.join(', ')}`);
      }

      // Remind to run yarn install if dependencies changed
      const depsChanged = mergeResult.autoMergedFields.some(f => 
        f.includes('dependencies') || f.includes('devDependencies') || f.includes('peerDependencies')
      ) || mergeResult.templateOnlyFields.some(f => 
        f.includes('dependencies') || f.includes('devDependencies') || f.includes('peerDependencies')
      );

      if (depsChanged) {
        log(context.options, '\n⚠️  Dependencies were updated. Run `yarn install` to update node_modules.');
      }
    }

    log(context.options, '\n' + '='.repeat(60));
  } finally {
    cleanupTemplate(context);
  }
}
