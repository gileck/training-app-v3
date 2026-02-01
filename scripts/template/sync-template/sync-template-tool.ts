/**
 * Template Sync Tool - Main orchestration class
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { SyncContext, SyncOptions, SyncMode, AutoMode, ConflictResolutionMap, TEMPLATE_DIR, TEMPLATE_CONFIG_FILE, isLegacyConfig, isFolderOwnershipConfig, FolderOwnershipConfig, ConflictResolution } from './types';
import { loadConfig, saveConfig, saveTemplateConfig, mergeTemplateIgnoredFiles, getConfigFormatDescription, hasSplitConfig } from './utils/config';
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
import { promptUser, handleConflictResolution, printConflictResolutionSummary, displayTotalDiffSummary } from './ui';

// Sync operations
import { syncFiles, syncFolderOwnership } from './sync';

// Reporting
import { printResults, generateSyncReport, getTemplateCommitsSinceLastSync, formatSyncCommitMessage, addSyncHistoryEntry } from './reporting';

// Modes
import { runInitHashes, runProjectDiffs, runShowDrift, runChangelog, runDiffSummary, runValidation, initializeIdenticalFileHashes, runJsonMode, runMergePackageJson } from './modes';

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
    const rawConfig = loadConfig(this.projectRoot);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Check config format - only support folder ownership config
    if (!isFolderOwnershipConfig(rawConfig)) {
      console.error('');
      console.error('❌ Legacy config format detected.');
      console.error('');
      console.error('The hash-based sync config is no longer supported.');
      console.error('Please migrate to the Path Ownership config format.');
      console.error('');
      console.error('To migrate, run:');
      console.error('  yarn sync-template --migrate');
      console.error('');
      console.error('Or see docs/template/template-sync/template-sync.md for manual migration.');
      console.error('');
      process.exit(1);
    }

    // Store folder ownership config
    this.folderOwnershipConfig = rawConfig;

    // Create a minimal context for compatibility
    this.context = {
      config: {
        templateRepo: rawConfig.templateRepo,
        templateBranch: rawConfig.templateBranch,
        templateLocalPath: rawConfig.templateLocalPath,
        baseCommit: null,
        lastSyncCommit: rawConfig.lastSyncCommit,
        lastProjectCommit: null,
        lastSyncDate: rawConfig.lastSyncDate,
        ignoredFiles: [],
        projectSpecificFiles: [],
        syncHistory: rawConfig.syncHistory,
      },
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

    console.log('🔄 Template Sync Tool (Folder Ownership Model)');
    console.log('='.repeat(60));
    console.log(`📁 Config format: ${getConfigFormatDescription(config)}`);

    // Step 1: Clone/update template
    console.log('\n📦 Preparing template...');
    const templateDir = path.join(this.projectRoot, TEMPLATE_DIR);
    await cloneTemplate(this.context);

    // Step 1.5: Sync template config first (if template uses split config)
    this.syncTemplateConfig(templateDir, dryRun);

    // Step 1.6: Reload config after syncing template config
    const reloadedConfig = loadConfig(this.projectRoot);
    if (isFolderOwnershipConfig(reloadedConfig)) {
      Object.assign(config, reloadedConfig);
    }

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

    // Step 5: Handle diverged files (project modified template files not in overrides)
    let divergedResolutions: Map<string, 'override' | 'keep' | 'merge'> = new Map();

    if (analysis.diverged.length > 0) {
      if (autoMode === 'safe-only') {
        // In safe-only mode, skip diverged files (don't overwrite project changes)
        console.log(`\n🔶 ${analysis.diverged.length} diverged file(s) will be skipped (safe-only mode)`);
        console.log(`   To resolve: add files to projectOverrides or run interactive sync`);
      } else if (autoMode === 'override-conflicts') {
        // Override mode: use template version
        for (const file of analysis.diverged) {
          divergedResolutions.set(file.path, 'override');
        }
        console.log(`\n✅ Auto-overriding ${analysis.diverged.length} diverged file(s) with template version`);
      } else if (autoMode === 'skip-conflicts') {
        // Skip mode: keep project version but add to overrides
        for (const file of analysis.diverged) {
          divergedResolutions.set(file.path, 'keep');
        }
        console.log(`\n⏭️  Keeping ${analysis.diverged.length} diverged file(s) and adding to projectOverrides`);
      } else if (!quiet && isInteractive()) {
        // Interactive resolution
        console.log(`\n🔶 Found ${analysis.diverged.length} diverged file(s) - project modified but not in overrides:`);

        for (const file of analysis.diverged) {
          console.log(`\n   File: ${file.path}`);
          console.log(`   Your project has modified this template file.`);
          console.log(`\n   Options:`);
          console.log(`     1. Override - Replace with template version (lose your changes)`);
          console.log(`     2. Keep - Keep your version and add to projectOverrides`);
          console.log(`     3. Merge - Create .template file for manual merge, add to overrides`);

          const rl = this.rl;
          const answer = await new Promise<string>((resolve) => {
            rl.question(`   Choose [1/2/3] (default: 2): `, (ans) => {
              resolve(ans.trim().toLowerCase() || '2');
            });
          });

          if (answer === '1' || answer === 'override') {
            divergedResolutions.set(file.path, 'override');
          } else if (answer === '3' || answer === 'merge') {
            divergedResolutions.set(file.path, 'merge');
          } else {
            divergedResolutions.set(file.path, 'keep');
          }
        }
      }
    }

    // Step 6: Handle conflicts (project overrides where template also changed)
    let conflictResolutions: Map<string, ConflictResolution> = new Map();

    if (analysis.conflicts.length > 0) {
      if (autoMode === 'skip-conflicts') {
        for (const conflict of analysis.conflicts) {
          conflictResolutions.set(conflict.path, 'skip');
        }
        console.log(`\n⏭️  Auto-skipping ${analysis.conflicts.length} conflict(s)`);
      } else if (autoMode === 'override-conflicts') {
        for (const conflict of analysis.conflicts) {
          conflictResolutions.set(conflict.path, 'override');
        }
        console.log(`\n✅ Auto-overriding ${analysis.conflicts.length} conflict(s) with template version`);
      } else if (autoMode === 'safe-only') {
        // Skip conflicts entirely
        console.log(`\n⚠️  ${analysis.conflicts.length} conflict(s) will be skipped (safe-only mode)`);
      } else if (!quiet && isInteractive()) {
        // Interactive conflict resolution
        console.log(`\n⚠️  Found ${analysis.conflicts.length} conflict(s) that need resolution:`);
        for (const conflict of analysis.conflicts) {
          console.log(`\n   File: ${conflict.path}`);
          console.log(`   Reason: ${conflict.reason}`);

          const answer = await confirm(
            `   Override with template version?`,
            false
          );

          conflictResolutions.set(conflict.path, answer ? 'override' : 'skip');
        }
      }
    }

    // Step 7: Confirm sync
    if (!dryRun && !quiet && isInteractive() && autoMode === 'none') {
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
    console.log('\n' + '='.repeat(60));
    console.log('📊 Sync Results:');
    console.log(`   ✅ Copied: ${result.copied.length}`);
    console.log(`   🗑️  Deleted: ${result.deleted.length}`);
    console.log(`   🔀 Merged: ${result.merged.length}`);
    console.log(`   ⏭️  Skipped: ${result.skipped.length}`);
    console.log(`   ⚠️  Conflicts: ${result.conflicts.length}`);
    if (result.errors.length > 0) {
      console.log(`   ❌ Errors: ${result.errors.length}`);
      for (const error of result.errors) {
        console.log(`      - ${error}`);
      }
    }

    // Step 10: Cleanup
    await cleanupTemplate(this.context);

    if (dryRun) {
      console.log('\n📝 Dry run complete. No changes were made.');
    } else {
      console.log('\n✅ Sync complete!');
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
