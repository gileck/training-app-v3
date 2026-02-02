/**
 * Template Sync Tool - Main orchestration class
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { SyncContext, SyncOptions, SyncMode, AutoMode, ConflictResolutionMap, TEMPLATE_DIR, TEMPLATE_CONFIG_FILE, FolderOwnershipConfig, ConflictResolution, DivergedResolution, InteractiveResolutionContext, InteractiveFileInfo } from './types';
import { loadConfig, saveConfig, saveTemplateConfig, mergeTemplateIgnoredFiles, hasSplitConfig } from './utils/config';
import { log, logError } from './utils/logging';
import { exec } from './utils';
import { confirm, isInteractive } from '../cli-utils';

// Git operations
import { cloneTemplate, cleanupTemplate, checkGitStatus } from './git';

// File operations
import { compareFiles, storeFileHash, getFileHash } from './files';

// Analysis
import { analyzeChanges, analyzeFolderSync, printFolderSyncAnalysis } from './analysis';

// UI
import { promptUser, handleConflictResolution, printConflictResolutionSummary, displayTotalDiffSummary, createResolutionContext, promptBatchMode, promptDivergedResolution, promptConflictResolution, promptBulkDivergedResolution, promptDeletionResolution, promptBulkDeletionResolution, displaySyncResults, displayContributionReminder } from './ui';

// Sync operations
import { syncFiles, syncFolderOwnership } from './sync';

// Reporting
import { printResults, generateSyncReport, getTemplateCommitsSinceLastSync, formatSyncCommitMessage, addSyncHistoryEntry } from './reporting';

// Modes
import { runProjectDiffs, runShowDrift, runChangelog, runDiffSummary, runValidation, runJsonMode, runMergePackageJson } from './modes';

/**
 * Main Template Sync Tool class
 */
export class TemplateSyncTool {
  private context: SyncContext;
  private rl: readline.Interface;
  private folderOwnershipConfig: FolderOwnershipConfig | null = null;
  private projectRoot: string;
  private options: SyncOptions;

  constructor(options: SyncOptions) {
    this.projectRoot = process.cwd();
    this.options = options;
    const config = loadConfig(this.projectRoot);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Store folder ownership config
    this.folderOwnershipConfig = config;

    // Create context
    this.context = {
      config,
      options,
      projectRoot: this.projectRoot,
      rl: this.rl,
      totalDiffSummary: null,
    };
  }

  /**
   * Auto-commit any uncommitted sync changes
   */
  private autoCommitChanges(quiet: boolean): void {
    try {
      exec('git add -A', this.projectRoot, { silent: true });
      const stagedChanges = exec('git diff --cached --name-only', this.projectRoot, { silent: true });
      if (stagedChanges.trim()) {
        exec('git commit -m "chore: sync template updates"', this.projectRoot, { silent: true });
        if (!quiet) {
          console.log('📝 Auto-committed sync changes');
        }
      }
    } catch {
      // Ignore commit errors - changes are still applied
    }
  }

  /**
   * Sync the template config file from the template.
   * This ensures the project has the latest templatePaths and templateIgnoredFiles.
   */
  private syncTemplateConfig(templateDir: string, dryRun: boolean): void {
    const templateConfigSrc = path.join(templateDir, TEMPLATE_CONFIG_FILE);

    // Check if template has a split config
    if (!fs.existsSync(templateConfigSrc)) {
      return;  // Template doesn't use split config yet
    }

    const templateConfigDst = path.join(this.projectRoot, TEMPLATE_CONFIG_FILE);
    const templateConfigContent = fs.readFileSync(templateConfigSrc, 'utf-8');

    // Check if it's different from current
    let isDifferent = true;
    if (fs.existsSync(templateConfigDst)) {
      const currentContent = fs.readFileSync(templateConfigDst, 'utf-8');
      isDifferent = currentContent !== templateConfigContent;
    }

    if (isDifferent) {
      console.log(`\n📋 Syncing template config (${TEMPLATE_CONFIG_FILE})...`);
      if (!dryRun) {
        fs.writeFileSync(templateConfigDst, templateConfigContent);
        console.log('   ✅ Template config updated');
      } else {
        console.log('   🔍 Would update template config (dry-run)');
      }
    }
  }

