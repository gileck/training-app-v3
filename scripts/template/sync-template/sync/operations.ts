/**
 * File sync operations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SyncContext, SyncMode, AnalysisResult, SyncResult, ConflictResolutionMap, TEMPLATE_DIR, FolderSyncAnalysis, FolderOwnershipConfig, FolderSyncFile, ConflictResolution } from '../types';
import { getFileHash, storeFileHash } from '../files';
import { writePackageJson, formatMergeSummary, formatConflictMessage, resolveFieldConflictsInteractively, mergePackageJsonFiles, readPackageJson, mergePackageJson } from '../utils/package-json-merge';

/**
 * Copy a file or symlink from source to destination.
 * Handles symlinks by recreating them at the destination instead of copying the target content.
 */
function copyFileOrSymlink(src: string, dest: string): void {
  const stat = fs.lstatSync(src);

  if (stat.isSymbolicLink()) {
    // For symlinks, read the link target and recreate the symlink
    const linkTarget = fs.readlinkSync(src);

    // Remove existing file/symlink at destination if it exists
    // Use try/catch since lstatSync throws if path doesn't exist
    try {
      fs.lstatSync(dest);
      fs.unlinkSync(dest);
    } catch {
      // Destination doesn't exist, which is fine
    }

    fs.symlinkSync(linkTarget, dest);
  } else {
    // Regular file - use standard copy
    fs.copyFileSync(src, dest);
  }
}

/**
 * Apply sync changes based on mode and conflict resolutions
 */
