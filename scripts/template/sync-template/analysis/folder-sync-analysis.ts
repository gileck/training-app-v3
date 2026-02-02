/**
 * Folder Sync Analysis - Path Ownership Model
 *
 * Analyzes template vs project files using explicit path ownership.
 * Replaces hash-based conflict detection with clear ownership rules.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FolderOwnershipConfig, FolderSyncAnalysis, FolderSyncFile, FolderSyncAction, TEMPLATE_DIR } from '../types';
import { getFileHash } from '../files/hashing';
import { mergePackageJson, readPackageJson } from '../utils/package-json-merge';

/**
 * Expand glob patterns to actual file paths
 */
export function expandGlob(pattern: string, baseDir: string): string[] {
  const results: string[] = [];

  // Handle ** patterns (recursive)
  if (pattern.includes('**')) {
    const [prefix, suffix] = pattern.split('**');
    const startDir = path.join(baseDir, prefix);

    if (!fs.existsSync(startDir)) {
      return [];
    }

    const walkDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile()) {
          // Check if suffix matches (e.g., "/*.md")
          if (suffix) {
            const suffixPattern = suffix.startsWith('/') ? suffix.slice(1) : suffix;
            if (matchSuffix(entry.name, suffixPattern)) {
              results.push(relativePath);
            }
          } else {
            results.push(relativePath);
          }
        }
      }
    };

    walkDir(startDir);
  }
  // Handle * patterns (single level)
  else if (pattern.includes('*')) {
    const dir = path.dirname(pattern);
    const filePattern = path.basename(pattern);
    const fullDir = path.join(baseDir, dir);

    if (!fs.existsSync(fullDir)) {
      return [];
    }

    const entries = fs.readdirSync(fullDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && matchWildcard(entry.name, filePattern)) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  // Direct file/folder path
  else {
    const fullPath = path.join(baseDir, pattern);

    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);

      if (stat.isFile()) {
        results.push(pattern);
      } else if (stat.isDirectory()) {
        // Include all files in directory recursively
        const walkDir = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullEntryPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullEntryPath);

            if (entry.isDirectory()) {
              walkDir(fullEntryPath);
            } else if (entry.isFile()) {
              results.push(relativePath);
            }
          }
        };
        walkDir(fullPath);
      }
    }
  }

  return results;
}

/**
 * Match a filename against a wildcard pattern (e.g., "*.md")
 */
function matchWildcard(filename: string, pattern: string): boolean {
  if (pattern === '*') return true;

  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  );
  return regex.test(filename);
}

/**
 * Match a filename against a suffix pattern
 */
function matchSuffix(filename: string, suffixPattern: string): boolean {
  if (!suffixPattern || suffixPattern === '*') return true;
  return matchWildcard(filename, suffixPattern);
}

/**
 * Check if a path matches any of the given patterns
 */
export function matchesPatterns(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.includes('**')) {
      const [prefix] = pattern.split('**');
      if (filePath.startsWith(prefix)) return true;
    } else if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      if (regex.test(filePath)) return true;
    } else {
      if (filePath === pattern || filePath.startsWith(pattern + '/')) return true;
    }
  }
  return false;
}

/**
 * Expand all template paths from config to actual file list
 */
export function expandTemplatePaths(config: FolderOwnershipConfig, templateDir: string): string[] {
  const allFiles = new Set<string>();

  for (const pattern of config.templatePaths) {
    const files = expandGlob(pattern, templateDir);
    for (const file of files) {
      allFiles.add(file);
    }
  }

  return Array.from(allFiles).sort();
}

/**
 * Get all files in a directory (recursively)
 */
function getAllFilesInDir(dir: string, baseDir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const walkDir = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        results.push(relativePath);
      }
    }
  };

  walkDir(dir);
  return results;
}

/**
 * Get project files that match template paths patterns
 */
export function getProjectFilesMatchingTemplatePaths(config: FolderOwnershipConfig, projectDir: string): string[] {
  const allFiles = new Set<string>();

  for (const pattern of config.templatePaths) {
    const files = expandGlob(pattern, projectDir);
    for (const file of files) {
      allFiles.add(file);
    }
  }

  return Array.from(allFiles).sort();
}

/**
 * Check if template changed a file since last sync (for override detection)
 */
function templateChangedFile(
  filePath: string,
  templateDir: string,
  config: FolderOwnershipConfig
): boolean {
  const overrideHashes = config.overrideHashes || {};
  const savedHash = overrideHashes[filePath];

  if (!savedHash) {
    // No baseline hash, assume changed
    return true;
  }

  const templatePath = path.join(templateDir, filePath);
  if (!fs.existsSync(templatePath)) {
    // File deleted in template
    return true;
  }

  const currentHash = getFileHash(templatePath);
  return currentHash !== savedHash;
}

/**
 * Categorize a file for sync action
 */
