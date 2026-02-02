/**
 * File pattern matching utilities
 */

import { FolderOwnershipConfig } from '../types';

/**
 * Check if a file matches a list of patterns
 */
export function matchesPatterns(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/');

  return patterns.some(pattern => {
    // Normalize pattern
    const normalizedPattern = pattern.replace(/\\/g, '/');

    // Exact match
    if (normalized === normalizedPattern) return true;

    // Handle glob patterns with * or **
    if (normalizedPattern.includes('*')) {
      // Use placeholder to avoid replacing * inside .* from **
      const regexPattern = normalizedPattern
        .replace(/\*\*/g, '<<<GLOBSTAR>>>')  // Temporarily replace **
        .replace(/\*/g, '[^/]*')              // * matches anything except /
        .replace(/<<<GLOBSTAR>>>/g, '.*')     // ** matches anything (including /)
        .replace(/\//g, '\\/');               // escape slashes

      const regex = new RegExp('^' + regexPattern + '$');
      if (regex.test(normalized)) return true;
    }

    // Directory match (if pattern is a directory name anywhere in path)
    if (normalized.split('/').includes(normalizedPattern)) return true;

    // Start with match (for directory paths)
    if (normalized.startsWith(normalizedPattern + '/')) return true;

    return false;
  });
}

/**
 * Check if a file is in the project overrides list.
 * Override files are kept different from the template.
 */
export function isProjectOverride(config: FolderOwnershipConfig, filePath: string): boolean {
  return matchesPatterns(filePath, config.projectOverrides);
}

/**
 * Check if a file should be ignored from the template side.
 * These are template files that should never be synced (e.g., example/demo code).
 */
export function shouldIgnoreTemplateFile(config: FolderOwnershipConfig, filePath: string): boolean {
  const templateIgnored = config.templateIgnoredFiles || [];
  if (templateIgnored.length === 0) return false;

  return matchesPatterns(filePath, templateIgnored);
}

/**
 * Check if a file matches the template paths (should be synced)
 */
export function matchesTemplatePaths(config: FolderOwnershipConfig, filePath: string): boolean {
  return matchesPatterns(filePath, config.templatePaths);
}