export async function syncFiles(
  context: SyncContext,
  analysis: AnalysisResult,
  mode: SyncMode,
  conflictResolutions?: ConflictResolutionMap
): Promise<SyncResult> {
  const result: SyncResult = {
    autoMerged: [],
    conflicts: [],
    projectOnlyChanges: analysis.projectOnlyChanges.map(c => c.path),
    skipped: [...analysis.skipped],
    errors: [],
  };

  if (mode === 'none') {
    if (!context.options.json) {
      console.log('\n❌ Cancelled. No changes applied.');
    }
    return result;
  }

  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);

  // Apply safe changes
  if (!context.options.json) {
    console.log(`\n🔄 Applying safe changes (${analysis.safeChanges.length} files)...\n`);
  }

  for (const change of analysis.safeChanges) {
    const templateFilePath = path.join(templatePath, change.path);
    const projectFilePath = path.join(context.projectRoot, change.path);

    try {
      // Special handling for package.json with auto-merge
      if (change.path === 'package.json' && analysis.packageJsonMerge?.success && analysis.packageJsonMerge.merged) {
        let mergeResult = analysis.packageJsonMerge;

        // If there are field conflicts, prompt user to resolve them interactively
        if (mergeResult.conflicts.length > 0 && !context.options.dryRun) {
          mergeResult = await resolveFieldConflictsInteractively(mergeResult);
        }

        if (!context.options.dryRun && mergeResult.merged) {
          // Write the merged package.json
          writePackageJson(projectFilePath, mergeResult.merged);

          // Calculate and store hash of the merged content
          const mergedContent = JSON.stringify(mergeResult.merged, null, 2) + '\n';
          const hash = crypto.createHash('md5').update(mergedContent).digest('hex');
          storeFileHash(context.config, change.path, hash);
        }

        // Display merge summary
        console.log('  📦 package.json - auto-merged');
        console.log(formatMergeSummary(mergeResult));

        if (mergeResult.conflicts.length > 0) {
          console.log(formatConflictMessage(mergeResult.conflicts));
        }

        result.autoMerged.push(change.path);
      } else {
        // Standard file copy for all other files
        if (!context.options.dryRun) {
          const dir = path.dirname(projectFilePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          copyFileOrSymlink(templateFilePath, projectFilePath);

          // Store the hash of the synced file for future comparison
          const hash = getFileHash(templateFilePath);
          storeFileHash(context.config, change.path, hash);
        }
        result.autoMerged.push(change.path);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${change.path}: ${message}`);
    }
  }

  // Handle conflicts based on mode and resolutions
  if (mode === 'all' && analysis.conflictChanges.length > 0) {
    console.log(`\n🔄 Processing conflicts (${analysis.conflictChanges.length} files)...\n`);

    for (const change of analysis.conflictChanges) {
      const templateFilePath = path.join(templatePath, change.path);
      const projectFilePath = path.join(context.projectRoot, change.path);
      const resolution = conflictResolutions?.[change.path] || 'merge';

      try {
        switch (resolution) {
          case 'override':
            // Replace project file with template version
            if (!context.options.dryRun) {
              const dir = path.dirname(projectFilePath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              copyFileOrSymlink(templateFilePath, projectFilePath);

              // Store the hash of the synced file for future comparison
              const hash = getFileHash(templateFilePath);
              storeFileHash(context.config, change.path, hash);
            }
            result.autoMerged.push(change.path);
            break;

          case 'skip':
            // Keep project version, add to skipped
            // Store the TEMPLATE file hash as the baseline - this indicates
            // "I've acknowledged these template changes and chose to keep my version"
            // Next sync: if template unchanged, file shows as project-only (no conflict)
            // Next sync: if template changed again, it will be a proper conflict
            if (!context.options.dryRun) {
              const hash = getFileHash(templateFilePath);
              storeFileHash(context.config, change.path, hash);
            }
            result.skipped.push(change.path);
            break;

          case 'merge':
            // Save template version for manual merge (original behavior)
            result.conflicts.push(change.path);
            if (!context.options.dryRun) {
              copyFileOrSymlink(templateFilePath, projectFilePath + '.template');
              // Don't update hash - let user merge and it will be handled next sync
            }
            break;

          case 'nothing':
            // Leave file unchanged, don't add to any list
            // Don't update hash either - preserve current state
            break;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`${change.path}: ${message}`);
      }
    }
  }

  return result;
}

// ============================================================================
// Folder Ownership Sync Operations (New Model)
// ============================================================================

/**
 * Result of folder ownership sync
 */
export interface FolderSyncResult {
  copied: string[];
  deleted: string[];
  merged: string[];
  skipped: string[];
  conflicts: string[];
  errors: string[];
}

/**
 * Delete a file from the project
 */
export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);

    // Clean up empty parent directories
    let dir = path.dirname(filePath);
    while (dir !== '.' && dir !== '/') {
      try {
        const entries = fs.readdirSync(dir);
        if (entries.length === 0) {
          fs.rmdirSync(dir);
          dir = path.dirname(dir);
        } else {
          break;
        }
      } catch {
        break;
      }
    }
  }
}

/**
 * Apply folder ownership sync based on analysis
 */
export async function syncFolderOwnership(
  analysis: FolderSyncAnalysis,
  config: FolderOwnershipConfig,
  projectDir: string,
  templateDir: string,
  options: {
    dryRun?: boolean;
    quiet?: boolean;
    conflictResolutions?: Map<string, ConflictResolution>;
  } = {}
): Promise<FolderSyncResult> {
  const result: FolderSyncResult = {
    copied: [],
    deleted: [],
    merged: [],
    skipped: [],
    conflicts: [],
    errors: [],
  };

  const { dryRun = false, quiet = false, conflictResolutions } = options;

  // 1. Copy files from template
  for (const file of analysis.toCopy) {
    const templatePath = path.join(templateDir, file.path);
    const projectPath = path.join(projectDir, file.path);

    try {
      if (!dryRun) {
        const dir = path.dirname(projectPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        copyFileOrSymlink(templatePath, projectPath);
      }

      result.copied.push(file.path);
      if (!quiet) {
        console.log(`  ${file.inProject ? '📝' : '✨'} ${file.path}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${file.path}: ${message}`);
    }
  }

  // 2. Delete files not in template
  for (const file of analysis.toDelete) {
    const projectPath = path.join(projectDir, file.path);

    try {
      if (!dryRun) {
        deleteFile(projectPath);
      }

      result.deleted.push(file.path);
      if (!quiet) {
        console.log(`  🗑️  ${file.path}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${file.path}: ${message}`);
    }
  }

  // 3. Handle 3-way merges (package.json)
  for (const file of analysis.toMerge) {
    if (file.path === 'package.json') {
      try {
        const templatePath = path.join(templateDir, 'package.json');
        const projectPath = path.join(projectDir, 'package.json');

        // Check if both files exist
        if (!fs.existsSync(templatePath) || !fs.existsSync(projectPath)) {
          // If only one exists, treat as copy or skip
          if (fs.existsSync(templatePath)) {
            if (!dryRun) {
              copyFileOrSymlink(templatePath, projectPath);
            }
            result.copied.push(file.path);
          } else {
            result.skipped.push(file.path);
          }
          continue;
        }

        // Perform 3-way merge
        const templatePkg = readPackageJson(templatePath);
        const projectPkg = readPackageJson(projectPath);

        if (!templatePkg || !projectPkg) {
          result.errors.push('package.json: Unable to read template or project package.json');
          continue;
        }

        // For folder ownership, we don't have a base - use null for 2-way merge
        const mergeResult = mergePackageJson(null, templatePkg, projectPkg);

        if (mergeResult.success && mergeResult.merged) {
          if (!dryRun) {
            writePackageJson(projectPath, mergeResult.merged);
          }
          result.merged.push(file.path);
          if (!quiet) {
            console.log(`  🔀 ${file.path} - merged`);
            console.log(formatMergeSummary(mergeResult));
          }
        } else {
          result.conflicts.push(file.path);
          if (!quiet) {
            console.log(`  ⚠️  ${file.path} - merge conflict`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`${file.path}: ${message}`);
      }
    }
  }

  // 4. Handle conflicts
  for (const file of analysis.conflicts) {
    const resolution = conflictResolutions?.get(file.path);

    if (resolution === 'override') {
      // Use template version
      const templatePath = path.join(templateDir, file.path);
      const projectPath = path.join(projectDir, file.path);

      try {
        if (!dryRun && fs.existsSync(templatePath)) {
          const dir = path.dirname(projectPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          copyFileOrSymlink(templatePath, projectPath);

          // Update override hash since we're now using template version
          if (!config.overrideHashes) {
            config.overrideHashes = {};
          }
          config.overrideHashes[file.path] = getFileHash(templatePath);

          // Remove from projectOverrides since we're now using template version
          const idx = config.projectOverrides.indexOf(file.path);
          if (idx !== -1) {
            config.projectOverrides.splice(idx, 1);
          }
        }
        result.copied.push(file.path);
        if (!quiet) {
          console.log(`  ✅ ${file.path} - override with template`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`${file.path}: ${message}`);
      }
    } else if (resolution === 'skip') {
      // Keep project version, update baseline hash
      const templatePath = path.join(templateDir, file.path);

      if (!dryRun && fs.existsSync(templatePath)) {
        if (!config.overrideHashes) {
          config.overrideHashes = {};
        }
        config.overrideHashes[file.path] = getFileHash(templatePath);
      }

      result.skipped.push(file.path);
      if (!quiet) {
        console.log(`  ⏭️  ${file.path} - keep project version`);
      }
    } else {
      // Unresolved conflict
      result.conflicts.push(file.path);
      if (!quiet) {
        console.log(`  ⚠️  ${file.path} - ${file.reason}`);
      }
    }
  }

  // 5. Log skipped files
  for (const file of analysis.toSkip) {
    result.skipped.push(file.path);
  }

  return result;
}