function categorizeFile(
  filePath: string,
  config: FolderOwnershipConfig,
  templateDir: string,
  projectDir: string
): FolderSyncFile {
  const templatePath = path.join(templateDir, filePath);
  const projectPath = path.join(projectDir, filePath);

  const inTemplate = fs.existsSync(templatePath);
  const inProject = fs.existsSync(projectPath);
  const isOverride = config.projectOverrides.includes(filePath);

  // Special case: package.json uses 3-way merge
  if (filePath === 'package.json') {
    // Check if merge would actually produce changes
    if (inTemplate && inProject) {
      try {
        const templatePkg = readPackageJson(templatePath);
        const projectPkg = readPackageJson(projectPath);

        if (templatePkg && projectPkg) {
          const mergeResult = mergePackageJson(null, templatePkg, projectPkg);

          if (mergeResult.success && mergeResult.merged) {
            // Compare merged result with current project package.json
            const mergedStr = JSON.stringify(mergeResult.merged, null, 2);
            const projectStr = JSON.stringify(projectPkg, null, 2);

            if (mergedStr === projectStr) {
              // No changes - skip merge
              return {
                path: filePath,
                action: 'skip',
                reason: 'Already up to date',
                inTemplate,
                inProject,
                isOverride: false,
              };
            }
          }
        }
      } catch {
        // If we can't check, proceed with merge
      }
    }

    return {
      path: filePath,
      action: 'merge',
      reason: 'package.json uses 3-way merge',
      inTemplate,
      inProject,
      isOverride: false,
    };
  }

  // File in template
  if (inTemplate) {
    // Project override - always keep project version
    if (isOverride) {
      const templateChanged = templateChangedFile(filePath, templateDir, config);

      return {
        path: filePath,
        action: 'skip',
        reason: templateChanged
          ? 'Project override (⚠️ template changed - review manually)'
          : 'Project override, template unchanged',
        inTemplate,
        inProject,
        isOverride,
        templateChanged,
      };
    }

    // Normal template file - check if actually changed
    if (inProject) {
      const templateHash = getFileHash(templatePath);
      const projectHash = getFileHash(projectPath);

      if (templateHash === projectHash) {
        // File is identical, no need to copy
        return {
          path: filePath,
          action: 'skip',
          reason: 'Already up to date',
          inTemplate,
          inProject,
          isOverride,
        };
      }

      // Files differ - template wins (this is the whole point of folder ownership)
      // If project wants to keep their version, they should add it to projectOverrides
      return {
        path: filePath,
        action: 'copy',
        reason: 'Updated in template',
        inTemplate,
        inProject,
        isOverride,
      };
    }

    // New file from template - safe to copy
    return {
      path: filePath,
      action: 'copy',
      reason: 'New file from template',
      inTemplate,
      inProject,
      isOverride,
    };
  }

  // File NOT in template (but was in project)
  if (inProject) {
    // Project override - keep it
    if (isOverride) {
      return {
        path: filePath,
        action: 'skip',
        reason: 'Project override (template does not have this file)',
        inTemplate,
        inProject,
        isOverride,
      };
    }

    // Template deleted this file
    return {
      path: filePath,
      action: 'delete',
      reason: 'Removed from template',
      inTemplate,
      inProject,
      isOverride,
    };
  }

  // File not in either (shouldn't happen, but handle it)
  return {
    path: filePath,
    action: 'skip',
    reason: 'File not found in template or project',
    inTemplate,
    inProject,
    isOverride,
  };
}

/**
 * Main analysis function for folder ownership sync
 */
export function analyzeFolderSync(
  config: FolderOwnershipConfig,
  projectDir: string,
  templateDir: string = path.join(projectDir, TEMPLATE_DIR)
): FolderSyncAnalysis {
  const analysis: FolderSyncAnalysis = {
    toCopy: [],
    toDelete: [],
    toSkip: [],
    conflicts: [],
    toMerge: [],
    diverged: [],
    expandedTemplatePaths: [],
  };

  // Get all files that should be synced from template
  let templateFiles = expandTemplatePaths(config, templateDir);

  // Filter out template-ignored files (e.g., example/demo code)
  const templateIgnored = config.templateIgnoredFiles || [];
  if (templateIgnored.length > 0) {
    templateFiles = templateFiles.filter(file => !matchesPatterns(file, templateIgnored));
  }

  analysis.expandedTemplatePaths = templateFiles;

  // Get all project files that match template paths (for deletion detection)
  let projectFiles = getProjectFilesMatchingTemplatePaths(config, projectDir);

  // Also filter project files - don't delete ignored files
  if (templateIgnored.length > 0) {
    projectFiles = projectFiles.filter(file => !matchesPatterns(file, templateIgnored));
  }

  // Combine both sets of files
  const allFiles = new Set([...templateFiles, ...projectFiles]);

  // Categorize each file
  for (const filePath of allFiles) {
    const file = categorizeFile(filePath, config, templateDir, projectDir);

    switch (file.action) {
      case 'copy':
        analysis.toCopy.push(file);
        break;
      case 'delete':
        analysis.toDelete.push(file);
        break;
      case 'skip':
        analysis.toSkip.push(file);
        break;
      case 'conflict':
        analysis.conflicts.push(file);
        break;
      case 'merge':
        analysis.toMerge.push(file);
        break;
      case 'diverged':
        analysis.diverged.push(file);
        break;
    }
  }

  return analysis;
}

