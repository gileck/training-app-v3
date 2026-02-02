/**
 * Configuration file I/O utilities
 *
 * Uses split config model:
 * - .template-sync.template.json (template-owned, synced from template)
 * - .template-sync.json (project-owned, your overrides)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CONFIG_FILE,
  TEMPLATE_CONFIG_FILE,
  FolderOwnershipConfig,
  TemplateOwnedConfig,
  ProjectOwnedConfig,
} from '../types';

/**
 * Check if the config has legacy fields that are no longer supported
 */
function hasLegacyFields(config: Record<string, unknown>): boolean {
  return 'fileHashes' in config || 'ignoredFiles' in config || 'projectSpecificFiles' in config;
}

/**
 * Load the template-owned config (.template-sync.template.json)
 */
export function loadTemplateConfig(projectRoot: string): TemplateOwnedConfig | null {
  const configPath = path.join(projectRoot, TEMPLATE_CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

/**
 * Load the project-owned config (.template-sync.json)
 */
export function loadProjectConfig(projectRoot: string): ProjectOwnedConfig | null {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

/**
 * Load the template sync configuration from disk.
 * Requires both config files to exist in the new split format.
 */
export function loadConfig(projectRoot: string): FolderOwnershipConfig {
  const templateConfigPath = path.join(projectRoot, TEMPLATE_CONFIG_FILE);
  const projectConfigPath = path.join(projectRoot, CONFIG_FILE);

  // Check for template config
  if (!fs.existsSync(templateConfigPath)) {
    console.error(`❌ Error: ${TEMPLATE_CONFIG_FILE} not found.`);
    console.error('');
    console.error('This file should be copied from the template repository.');
    console.error('Copy it manually:');
    console.error(`  cp <template-repo>/${TEMPLATE_CONFIG_FILE} .`);
    process.exit(1);
  }

  // Check for project config
  if (!fs.existsSync(projectConfigPath)) {
    console.error(`❌ Error: ${CONFIG_FILE} not found.`);
    console.error('');
    console.error('Run "yarn init-template <template-url>" to initialize template tracking.');
    process.exit(1);
  }

  // Load and validate project config
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));

  if (hasLegacyFields(projectConfig)) {
    console.error('❌ Error: Legacy config format detected.');
    console.error('');
    console.error('The hash-based sync config is no longer supported.');
    console.error('Please manually update your .template-sync.json to the new format.');
    console.error('');
    console.error('Remove these fields: fileHashes, ignoredFiles, projectSpecificFiles, baseCommit');
    console.error('');
    console.error('Required fields in .template-sync.json:');
    console.error('  - templateRepo: URL of the template repository');
    console.error('  - templateBranch: Branch to sync from (usually "main")');
    console.error('  - projectOverrides: Array of files to keep different from template');
    console.error('');
    console.error('See docs/template/template-sync/template-sync.md for details.');
    process.exit(1);
  }

  // Load template config
  const templateConfig = JSON.parse(fs.readFileSync(templateConfigPath, 'utf-8'));

  // Merge both configs
  return {
    ...projectConfig,
    ...templateConfig,
  };
}

/**
 * Save the template-owned config (.template-sync.template.json)
 */
export function saveTemplateConfig(projectRoot: string, config: TemplateOwnedConfig): void {
  const configPath = path.join(projectRoot, TEMPLATE_CONFIG_FILE);
  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2) + '\n',
    'utf-8'
  );
}

/**
 * Save the project-owned config (.template-sync.json)
 */
export function saveProjectConfig(projectRoot: string, config: ProjectOwnedConfig): void {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2) + '\n',
    'utf-8'
  );
}

/**
 * Save the template sync configuration to disk.
 * Saves to both split config files.
 */
export function saveConfig(projectRoot: string, config: FolderOwnershipConfig): void {
  const templateConfig: TemplateOwnedConfig = {
    templatePaths: config.templatePaths,
    templateIgnoredFiles: config.templateIgnoredFiles,
  };

  const projectConfig: ProjectOwnedConfig = {
    templateRepo: config.templateRepo,
    templateBranch: config.templateBranch,
    templateLocalPath: config.templateLocalPath,
    lastSyncCommit: config.lastSyncCommit,
    lastSyncDate: config.lastSyncDate,
    projectOverrides: config.projectOverrides,
    overrideHashes: config.overrideHashes,
    syncHistory: config.syncHistory,
  };

  saveTemplateConfig(projectRoot, templateConfig);
  saveProjectConfig(projectRoot, projectConfig);
}

/**
 * Check if split config files exist
 */
export function hasSplitConfig(projectRoot: string): boolean {
  const templateConfigPath = path.join(projectRoot, TEMPLATE_CONFIG_FILE);
  const projectConfigPath = path.join(projectRoot, CONFIG_FILE);
  return fs.existsSync(templateConfigPath) && fs.existsSync(projectConfigPath);
}

/**
 * Load template's config and merge templateIgnoredFiles into project config.
 * This allows the template to specify files that should never be synced to children.
 */
export function mergeTemplateIgnoredFiles(projectRoot: string, config: FolderOwnershipConfig, templateDir: string): void {
  const templateConfigPath = path.join(projectRoot, templateDir, TEMPLATE_CONFIG_FILE);

  if (!fs.existsSync(templateConfigPath)) {
    return;
  }

  try {
    const templateConfig = JSON.parse(fs.readFileSync(templateConfigPath, 'utf-8')) as Partial<TemplateOwnedConfig>;
    const templateIgnored = templateConfig.templateIgnoredFiles || [];

    if (templateIgnored.length > 0) {
      // Merge with existing (avoid duplicates)
      const existing = config.templateIgnoredFiles || [];
      const merged = Array.from(new Set([...existing, ...templateIgnored]));
      config.templateIgnoredFiles = merged;
    }
  } catch {
    // Ignore errors reading template config
  }
}
