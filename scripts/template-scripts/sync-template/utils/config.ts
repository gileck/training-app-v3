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
