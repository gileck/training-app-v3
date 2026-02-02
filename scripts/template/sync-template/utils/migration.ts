/**
 * Migration utilities for converting legacy config to folder ownership model
 */

import * as fs from 'fs';
import * as path from 'path';
import { TemplateSyncConfig, FolderOwnershipConfig, TEMPLATE_DIR } from '../types';
import { select, confirm } from '../../cli-utils';

/**
 * Default template paths - common patterns for template-owned files
 */
export const DEFAULT_TEMPLATE_PATHS: string[] = [
  // Core config files
  'package.json',
  'tsconfig.json',
  '.eslintrc.js',
  'eslint.config.mjs',
  'postcss.config.mjs',
  'next.config.ts',

  // Documentation
  'CLAUDE.md',
  'docs/template/**',

  // Scripts
  'scripts/template/**',

  // Skills
  '.ai/skills/template/**',

  // Shared UI components
  'src/client/components/ui/**',

  // Infrastructure code
  'src/client/query/**',
  'src/client/stores/**',
  'src/server/middleware/**',
  'src/server/utils/**',
  'src/server/database/**',

  // API infrastructure
  'src/pages/api/process/**',

  // App guidelines
  'app-guildelines/**',
];

/**
 * Files that are commonly customized by projects
 */
export const COMMON_PROJECT_OVERRIDES: string[] = [
  'src/app.config.js',
  'src/client/routes/index.ts',
  'src/client/components/NavLinks.tsx',
];

/**
 * Infer template paths from a legacy config
 */
export function inferTemplatePaths(legacyConfig: TemplateSyncConfig, projectRoot: string): string[] {
  // Start with default paths
  const paths = new Set<string>(DEFAULT_TEMPLATE_PATHS);

  // Add paths that are NOT in ignoredFiles or projectSpecificFiles
  // (these were being synced in the legacy model)

  // We could scan the project to find synced files, but for simplicity
  // we'll use the default template paths as a good starting point

  return Array.from(paths).sort();
}

/**
 * Infer project overrides from a legacy config
 */
export function inferProjectOverrides(legacyConfig: TemplateSyncConfig): string[] {
  const overrides: string[] = [];

  // Files in projectSpecificFiles that aren't directories are likely overrides
  for (const file of legacyConfig.projectSpecificFiles || []) {
    // Skip glob patterns and directories
    if (!file.includes('*') && !file.endsWith('/')) {
      overrides.push(file);
    }
  }

  return overrides;
}

/**
 * Convert legacy config to folder ownership config
 */
export function migrateConfig(
  legacyConfig: TemplateSyncConfig,
  options: {
    templatePaths?: string[];
    projectOverrides?: string[];
  } = {}
): FolderOwnershipConfig {
  const templatePaths = options.templatePaths || DEFAULT_TEMPLATE_PATHS;
  const projectOverrides = options.projectOverrides || inferProjectOverrides(legacyConfig);

  return {
    templateRepo: legacyConfig.templateRepo,
    templateBranch: legacyConfig.templateBranch,
    templateLocalPath: legacyConfig.templateLocalPath,
    lastSyncCommit: legacyConfig.lastSyncCommit,
    lastSyncDate: legacyConfig.lastSyncDate,
    templatePaths,
    projectOverrides,
    overrideHashes: {},
    syncHistory: legacyConfig.syncHistory,
  };
}

/**
 * Interactive migration wizard
 */
