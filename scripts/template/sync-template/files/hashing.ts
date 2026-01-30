/**
 * File hashing utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { TemplateSyncConfig, TEMPLATE_DIR } from '../types';

/**
 * Get the MD5 hash of a file or symlink.
 * For symlinks to directories, hashes the link target path.
 * For symlinks to files, hashes the file content.
 * For regular files, hashes the file content.
 */
export function getFileHash(filePath: string): string {
  // Check if path exists (lstat doesn't follow symlinks, so it works for broken symlinks too)
  try {
    fs.lstatSync(filePath);
  } catch {
    return '';
  }

  const stat = fs.lstatSync(filePath);

  if (stat.isSymbolicLink()) {
    // For symlinks, check if target is a directory
    const linkTarget = fs.readlinkSync(filePath);
    try {
      const targetStat = fs.statSync(filePath); // follows symlink
      if (targetStat.isDirectory()) {
        // Hash the symlink target path for directory symlinks
        return crypto.createHash('md5').update(`symlink:${linkTarget}`).digest('hex');
      }
    } catch {
      // Broken symlink - hash the target path
      return crypto.createHash('md5').update(`symlink:${linkTarget}`).digest('hex');
    }
  }

  if (stat.isDirectory()) {
    // Regular directories shouldn't be hashed
    return '';
  }

  // Regular file or symlink to file - hash content
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Get the stored hash for a file from the last sync.
 * Returns null if no hash is stored (first sync or file was never synced).
 */
export function getStoredHash(config: TemplateSyncConfig, filePath: string): string | null {
  return config.fileHashes?.[filePath] ?? null;
}

/**
 * Store the hash of a synced file for future comparison.
 */
export function storeFileHash(config: TemplateSyncConfig, filePath: string, hash: string): void {
  if (!config.fileHashes) {
    config.fileHashes = {};
  }
  config.fileHashes[filePath] = hash;
}

/**
 * Get the hash of a template file.
 */
export function getTemplateFileHash(projectRoot: string, filePath: string): string {
  const templatePath = path.join(projectRoot, TEMPLATE_DIR);
  const templateFilePath = path.join(templatePath, filePath);
  return getFileHash(templateFilePath);
}

/**
 * Get the hash of a project file.
 */
export function getProjectFileHash(projectRoot: string, filePath: string): string {
  const projectFilePath = path.join(projectRoot, filePath);
  return getFileHash(projectFilePath);
}
