/**
 * File sync operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, SyncMode, AnalysisResult, SyncResult, ConflictResolutionMap, TEMPLATE_DIR } from '../types';
import { getFileHash, storeFileHash } from '../files';

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
    console.log('\n❌ Cancelled. No changes applied.');
    return result;
  }

  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);

  // Apply safe changes
  console.log(`\n🔄 Applying safe changes (${analysis.safeChanges.length} files)...\n`);

  for (const change of analysis.safeChanges) {
    const templateFilePath = path.join(templatePath, change.path);
    const projectFilePath = path.join(context.projectRoot, change.path);

    try {
      if (!context.options.dryRun) {
        const dir = path.dirname(projectFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.copyFileSync(templateFilePath, projectFilePath);

        // Store the hash of the synced file for future comparison
        const hash = getFileHash(templateFilePath);
        storeFileHash(context.config, change.path, hash);
      }
      result.autoMerged.push(change.path);
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
              fs.copyFileSync(templateFilePath, projectFilePath);

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
              fs.copyFileSync(templateFilePath, projectFilePath + '.template');
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