/**
 * Print analysis summary
 */
export function printFolderSyncAnalysis(analysis: FolderSyncAnalysis, verbose: boolean = false): void {
  console.log('\n📊 Folder Ownership Analysis');
  console.log('='.repeat(60));

  // Categorize skipped files
  const upToDate = analysis.toSkip.filter(f => f.reason === 'Already up to date');
  const overridesWithTemplateChanges = analysis.toSkip.filter(f => f.isOverride && f.templateChanged);
  const otherSkipped = analysis.toSkip.filter(f =>
    f.reason !== 'Already up to date' && !(f.isOverride && f.templateChanged)
  );

  const hasActions = analysis.toCopy.length > 0 ||
                     analysis.toDelete.length > 0 ||
                     analysis.toMerge.length > 0 ||
                     analysis.conflicts.length > 0 ||
                     analysis.diverged.length > 0;

  if (analysis.toCopy.length > 0) {
    console.log(`\n📥 To Copy (${analysis.toCopy.length}):`);
    for (const file of analysis.toCopy.slice(0, 10)) {
      console.log(`   ${file.inProject ? '📝' : '✨'} ${file.path}`);
    }
    if (analysis.toCopy.length > 10) {
      console.log(`   ... and ${analysis.toCopy.length - 10} more`);
    }
  }

  if (analysis.toDelete.length > 0) {
    console.log(`\n🗑️  To Delete (${analysis.toDelete.length}):`);
    for (const file of analysis.toDelete.slice(0, 10)) {
      console.log(`   🗑️  ${file.path}`);
    }
    if (analysis.toDelete.length > 10) {
      console.log(`   ... and ${analysis.toDelete.length - 10} more`);
    }
  }

  if (analysis.toMerge.length > 0) {
    console.log(`\n🔀 To Merge (${analysis.toMerge.length}):`);
    for (const file of analysis.toMerge) {
      console.log(`   🔀 ${file.path}`);
    }
  }

  if (analysis.conflicts.length > 0) {
    console.log(`\n⚠️  Conflicts (${analysis.conflicts.length}):`);
    for (const file of analysis.conflicts) {
      console.log(`   ⚠️  ${file.path} - ${file.reason}`);
    }
  }

  if (analysis.diverged.length > 0) {
    console.log(`\n🔶 Diverged - Need Decision (${analysis.diverged.length}):`);
    for (const file of analysis.diverged.slice(0, 10)) {
      console.log(`   🔶 ${file.path}`);
    }
    if (analysis.diverged.length > 10) {
      console.log(`   ... and ${analysis.diverged.length - 10} more`);
    }
    console.log(`   ℹ️  These files were modified in your project but not added to projectOverrides`);
  }

  // Show override files where template changed (needs manual review)
  if (overridesWithTemplateChanges.length > 0) {
    console.log(`\n⚠️  Override files with template changes (${overridesWithTemplateChanges.length}):`);
    console.log(`   ℹ️  These files are kept as-is, but template has updates you may want to review:`);
    for (const file of overridesWithTemplateChanges.slice(0, 10)) {
      console.log(`   ⚠️  ${file.path}`);
    }
    if (overridesWithTemplateChanges.length > 10) {
      console.log(`   ... and ${overridesWithTemplateChanges.length - 10} more`);
    }
  }

  // Only show other skipped files (not "already up to date") unless verbose
  if (otherSkipped.length > 0) {
    console.log(`\n⏭️  Skipped (${otherSkipped.length}):`);
    for (const file of otherSkipped.slice(0, 5)) {
      console.log(`   ⏭️  ${file.path} - ${file.reason}`);
    }
    if (otherSkipped.length > 5) {
      console.log(`   ... and ${otherSkipped.length - 5} more`);
    }
  }

  // Show "already up to date" only in verbose mode
  if (verbose && upToDate.length > 0) {
    console.log(`\n✅ Already up to date (${upToDate.length}):`);
    for (const file of upToDate.slice(0, 10)) {
      console.log(`   ✅ ${file.path}`);
    }
    if (upToDate.length > 10) {
      console.log(`   ... and ${upToDate.length - 10} more`);
    }
  }

  console.log('\n' + '='.repeat(60));

  // Build summary line
  const parts: string[] = [];
  if (analysis.toCopy.length > 0) parts.push(`${analysis.toCopy.length} to copy`);
  if (analysis.toDelete.length > 0) parts.push(`${analysis.toDelete.length} to delete`);
  if (analysis.toMerge.length > 0) parts.push(`${analysis.toMerge.length} to merge`);
  if (analysis.conflicts.length > 0) parts.push(`${analysis.conflicts.length} conflicts`);
  if (analysis.diverged.length > 0) parts.push(`${analysis.diverged.length} diverged`);

  if (parts.length > 0) {
    console.log(`Summary: ${parts.join(', ')}`);
  }

  if (upToDate.length > 0) {
    console.log(`✅ ${upToDate.length} files already up to date`);
  }

  if (!hasActions && upToDate.length > 0) {
    console.log('\n✨ Everything is in sync!');
  }
}
