/**
 * Template Sync Tool - Main orchestration class
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { SyncContext, SyncOptions, SyncMode, AutoMode, ConflictResolutionMap, TEMPLATE_DIR } from './types';
import { loadConfig, saveConfig, mergeTemplateIgnoredFiles } from './utils/config';
import { log, logError } from './utils/logging';
import { exec } from './utils';
import { confirm, isInteractive } from '../cli-utils';

// Git operations
import { cloneTemplate, cleanupTemplate, checkGitStatus } from './git';

// File operations
import { compareFiles, storeFileHash, getFileHash } from './files';

// Analysis
import { analyzeChanges } from './analysis';

// UI
import { promptUser, handleConflictResolution, printConflictResolutionSummary, displayTotalDiffSummary } from './ui';

// Sync operations
import { syncFiles } from './sync';

// Reporting
import { printResults, generateSyncReport, getTemplateCommitsSinceLastSync, formatSyncCommitMessage, addSyncHistoryEntry } from './reporting';

// Modes
import { runInitHashes, runProjectDiffs, runShowDrift, runChangelog, runDiffSummary, runValidation, initializeIdenticalFileHashes, runJsonMode } from './modes';

/**
 * Main Template Sync Tool class
 */
export class TemplateSyncTool {
  private context: SyncContext;
  private rl: readline.Interface;

  constructor(options: SyncOptions) {
    const projectRoot = process.cwd();
    const config = loadConfig(projectRoot);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.context = {
      config,
      options,
      projectRoot,
      rl: this.rl,
      totalDiffSummary: null,
    };
  }

