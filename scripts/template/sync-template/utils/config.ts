/**
 * Configuration file I/O utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CONFIG_FILE,
  TemplateSyncConfig,
  AnyTemplateSyncConfig,
  FolderOwnershipConfig,
  isFolderOwnershipConfig,
  isLegacyConfig
} from '../types';

/**
 * Load the template sync configuration from disk.
 * Returns the raw config - use type guards to determine format.
 */
export function loadConfig(projectRoot: string): AnyTemplateSyncConfig {
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
 * Save the template sync configuration to disk
 */
export function saveConfig(projectRoot: string, config: AnyTemplateSyncConfig): void {
  const configPath = path.join(projectRoot, CONFIG_FILE);
  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2) + '\n',
    'utf-8'
  );
}

/**
 * Load template's config and merge templateIgnoredFiles into project config.
 * This allows the template to specify files that should never be synced to children.
 * Only applies to legacy config format.
 */
export function mergeTemplateIgnoredFiles(projectRoot: string, config: AnyTemplateSyncConfig, templateDir: string): void {
  // Only applicable to legacy config
  if (!isLegacyConfig(config)) {
    return;
  }

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
