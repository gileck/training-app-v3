/**
 * JSON Mode - Run sync silently and output structured JSON result
 *
 * Used by sync-child-projects for reliable, programmatic sync status detection.
 * Always uses auto-safe-only mode and runs validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, SyncJsonResult, TEMPLATE_DIR } from '../types';
import { saveConfig, mergeTemplateIgnoredFiles } from '../utils/config';
import { exec } from '../utils';
import { cloneTemplate, cleanupTemplate, checkGitStatus } from '../git';
import { compareFiles } from '../files';
import { analyzeChanges } from '../analysis';
import { syncFiles } from '../sync';
import { getTemplateCommitsSinceLastSync, formatSyncCommitMessage, addSyncHistoryEntry } from '../reporting';
import { initializeIdenticalFileHashes } from './init-hashes';
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
    projectOnlyChanges: [],
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

    // Merge template's ignored files
    mergeTemplateIgnoredFiles(context.projectRoot, context.config, TEMPLATE_DIR);

    // Get template commit
    const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
    const templateCommit = exec('git rev-parse HEAD', context.projectRoot, {
      cwd: templatePath,
      silent: true,
    });
    jsonResult.templateCommit = templateCommit;

    // Initialize hashes for identical files
    initializeIdenticalFileHashes(context);

    // Compare files
    const changes = compareFiles(context);

    if (changes.length === 0) {
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

    // Analyze changes
    const analysis = analyzeChanges(context, changes);

    // Populate result with analysis
    jsonResult.filesSkipped = analysis.skipped;
    jsonResult.projectOnlyChanges = analysis.projectOnlyChanges.map(c => c.path);
    jsonResult.filesConflicted = analysis.conflictChanges.map(c => c.path);

    // Check if anything to sync
    const hasChangesToSync = analysis.safeChanges.length > 0 || analysis.conflictChanges.length > 0;

    if (!hasChangesToSync) {
      jsonResult.status = 'no-changes';
      jsonResult.message = 'Nothing to sync from template. Project customizations preserved.';

      // Still run validation
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

    // Apply safe changes only (auto-safe-only mode)
    const result = await syncFiles(context, analysis, 'safe');

    jsonResult.filesApplied = result.autoMerged;
    jsonResult.errors = result.errors;

    // Run validation
    const validationResult = await runValidationWithDetails(context);
    jsonResult.checksResult = {
      passed: validationResult.passed,
      tsErrors: validationResult.tsErrors,
      lintErrors: validationResult.lintErrors,
    };

    if (!validationResult.passed) {
      jsonResult.status = 'checks-failed';
      jsonResult.message = 'Sync applied but validation failed. Changes NOT committed.';

      // Still update config
      context.config.lastSyncCommit = templateCommit;
      context.config.lastSyncDate = new Date().toISOString();
      saveConfig(context.projectRoot, context.config);

      cleanupTemplate(context);
      outputJson(jsonResult);
      return;
    }

    // Commit changes if any were applied
    if (result.autoMerged.length > 0) {
      const templateCommitsForReport = getTemplateCommitsSinceLastSync(context);

      // Update config
      context.config.lastSyncCommit = templateCommit;
      context.config.lastSyncDate = new Date().toISOString();
      saveConfig(context.projectRoot, context.config);

      // Stage and commit
      exec('git add -A', context.projectRoot, { silent: true });
      const commitMessage = formatSyncCommitMessage(templateCommit, templateCommitsForReport);
      const tempFile = path.join(context.projectRoot, '.sync-commit-msg.tmp');
      fs.writeFileSync(tempFile, commitMessage, 'utf-8');
      exec(`git commit -F "${tempFile}"`, context.projectRoot, { silent: true });
      fs.unlinkSync(tempFile);

      // Get project commit
      const projectCommit = exec('git rev-parse HEAD', context.projectRoot, { silent: true });
      jsonResult.projectCommit = projectCommit;

      // Add to sync history
      addSyncHistoryEntry(context, templateCommit, projectCommit, result, templateCommitsForReport);
      context.config.lastProjectCommit = projectCommit;
      saveConfig(context.projectRoot, context.config);

      // Amend to include updated config
      exec('git add .template-sync.json', context.projectRoot, { silent: true });
      exec('git commit --amend --no-edit', context.projectRoot, { silent: true });

      jsonResult.projectCommit = exec('git rev-parse HEAD', context.projectRoot, { silent: true });
      jsonResult.status = 'success';
      jsonResult.message = `Synced ${result.autoMerged.length} file(s) successfully.`;
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