  async run(): Promise<void> {
    // Handle JSON mode - run silently and output structured result
    if (this.context.options.json) {
      await runJsonMode(this.context);
      this.rl.close();
      return;
    }

    log(this.context.options, '🔄 Template Sync Tool');
    log(this.context.options, '='.repeat(60));

    // Handle changelog mode (just show commits, no sync)
    if (this.context.options.changelog) {
      await runChangelog(this.context);
      this.rl.close();
      return;
    }

    // Handle show-drift mode (show total drift with file list, no sync)
    if (this.context.options.showDrift) {
      await runShowDrift(this.context);
      this.rl.close();
      return;
    }

    // Handle init-hashes mode (initialize baseline hashes, no sync)
    if (this.context.options.initHashes) {
      await runInitHashes(this.context);
      this.rl.close();
      return;
    }

    // Handle project-diffs mode (for contribute-to-template command)
    if (this.context.options.projectDiffs) {
      await runProjectDiffs(this.context);
      this.rl.close();
      return;
    }

    // Handle diff-summary mode
    if (this.context.options.diffSummary) {
      await runDiffSummary(this.context);
      this.rl.close();
      return;
    }

    if (this.context.options.dryRun) {
      log(this.context.options, '🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Step 1: Check git status
    if (!this.context.options.dryRun && !this.context.options.force) {
      checkGitStatus(this.context);
    }

    // Step 2: Clone template
    try {
      cloneTemplate(this.context);

      // Step 2.5: Merge template's ignored files into config
      // This allows the template to specify files that should never be synced
      mergeTemplateIgnoredFiles(this.context.projectRoot, this.context.config, TEMPLATE_DIR);

      // Step 3: Get template commit
      const templatePath = path.join(this.context.projectRoot, TEMPLATE_DIR);
      const templateCommit = exec('git rev-parse HEAD', this.context.projectRoot, {
        cwd: templatePath,
        silent: true,
      });

      console.log(`📍 Template commit: ${templateCommit}`);

      // Show total diff summary (complete picture of drift from template)
      displayTotalDiffSummary(this.context);

      // Show template commits since last sync (if any)
      const templateCommits = getTemplateCommitsSinceLastSync(this.context);
      if (templateCommits.length > 0) {
        console.log(`\n📜 Template commits since last sync (${templateCommits.length}):\n`);
        templateCommits.slice(0, 10).forEach((c) => {
          // Only show the first line (headline with date)
          const headline = c.split('\n')[0];
          console.log(`   ${headline}`);
        });
        if (templateCommits.length > 10) {
          console.log(`\n   ... and ${templateCommits.length - 10} more`);
        }
        console.log('');
      } else if (this.context.config.lastSyncCommit) {
        console.log('\n📜 No new template commits since last sync.');
        console.log('   Checking for existing differences from previous sessions...\n');
      }

      // Step 4: Initialize hashes for identical files (establishes baseline)
      if (!this.context.options.dryRun) {
        const initializedCount = initializeIdenticalFileHashes(this.context);
        if (initializedCount > 0) {
          log(this.context.options, `Initialized baseline hashes for ${initializedCount} identical files`);
        }
      }

      // Step 5: Compare files
      console.log('🔍 Analyzing changes...');
      const changes = compareFiles(this.context);

      if (changes.length === 0) {
        console.log('✅ No changes detected. Your project is up to date!');
        this.rl.close();
        return;
      }

      // Step 6: Analyze changes (categorize into safe/conflict)
      const analysis = analyzeChanges(this.context, changes);

      // Check if all changes are skipped or project-only (nothing to sync from template)
      const hasChangesToSync = analysis.safeChanges.length > 0 || analysis.conflictChanges.length > 0;

      if (!hasChangesToSync) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ANALYSIS SUMMARY');
        console.log('='.repeat(60));

        if (analysis.projectOnlyChanges.length > 0) {
          console.log(`\n✅ Project customizations (${analysis.projectOnlyChanges.length} files):`);
          console.log('   Changed only in your project (template unchanged):');
          analysis.projectOnlyChanges.forEach(f => console.log(`   • ${f.path}`));
        }

        if (analysis.skipped.length > 0) {
          console.log(`\n⏭️  Skipped files (${analysis.skipped.length} files):`);
          console.log('   These files are in your ignored/project-specific list.');
          analysis.skipped.forEach(f => console.log(`   • ${f}`));
        }

        console.log('\n' + '='.repeat(60));
        console.log('\n✅ Nothing to sync. The template has no new changes for your project.');
        if (analysis.projectOnlyChanges.length > 0) {
          console.log('   Your project customizations will be kept as-is.');
        }
        this.rl.close();
        return;
      }

      // Step 7: Prompt user for choice (unless auto mode or dry-run)
      let mode: SyncMode;
      let conflictResolutions: ConflictResolutionMap = {};

      if (this.context.options.dryRun) {
        // In dry-run, show analysis but don't apply
        mode = 'all'; // Show everything
        const result = await syncFiles(this.context, analysis, mode);
        printResults(this.context, result);
        console.log('\n🔍 DRY RUN - No changes were actually applied.');
        this.rl.close();
        return;
      } else if (this.context.options.autoMode !== 'none') {
        // Auto mode: apply based on the specific auto flag
        const autoModeLabels: Record<AutoMode, string> = {
          'none': '',
          'safe-only': 'AUTO SAFE ONLY - Applying only safe changes, skipping conflicts...',
          'merge-conflicts': 'AUTO MERGE - Applying all changes, conflicts will need manual merge...',
          'override-conflicts': 'AUTO OVERRIDE - Applying all changes, conflicts will be overridden with template...',
          'skip-conflicts': 'AUTO SKIP - Applying safe changes, skipping all conflicts...',
        };
        console.log(`\n🤖 ${autoModeLabels[this.context.options.autoMode]}`);

        switch (this.context.options.autoMode) {
          case 'safe-only':
            mode = 'safe';
            break;
          case 'merge-conflicts':
            mode = 'all';
            for (const conflict of analysis.conflictChanges) {
              conflictResolutions[conflict.path] = 'merge';
            }
            break;
          case 'override-conflicts':
            mode = 'all';
            for (const conflict of analysis.conflictChanges) {
              conflictResolutions[conflict.path] = 'override';
            }
            break;
          case 'skip-conflicts':
            mode = 'all';
            for (const conflict of analysis.conflictChanges) {
              conflictResolutions[conflict.path] = 'skip';
            }
            break;
          default:
            mode = 'safe';
        }
      } else {
        // Interactive mode: ask user
        mode = await promptUser(this.context, analysis, this.rl);

        // If user chose 'all' and there are conflicts, handle them interactively
        if (mode === 'all' && analysis.conflictChanges.length > 0) {
          conflictResolutions = await handleConflictResolution(this.context, analysis.conflictChanges, this.rl);
          printConflictResolutionSummary(conflictResolutions);

          // Confirm before proceeding
          let proceed: boolean;
          if (isInteractive()) {
            proceed = await confirm('Proceed with these actions?', true);
          } else {
            proceed = await new Promise<boolean>((resolve) => {
              this.rl.question('Proceed with these actions? (y/n): ', (answer) => {
                resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
              });
            });
          }

          if (!proceed) {
            console.log('\n✅ No changes applied.');
            this.rl.close();
            return;
          }
        }
      }

      this.rl.close();

      if (mode === 'none') {
        console.log('\n✅ No changes applied.');
        return;
      }

      // Step 8: Apply changes based on mode (mode is 'safe' or 'all' here)
      const result = await syncFiles(this.context, analysis, mode, conflictResolutions);

      // Step 9: Print results
      printResults(this.context, result);

      // Step 10: Run validation before committing (always, not just when --validate is set)
      // Get template commits for the commit message and report (before cleanup)
      const templateCommitsForReport = getTemplateCommitsSinceLastSync(this.context);

      if (!this.context.options.dryRun && result.autoMerged.length > 0) {
        // Run yarn checks before committing
        log(this.context.options, '\n🔍 Running yarn checks before committing...');
        const checksPass = await runValidation(this.context);

        if (!checksPass) {
          logError('\n❌ yarn checks failed! Sync changes were applied but NOT committed.');
          logError('   Please fix the issues above and commit manually.');

          // Still update config to track sync state
          this.context.config.lastSyncCommit = templateCommit;
          this.context.config.lastSyncDate = new Date().toISOString();
          saveConfig(this.context.projectRoot, this.context.config);

          return;
        }

        log(this.context.options, '\n📦 Committing synced files...');

        if (templateCommitsForReport.length > 0 && !this.context.options.quiet) {
          log(this.context.options, `\n📜 Template commits being synced (${templateCommitsForReport.length}):\n`);
          templateCommitsForReport.forEach((c) => {
            // Only show the first line (headline with date)
            const headline = c.split('\n')[0];
            log(this.context.options, `   ${headline}`);
          });
        }

        try {
          // Update config BEFORE committing so it's included in the commit
          this.context.config.lastSyncCommit = templateCommit;
          this.context.config.lastSyncDate = new Date().toISOString();
          saveConfig(this.context.projectRoot, this.context.config);

          // Stage all changes (including .template-sync.json)
          exec('git add -A', this.context.projectRoot, { silent: true });

          // Create commit with template commits in message
          const commitMessage = formatSyncCommitMessage(templateCommit, templateCommitsForReport);
          // Use a temp file for multi-line commit message
          const tempFile = path.join(this.context.projectRoot, '.sync-commit-msg.tmp');
          fs.writeFileSync(tempFile, commitMessage, 'utf-8');
          exec(`git commit -F "${tempFile}"`, this.context.projectRoot, { silent: true });
          fs.unlinkSync(tempFile);

          // Now get the commit that INCLUDES the sync changes
          const projectCommit = exec('git rev-parse HEAD', this.context.projectRoot, { silent: true });

          // Add to sync history and update projectCommit (requires amend)
          addSyncHistoryEntry(this.context, templateCommit, projectCommit, result, templateCommitsForReport);
          this.context.config.lastProjectCommit = projectCommit;
          saveConfig(this.context.projectRoot, this.context.config);

          // Amend commit to include updated config with projectCommit and sync history
          exec('git add .template-sync.json', this.context.projectRoot, { silent: true });
          exec('git commit --amend --no-edit', this.context.projectRoot, { silent: true });

          const finalCommit = exec('git rev-parse --short HEAD', this.context.projectRoot, { silent: true });
          log(this.context.options, `\n   ✅ Committed as ${finalCommit}`);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          log(this.context.options, `   ⚠️  Auto-commit failed: ${message}`);
          log(this.context.options, '   Please commit the changes manually.');

          // Still update config even if commit fails
          this.context.config.lastSyncCommit = templateCommit;
          this.context.config.lastSyncDate = new Date().toISOString();
          saveConfig(this.context.projectRoot, this.context.config);
        }
      } else if (!this.context.options.dryRun) {
        // No changes applied, but still update and commit the sync timestamp
        this.context.config.lastSyncCommit = templateCommit;
        this.context.config.lastSyncDate = new Date().toISOString();
        saveConfig(this.context.projectRoot, this.context.config);

        // Commit the config update
        try {
          exec('git add .template-sync.json', this.context.projectRoot, { silent: true });
          // Check if there are staged changes before committing
          const stagedChanges = exec('git diff --cached --name-only', this.context.projectRoot, { silent: true });
          if (stagedChanges.trim()) {
            exec('git commit -m "chore: update template sync timestamp"', this.context.projectRoot, { silent: true });
          }
        } catch {
          // Ignore commit errors - config is already saved
        }
      }

      // Generate sync report if requested
      if (this.context.options.report && result.autoMerged.length > 0) {
        generateSyncReport(this.context, result, templateCommit, templateCommitsForReport);
      }

      if (result.autoMerged.length > 0) {
        log(this.context.options, '\n✅ Template sync completed!');
        if (result.conflicts.length === 0) {
          log(this.context.options, '   All changes were applied and committed.');
        } else {
          log(this.context.options, '   Safe changes committed. Review .template files for manual merges.');
        }
      }
    } catch (error: unknown) {
      this.rl.close();
      throw error;
    } finally {
      // Cleanup
      cleanupTemplate(this.context);
    }
  }
}