  /**
   * Run folder ownership sync (new model)
   */
  private async runFolderOwnershipSync(): Promise<void> {
    if (!this.folderOwnershipConfig) {
      throw new Error('Folder ownership config not set');
    }

    const config = this.folderOwnershipConfig;
    const { dryRun, quiet, autoMode, verbose } = this.options;

    console.log('🔄 Template Sync Tool');
    console.log('='.repeat(60));

    // Step 1: Clone/update template
    console.log('\n📦 Preparing template...');
    const templateDir = path.join(this.projectRoot, TEMPLATE_DIR);
    await cloneTemplate(this.context);

    // Step 1.5: Sync template config first
    this.syncTemplateConfig(templateDir, dryRun);

    // Step 1.6: Reload config after syncing template config
    const reloadedConfig = loadConfig(this.projectRoot);
    Object.assign(config, reloadedConfig);

    // Step 1.7: Merge template's ignored files into config (for legacy support)
    mergeTemplateIgnoredFiles(this.projectRoot, config, TEMPLATE_DIR);

    // Step 2: Analyze changes
    console.log('\n🔍 Analyzing changes...');
    const analysis = analyzeFolderSync(config, this.projectRoot, templateDir);

    // Step 3: Print analysis summary
    if (verbose || !quiet) {
      printFolderSyncAnalysis(analysis, verbose);
    }

    // Step 4: Check if there are changes
    const totalChanges = analysis.toCopy.length + analysis.toDelete.length + analysis.toMerge.length + analysis.conflicts.length + analysis.diverged.length;
    if (totalChanges === 0) {
      console.log('\n✅ No changes to sync. Project is up to date with template.');

      // Still update config and commit any pending changes from previous syncs
      if (!dryRun) {
        try {
          const templateCommit = exec('git rev-parse HEAD', templateDir, { silent: true }).trim();
          config.lastSyncCommit = templateCommit;
        } catch {
          // Ignore
        }
        config.lastSyncDate = new Date().toISOString();
        saveConfig(this.projectRoot, config);

        // Auto-commit any pending sync changes
        this.autoCommitChanges(quiet);
      }

      await cleanupTemplate(this.context);
      return;
    }

    // Create resolution context for batch operations
    const resolutionContext = createResolutionContext();

    // Step 5: Handle diverged files (project modified template files not in overrides)
    let divergedResolutions: Map<string, DivergedResolution> = new Map();

    if (analysis.diverged.length > 0) {
      if (this.options.acceptAll || autoMode === 'override-conflicts') {
        // Accept all / Override mode: use template version
        for (const file of analysis.diverged) {
          divergedResolutions.set(file.path, 'override');
        }
        console.log(`\n✅ Auto-overriding ${analysis.diverged.length} diverged file(s) with template version`);
      } else if (autoMode === 'safe-only') {
        // In safe-only mode, skip diverged files (don't overwrite project changes)
        console.log(`\n🔶 ${analysis.diverged.length} diverged file(s) will be skipped (safe-only mode)`);
        console.log(`   To resolve: add files to projectOverrides or run interactive sync`);
      } else if (autoMode === 'skip-conflicts') {
        // Skip mode: keep project version but add to overrides
        for (const file of analysis.diverged) {
          divergedResolutions.set(file.path, 'keep');
        }
        console.log(`\n⏭️  Keeping ${analysis.diverged.length} diverged file(s) and adding to projectOverrides`);
      } else if (!quiet && isInteractive()) {
        // Enhanced interactive resolution with batch support
        console.log(`\n🔶 Found ${analysis.diverged.length} diverged file(s) - project modified but not in overrides:`);
        analysis.diverged.forEach((f) => console.log(`   • ${f.path}`));

        // Ask for batch vs individual mode
        const mode = await promptBatchMode(analysis.diverged.length, 'diverged', this.rl);

        if (mode === 'bulk') {
          // Bulk resolution
          const bulkResolution = await promptBulkDivergedResolution(this.rl);
          for (const file of analysis.diverged) {
            divergedResolutions.set(file.path, bulkResolution);
            if (bulkResolution === 'contribute') {
              resolutionContext.pendingContributions.push(file.path);
            }
          }
        } else {
          // Individual resolution with "apply to all" support
          for (let i = 0; i < analysis.diverged.length; i++) {
            const file = analysis.diverged[i];
            const fileInfo: InteractiveFileInfo = { path: file.path };

            const result = await promptDivergedResolution(
              fileInfo,
              i,
              analysis.diverged.length,
              resolutionContext,
              this.rl
            );

            divergedResolutions.set(file.path, result.resolution);
            if (result.resolution === 'contribute') {
              resolutionContext.pendingContributions.push(file.path);
            }

            // If user selected "apply to all", store it in context
            if (result.applyToAll) {
              resolutionContext.divergedApplyAll = result.resolution;
            }
          }
        }
      }
    }

    // Step 6: Handle conflicts (project overrides where template also changed)
    let conflictResolutions: Map<string, ConflictResolution> = new Map();

    if (analysis.conflicts.length > 0) {
      if (this.options.acceptAll || autoMode === 'override-conflicts') {
        for (const conflict of analysis.conflicts) {
          conflictResolutions.set(conflict.path, 'override');
        }
        console.log(`\n✅ Auto-overriding ${analysis.conflicts.length} conflict(s) with template version`);
      } else if (autoMode === 'skip-conflicts') {
        for (const conflict of analysis.conflicts) {
          conflictResolutions.set(conflict.path, 'skip');
        }
        console.log(`\n⏭️  Auto-skipping ${analysis.conflicts.length} conflict(s)`);
      } else if (autoMode === 'safe-only') {
        // Skip conflicts entirely
        console.log(`\n⚠️  ${analysis.conflicts.length} conflict(s) will be skipped (safe-only mode)`);
      } else if (!quiet && isInteractive()) {
        // Enhanced interactive conflict resolution with batch support
        console.log(`\n⚠️  Found ${analysis.conflicts.length} conflict(s) - override files with template changes:`);
        analysis.conflicts.forEach((f) => console.log(`   • ${f.path} - ${f.reason}`));

        // Ask for batch vs individual mode
        const mode = await promptBatchMode(analysis.conflicts.length, 'conflict', this.rl);

        if (mode === 'bulk') {
          // Bulk resolution - use existing promptBulkConflictResolution
          const { promptBulkConflictResolution } = await import('./ui/prompts');
          const bulkResolution = await promptBulkConflictResolution(this.rl);
          for (const conflict of analysis.conflicts) {
            conflictResolutions.set(conflict.path, bulkResolution);
            if (bulkResolution === 'contribute') {
              resolutionContext.pendingContributions.push(conflict.path);
            }
          }
        } else {
          // Individual resolution with "apply to all" support
          for (let i = 0; i < analysis.conflicts.length; i++) {
            const conflict = analysis.conflicts[i];
            const fileInfo: InteractiveFileInfo = {
              path: conflict.path,
              templateDescription: conflict.reason,
            };

            const result = await promptConflictResolution(
              fileInfo,
              i,
              analysis.conflicts.length,
              resolutionContext,
              this.rl
            );

            conflictResolutions.set(conflict.path, result.resolution);
            if (result.resolution === 'contribute') {
              resolutionContext.pendingContributions.push(conflict.path);
            }

            // If user selected "apply to all", store it in context
            if (result.applyToAll) {
              resolutionContext.conflictApplyAll = result.resolution;
            }
          }
        }
      }
    }

    // Step 7: Confirm sync (skip if --yes flag or auto mode)
    if (!dryRun && !quiet && isInteractive() && autoMode === 'none' && !this.options.acceptAll) {
      const parts = [];
      if (analysis.toCopy.length > 0) parts.push(`${analysis.toCopy.length} copy`);
      if (analysis.toDelete.length > 0) parts.push(`${analysis.toDelete.length} delete`);
      if (analysis.toMerge.length > 0) parts.push(`${analysis.toMerge.length} merge`);
      if (divergedResolutions.size > 0) parts.push(`${divergedResolutions.size} diverged`);

      const proceed = await confirm(
        `\nProceed with sync? (${parts.join(', ')})`,
        true
      );
      if (!proceed) {
        console.log('\n❌ Sync cancelled.');
        await cleanupTemplate(this.context);
        return;
      }
    }

    // Step 8: Apply changes
    console.log('\n🔄 Applying changes...');
    const result = await syncFolderOwnership(
      analysis,
      config,
      this.projectRoot,
      templateDir,
      {
        dryRun,
        quiet,
        conflictResolutions,
        divergedResolutions,
      }
    );

    // Step 8: Update config
    if (!dryRun) {
      // Get template commit for tracking
      try {
        const templateCommit = exec('git rev-parse HEAD', templateDir, { silent: true }).trim();
        config.lastSyncCommit = templateCommit;
      } catch {
        // Ignore if we can't get commit
      }

      config.lastSyncDate = new Date().toISOString();
      saveConfig(this.projectRoot, config);

      // Auto-commit any uncommitted sync changes (including from previous syncs)
      this.autoCommitChanges(quiet);
    }

    // Step 9: Print results
    displaySyncResults(
      result.copied.length,
      0, // updated (included in copied)
      result.deleted.length,
      result.merged.length,
      result.skipped.length,
      resolutionContext.pendingContributions.length,
      result.errors
    );

    // Show contribution reminder if any files were marked
    displayContributionReminder(resolutionContext.pendingContributions);

    // Step 10: Cleanup
    await cleanupTemplate(this.context);

    if (dryRun) {
      console.log('\n📝 Dry run complete. No changes were made.');
    }
  }

  async run(): Promise<void> {
    // Handle JSON mode first - run silently and output structured result
    if (this.context.options.json) {
      await runJsonMode(this.context);
      this.rl.close();
      return;
    }

    // Run folder ownership sync (only supported config format)
    try {
      await this.runFolderOwnershipSync();
    } finally {
      this.rl.close();
    }
  }
}