export async function runMigrationWizard(
  legacyConfig: TemplateSyncConfig,
  projectRoot: string
): Promise<FolderOwnershipConfig | null> {
  console.log('\n🔄 Template Sync Config Migration');
  console.log('='.repeat(60));
  console.log('\nThis wizard will help you migrate from the legacy hash-based');
  console.log('conflict detection to the new folder ownership model.');
  console.log('\nThe new model is simpler and more reliable:');
  console.log('  - Template paths are synced exactly (including deletions)');
  console.log('  - Project overrides let you keep specific files different');
  console.log('  - No more hash mismatches or missed conflicts');

  // Step 1: Confirm migration
  const proceed = await confirm('\nProceed with migration?', true);
  if (!proceed) {
    return null;
  }

  // Step 2: Get template paths from the TEMPLATE's config
  console.log('\n📁 Template Paths');
  console.log('─'.repeat(40));

  // Try to read templatePaths from the template's folder ownership config
  const templateDir = path.join(projectRoot, TEMPLATE_DIR);
  const templateConfigPath = path.join(templateDir, '.template-sync.json');

  let templatePaths: string[] = [];

  if (fs.existsSync(templateConfigPath)) {
    try {
      const templateConfig = JSON.parse(fs.readFileSync(templateConfigPath, 'utf-8'));
      if (templateConfig.templatePaths && Array.isArray(templateConfig.templatePaths)) {
        templatePaths = templateConfig.templatePaths;
        console.log('\nTemplate paths from template config:');
        for (const p of templatePaths.slice(0, 10)) {
          console.log(`  - ${p}`);
        }
        if (templatePaths.length > 10) {
          console.log(`  ... and ${templatePaths.length - 10} more`);
        }

        const useTemplatePaths = await confirm('\nUse these template paths?', true);
        if (!useTemplatePaths) {
          console.log('\n⚠️  Edit .template-sync.json manually after migration to customize.');
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  if (templatePaths.length === 0) {
    console.log('\n⚠️  No templatePaths found in template config.');
    console.log('   You must configure templatePaths manually in .template-sync.json');
    console.log('   after migration.');
    console.log('\n   templatePaths defines which paths the template owns and syncs.');
    console.log('   Example: ["package.json", "docs/template/**", "src/client/components/ui/**"]');

    const continueAnyway = await confirm('\nContinue with empty templatePaths?', false);
    if (!continueAnyway) {
      return null;
    }
  }

  // Step 3: Project overrides (start empty, user adds as needed)
  console.log('\n📝 Project Overrides');
  console.log('─'.repeat(40));
  console.log('\nProject overrides are files within templatePaths that you want to');
  console.log('keep different from the template. Start with none - add them as needed');
  console.log('when sync shows conflicts for files you want to customize.');

  let projectOverrides: string[] = [];

  // Step 4: Create new config
  const newConfig = migrateConfig(legacyConfig, {
    templatePaths,
    projectOverrides,
  });

  // Step 5: Show summary
  console.log('\n📊 Migration Summary');
  console.log('─'.repeat(40));
  console.log(`Template paths: ${newConfig.templatePaths.length}`);
  console.log(`Project overrides: ${newConfig.projectOverrides.length}`);

  // Step 6: Confirm
  const confirmMigration = await confirm('\nSave new config?', true);
  if (!confirmMigration) {
    return null;
  }

  return newConfig;
}

/**
 * Backup the legacy config before migration
 */
export function backupLegacyConfig(projectRoot: string): string {
  const configPath = path.join(projectRoot, '.template-sync.json');
  const backupPath = path.join(projectRoot, '.template-sync.legacy.json');

  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, backupPath);
  }

  return backupPath;
}

/**
 * Print migration help
 */
export function printMigrationHelp(): void {
  console.log(`
Template Sync Config Migration
==============================

The template sync tool now supports two config formats:

1. LEGACY (Hash-Based)
   - Uses file hashes to detect conflicts
   - Can have baseline drift issues
   - Uses: ignoredFiles, projectSpecificFiles, fileHashes

2. NEW (Folder Ownership)
   - Explicit path ownership model
   - Template paths sync exactly (including deletions)
   - Project overrides let you keep specific files different
   - Uses: templatePaths, projectOverrides

To migrate, run:
  yarn sync-template --migrate

Or manually edit .template-sync.json to add:
  "templatePaths": [...],
  "projectOverrides": [...]

And remove:
  "ignoredFiles", "projectSpecificFiles", "fileHashes", "baseCommit", etc.
`);
}
