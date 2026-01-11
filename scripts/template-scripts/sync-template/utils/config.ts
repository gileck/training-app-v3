/**
 * Configuration file I/O utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { CONFIG_FILE, TemplateSyncConfig } from '../types';

/**
 * Load the template sync configuration from disk
 */
export function loadConfig(projectRoot: string): TemplateSyncConfig {
  const configPath = path.join(projectRoot, CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    console.error('❌ Error: .template-sync.json not found.');
    console.error('Run "yarn init-template" first to initialize template tracking.');
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

/**
 * Save the template sync configuration to disk
 */
export function saveConfig(projectRoot: string, config: TemplateSyncConfig): void {
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
 */
export function mergeTemplateIgnoredFiles(projectRoot: string, config: TemplateSyncConfig, templateDir: string): void {
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
