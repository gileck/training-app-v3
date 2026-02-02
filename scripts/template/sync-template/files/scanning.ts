/**
 * File scanning utilities
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Get all files in a directory recursively
 */
export function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    // Skip .git directory always
    if (entry.name === '.git') {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else if (entry.isSymbolicLink()) {
      // For symlinks, check if target is a directory
      try {
        const targetStat = fs.statSync(fullPath);
        if (targetStat.isDirectory()) {
          // Symlink to directory - include it as a "file" to sync the symlink itself
          // Don't recurse into it
          files.push(relativePath);
        } else {
          // Symlink to file - include it
          files.push(relativePath);
        }
      } catch {
        // Broken symlink - still include it to sync the symlink
        files.push(relativePath);
      }
    } else {
      files.push(relativePath);
    }
  }

  return files;
}
