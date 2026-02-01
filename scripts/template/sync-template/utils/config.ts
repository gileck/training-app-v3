/**
 * Configuration file I/O utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CONFIG_FILE,
  TEMPLATE_CONFIG_FILE,
  TemplateSyncConfig,
  AnyTemplateSyncConfig,
  FolderOwnershipConfig,
  TemplateOwnedConfig,
  ProjectOwnedConfig,
  isFolderOwnershipConfig,
  isLegacyConfig
} from '../types';

/**
 * Check if split config files exist AND project config is in the new format.
 * Returns false if project config still has legacy fields (needs migration).
 */
export function hasSplitConfig(projectRoot: string): boolean {
  const templateConfigPath = path.join(projectRoot, TEMPLATE_CONFIG_FILE);
  if (!fs.existsSync(templateConfigPath)) {
    return false;
  }

  // Also check that project config is NOT legacy format
  const projectConfigPath = path.join(projectRoot, CONFIG_FILE);
  if (fs.existsSync(projectConfigPath)) {
    const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
    // If project config has legacy fields, it needs migration
    if ('fileHashes' in projectConfig || 'ignoredFiles' in projectConfig) {
      return false;
    }
  }

  return true;
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
 * Load and merge split configs into a FolderOwnershipConfig
 */
export function loadSplitConfig(projectRoot: string): FolderOwnershipConfig | null {
  const templateConfig = loadTemplateConfig(projectRoot);
  const projectConfig = loadProjectConfig(projectRoot);

  if (!templateConfig || !projectConfig) {
    return null;
  }

  // Merge both configs
  return {
    ...projectConfig,
    ...templateConfig,
  };
}

/**
 * Load the template sync configuration from disk.
 * Supports both split config (new) and single file (legacy/old folder ownership).
 */
export function loadConfig(projectRoot: string): AnyTemplateSyncConfig {
  // Try split config first (new pattern)
  if (hasSplitConfig(projectRoot)) {
    const merged = loadSplitConfig(projectRoot);
    if (merged) {
      return merged;
    }
  }

  // Fall back to single file
  const configPath = path.join(projectRoot, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    console.error('❌ Error: .template-sync.json not found.');
    console.error('Run "yarn init-template" first to initialize template tracking.');
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

/**
 * Load config and assert it's the legacy format.
 * Use this in existing code that expects legacy config.
 */
export function loadLegacyConfig(projectRoot: string): TemplateSyncConfig {
  const config = loadConfig(projectRoot);
  if (!isLegacyConfig(config)) {
    throw new Error('Expected legacy config format but found folder ownership config');
  }
  return config;
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
 * If using split config, saves to both files appropriately.
 */
export function saveConfig(projectRoot: string, config: AnyTemplateSyncConfig): void {
  if (hasSplitConfig(projectRoot) && isFolderOwnershipConfig(config)) {
    // Save to split files
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
  } else {
    // Save to single file (legacy or non-split folder ownership)
    const configPath = path.join(projectRoot, CONFIG_FILE);
    fs.writeFileSync(
      configPath,
      JSON.stringify(config, null, 2) + '\n',
      'utf-8'
    );
  }
}

/**
 * Load template's config and merge templateIgnoredFiles into project config.
 * This allows the template to specify files that should never be synced to children.
 * Works with both legacy and folder ownership config formats.
 */
export function mergeTemplateIgnoredFiles(projectRoot: string, config: AnyTemplateSyncConfig, templateDir: string): void {
  const templateConfigPath = path.join(projectRoot, templateDir, CONFIG_FILE);

  if (!fs.existsSync(templateConfigPath)) {
    return;
  }

  try {
    const templateConfig = JSON.parse(fs.readFileSync(templateConfigPath, 'utf-8')) as Partial<TemplateSyncConfig>;
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

/**
 * Check if the config is using the new folder ownership model
 */
export function isNewConfigFormat(config: AnyTemplateSyncConfig): config is FolderOwnershipConfig {
  return isFolderOwnershipConfig(config);
}

/**
 * Check if the config needs migration to the new format
 */
export function needsMigration(config: AnyTemplateSyncConfig): boolean {
  return isLegacyConfig(config);
}

/**
 * Get config format description for logging
 */
export function getConfigFormatDescription(config: AnyTemplateSyncConfig): string {
  if (isFolderOwnershipConfig(config)) {
    return 'Folder Ownership Model (new)';
  }
  return 'Hash-Based Model (legacy)';
}
