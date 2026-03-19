/**
 * JSON Mode - Run sync silently and output structured JSON result
 *
 * Used by sync-child-projects for reliable, programmatic sync status detection.
 * Always uses auto-safe-only mode and runs validation.
 *
 * Uses the folder-ownership model (analyzeFolderSync + syncFolderOwnership)
 * instead of the legacy hash-based path (compareFiles + analyzeChanges + syncFiles).
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, SyncJsonResult, TEMPLATE_DIR, DivergedResolution, ConflictResolution } from '../types';
import { loadConfig, saveConfig, mergeTemplateIgnoredFiles, syncTemplateConfig } from '../utils/config';
import { exec } from '../utils';
import { cloneTemplate, cleanupTemplate, checkGitStatus } from '../git';
import { analyzeFolderSync } from '../analysis';
import { syncFolderOwnership } from '../sync';
import { getTemplateCommitsSinceLastSync, formatSyncCommitMessage, addSyncHistoryEntry } from '../reporting';
import { runValidationWithDetails } from './validation';

/**
 * Run sync in JSON mode - outputs structured result for programmatic use.
 *
 * Forces auto-safe-only mode and suppresses all console output.
 * Always runs validation and includes results in output.
 */
export async function runJsonMode(context: SyncContext): Promise<void> {
  const jsonResult: SyncJsonResult = {
    status: 'success',
    message: '',
    filesApplied: [],
    filesSkipped: [],
    filesConflicted: [],
    projectOnlyChanges: [], // Not applicable in folder-ownership model
    errors: [],
  };

  try {
    // Force auto-safe-only for JSON mode
    context.options.autoMode = 'safe-only';

    // Step 1: Check git status
    if (!context.options.force) {
      try {
        checkGitStatus(context);
      } catch (error: unknown) {
        jsonResult.status = 'error';
        jsonResult.message = error instanceof Error ? error.message : 'Git status check failed';
        jsonResult.errors.push(jsonResult.message);
        outputJson(jsonResult);
        return;
      }
    }

    // Step 2: Clone template
    try {
      cloneTemplate(context);
    } catch (error: unknown) {
      jsonResult.status = 'error';
      jsonResult.message = error instanceof Error ? error.message : 'Failed to clone template';
      jsonResult.errors.push(jsonResult.message);
      outputJson(jsonResult);
      return;
    }

    // Step 3: Sync template config (ensures project has latest templatePaths)
    syncTemplateConfig(context.projectRoot, TEMPLATE_DIR, context.options.dryRun, true);
    context.config = loadConfig(context.projectRoot);

    // Step 4: Merge template's ignored files
    mergeTemplateIgnoredFiles(context.projectRoot, context.config, TEMPLATE_DIR);

    // Get template commit
    const templateDir = path.join(context.projectRoot, TEMPLATE_DIR);
    const templateCommit = exec('git rev-parse HEAD', context.projectRoot, {
      cwd: templateDir,
      silent: true,
    });
    jsonResult.templateCommit = templateCommit;

    // Step 5: Analyze with folder-ownership model
    const analysis = analyzeFolderSync(context.config, context.projectRoot, templateDir);

    // Check for changes
    const hasChanges = analysis.toCopy.length > 0 || analysis.toDelete.length > 0
      || analysis.toMerge.length > 0 || analysis.diverged.length > 0
      || analysis.conflicts.length > 0;

    if (!hasChanges) {
      jsonResult.status = 'no-changes';
      jsonResult.message = 'No changes detected. Project is up to date.';

      // Still run validation to verify project health
      const validationResult = await runValidationWithDetails(context);
      jsonResult.checksResult = {
        passed: validationResult.passed,
        tsErrors: validationResult.tsErrors,
        lintErrors: validationResult.lintErrors,
      };

      cleanupTemplate(context);
      outputJson(jsonResult);
      return;
    }

    // Step 6: Auto-resolve diverged files — template wins for all
    const divergedResolutions = new Map<string, DivergedResolution>();
    for (const file of analysis.diverged) {
      divergedResolutions.set(file.path, 'override');
    }

    // Step 7: Auto-resolve conflicts — skip (respect project overrides)
    const conflictResolutions = new Map<string, ConflictResolution>();
    for (const file of analysis.conflicts) {
      conflictResolutions.set(file.path, 'skip');
    }

    // Step 8: Apply changes using folder-ownership sync
    const result = await syncFolderOwnership(
      analysis, context.config, context.projectRoot, templateDir,
      { dryRun: context.options.dryRun, quiet: true, conflictResolutions, divergedResolutions }
    );

    // Map result to JSON output
    jsonResult.filesApplied = [...result.copied, ...result.merged];
    jsonResult.filesSkipped = result.skipped;
    jsonResult.filesConflicted = result.conflicts;
    jsonResult.filesDeleted = result.deleted;
    jsonResult.filesDiverged = analysis.diverged.map(f => f.path);
    jsonResult.errors = result.errors;

    // Step 9: Run validation
    const validationResult = await runValidationWithDetails(context);
    jsonResult.checksResult = {
      passed: validationResult.passed,
      tsErrors: validationResult.tsErrors,
      lintErrors: validationResult.lintErrors,
    };

    if (!validationResult.passed) {
      jsonResult.status = 'checks-failed';
      jsonResult.message = 'Sync applied but validation failed. Changes NOT committed.';

      // Revert all file changes so working tree is clean
      // Do NOT update lastSyncCommit — next sync will re-attempt
      exec('git checkout -- .', context.projectRoot, { silent: true });

      cleanupTemplate(context);
      outputJson(jsonResult);
      return;
    }

    // Step 10: Commit changes if any were applied
    const totalApplied = result.copied.length + result.merged.length + result.deleted.length;
    if (totalApplied > 0) {
      const templateCommitsForReport = getTemplateCommitsSinceLastSync(context);

      // Clean up stale overrideHashes entries (only keep entries matching projectOverrides)
      if (context.config.overrideHashes) {
        const overrideSet = new Set(context.config.projectOverrides || []);
        for (const key of Object.keys(context.config.overrideHashes)) {
          if (!overrideSet.has(key)) {
            delete context.config.overrideHashes[key];
          }
        }
      }

      // Update config
      context.config.lastSyncCommit = templateCommit;
      context.config.lastSyncDate = new Date().toISOString();
      saveConfig(context.projectRoot, context.config);

      // Stage and commit
      exec('git add -A', context.projectRoot, { silent: true });
      const commitMessage = formatSyncCommitMessage(templateCommit, templateCommitsForReport);
      const tempFile = path.join(context.projectRoot, '.sync-commit-msg.tmp');
      fs.writeFileSync(tempFile, commitMessage, 'utf-8');
      exec(`git commit --no-verify -F "${tempFile}"`, context.projectRoot, { silent: true });
      fs.unlinkSync(tempFile);

      // Get project commit
      const projectCommit = exec('git rev-parse HEAD', context.projectRoot, { silent: true });
      jsonResult.projectCommit = projectCommit;

      // Add to sync history (adapt FolderSyncResult to SyncResult shape)
      const syncResultForHistory = {
        autoMerged: [...result.copied, ...result.merged, ...result.deleted],
        conflicts: result.conflicts,
        projectOnlyChanges: [],
        skipped: result.skipped,
        errors: result.errors,
      };
      addSyncHistoryEntry(context, templateCommit, projectCommit, syncResultForHistory, templateCommitsForReport);
      saveConfig(context.projectRoot, context.config);

      // Amend to include updated config
      exec('git add .template-sync.json .template-sync.template.json', context.projectRoot, { silent: true });
      exec('git commit --amend --no-edit --no-verify', context.projectRoot, { silent: true });

      jsonResult.projectCommit = exec('git rev-parse HEAD', context.projectRoot, { silent: true });
      jsonResult.status = 'success';
      jsonResult.message = `Synced ${totalApplied} file(s) successfully.`;
    } else {
      jsonResult.status = 'no-changes';
      jsonResult.message = 'No safe changes to apply.';
    }

    cleanupTemplate(context);
    outputJson(jsonResult);

  } catch (error: unknown) {
    jsonResult.status = 'error';
    jsonResult.message = error instanceof Error ? error.message : 'Unknown error occurred';
    jsonResult.errors.push(jsonResult.message);

    cleanupTemplate(context);
    outputJson(jsonResult);
  }
}

/**
 * Output JSON result to stdout
 */
function outputJson(result: SyncJsonResult): void {
  console.log(JSON.stringify(result, null, 2));
}
