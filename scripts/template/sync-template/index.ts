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
 *   --yes, -y                Non-interactive mode: accept all template changes
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

import * as fs from 'fs';
import * as path from 'path';
import { SyncOptions, AutoMode } from './types';
import { TemplateSyncTool } from './sync-template-tool';

// Check if running on template project (templateRepo is empty)
const configPath = path.join(process.cwd(), '.template-sync.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (!config.templateRepo) {
    console.error('❌ Error: Cannot run sync-template on the template repository itself.');
    console.error('   This script is meant for child projects that sync FROM the template.');
    console.error('   Use "yarn sync-children" to push changes to child projects instead.');
    process.exit(1);
  }
}

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
  acceptAll: args.includes('--yes') || args.includes('-y'),  // Non-interactive accept all
};

// Run sync tool
const tool = new TemplateSyncTool(options);
tool.run().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
