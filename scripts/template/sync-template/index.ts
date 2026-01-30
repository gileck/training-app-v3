#!/usr/bin/env tsx

/**
 * Template Sync Script
 *
 * This script helps merge updates from the template repository into a project
 * that was created from the template.
 *
 * Usage:
 *   yarn sync-template [options]
 *
 * Options:
 *   --dry-run                Show what would be done without making changes
 *   --force                  Force update even if there are uncommitted changes
 *   --diff-summary           Generate a diff summary file showing all template changes
 *   --skip-ignored           Skip ignored files in diff-summary output
 *   --modified-only          Show only modified files (excludes new, ignored, project-specific)
 *   --changelog              Show template commits since last sync (no sync)
 *   --show-drift             Show total project drift with full file list (no sync)
 *   --report                 Generate a sync report file (SYNC-REPORT.md)
 *   --quiet                  Minimal output (errors only)
 *   --verbose                Detailed output for debugging
 *   --use-https              Use HTTPS instead of SSH for cloning (SSH is default)
 *   --merge-package-json     Only merge package.json from template (no full sync)
 *   --migrate                Migrate from legacy config to folder ownership model
 *
 * Note: Validation checks (TypeScript + ESLint) are automatically run before committing.
 *       If checks fail, changes are applied but NOT committed - you must fix issues and commit manually.
 *
 * Auto modes (non-interactive):
 *   --auto-safe-only         Apply only safe changes, skip all conflicts
 *   --auto-merge-conflicts   Apply all changes, create .template files for conflicts
 *   --auto-override-conflicts Apply all changes, override conflicts with template version
 *   --auto-skip-conflicts    Apply safe changes, skip all conflicting files
 *   --init-hashes            Initialize baseline hashes for all files (no sync)
 *   --project-diffs          Show diffs for files changed in project (for contribute-to-template)
 */

import { SyncOptions, AutoMode, isLegacyConfig } from './types';
import { TemplateSyncTool } from './sync-template-tool';
import { loadConfig, saveConfig, runMigrationWizard, backupLegacyConfig, printMigrationHelp } from './utils';

// Main execution
const args = process.argv.slice(2);

// Parse auto mode flags (mutually exclusive)
let autoMode: AutoMode = 'none';
if (args.includes('--auto-safe-only')) {
  autoMode = 'safe-only';
} else if (args.includes('--auto-merge-conflicts')) {
  autoMode = 'merge-conflicts';
} else if (args.includes('--auto-override-conflicts')) {
  autoMode = 'override-conflicts';
} else if (args.includes('--auto-skip-conflicts')) {
  autoMode = 'skip-conflicts';
}

const options: SyncOptions = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force'),
  autoMode,
  diffSummary: args.includes('--diff-summary'),
  skipIgnored: args.includes('--skip-ignored'),
  modifiedOnly: args.includes('--modified-only'),
  changelog: args.includes('--changelog'),
  showDrift: args.includes('--show-drift'),
  report: args.includes('--report'),
  quiet: args.includes('--quiet') || args.includes('--json'),  // JSON mode implies quiet
  verbose: args.includes('--verbose'),
  useHTTPS: args.includes('--use-https'),
  initHashes: args.includes('--init-hashes'),
  projectDiffs: args.includes('--project-diffs'),
  json: args.includes('--json'),
  mergePackageJson: args.includes('--merge-package-json'),
};

// Handle migration mode
if (args.includes('--migrate')) {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);

  if (!isLegacyConfig(config)) {
    console.log('✅ Config is already using folder ownership model. No migration needed.');
    process.exit(0);
  }

  runMigrationWizard(config, projectRoot)
    .then(newConfig => {
      if (newConfig) {
        // Backup old config
        const backupPath = backupLegacyConfig(projectRoot);
        console.log(`\n📁 Legacy config backed up to: ${backupPath}`);

        // Save new config
        saveConfig(projectRoot, newConfig);
        console.log('✅ Migration complete! New config saved to .template-sync.json');
        console.log('\nNext steps:');
        console.log('  1. Review .template-sync.json');
        console.log('  2. Adjust templatePaths and projectOverrides as needed');
        console.log('  3. Run: yarn sync-template --dry-run');
      } else {
        console.log('❌ Migration cancelled.');
      }
    })
    .catch(error => {
      console.error('❌ Migration error:', error.message);
      process.exit(1);
    });
} else if (args.includes('--migration-help')) {
  printMigrationHelp();
} else {
  const tool = new TemplateSyncTool(options);
  tool.run().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}
