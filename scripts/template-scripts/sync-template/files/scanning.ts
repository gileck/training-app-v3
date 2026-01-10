/**
 * File scanning utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { TemplateSyncConfig } from '../types';
import { shouldIgnore } from './ignore-patterns';

/**
 * Get all files in a directory recursively
 */
export function getAllFiles(
  config: TemplateSyncConfig,
  dir: string,
  baseDir: string = dir,
  includeIgnored: boolean = false
): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    // Skip .git directory always
    if (entry.name === '.git') {
      continue;
    }

    // Skip ignored files/directories (unless includeIgnored is true)
    if (!includeIgnored && shouldIgnore(config, relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...getAllFiles(config, fullPath, baseDir, includeIgnored));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}
