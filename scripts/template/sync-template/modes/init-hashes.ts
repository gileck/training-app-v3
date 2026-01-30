/**
 * Init hashes mode - initialize baseline hashes for all files
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, TEMPLATE_DIR } from '../types';
import { log } from '../utils/logging';
import { saveConfig } from '../utils/config';
import { exec } from '../utils';
import { cloneTemplate, cleanupTemplate } from '../git';
import { getAllFiles, getFileHash, storeFileHash } from '../files';
import { shouldIgnoreByProjectSpecificFiles, shouldIgnoreTemplateFile } from '../files/ignore-patterns';

/**
 * Initialize hashes for files that are identical between project and template.
 * This establishes a baseline for future change detection.
 * Returns the number of files initialized.
 */
export function initializeIdenticalFileHashes(context: SyncContext): number {
  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
  const templateFiles = getAllFiles(context.config, templatePath, templatePath);
  let initialized = 0;

  for (const file of templateFiles) {
    // Skip if we already have a hash for this file
    if (context.config.fileHashes?.[file]) {
      continue;
    }

    // Skip project-specific files
    if (shouldIgnoreByProjectSpecificFiles(context.config, file)) {
      continue;
    }

    // Skip template-ignored files (example/demo code)
    if (shouldIgnoreTemplateFile(context.config, file)) {
      continue;
    }

    const templateFilePath = path.join(templatePath, file);
    const projectFilePath = path.join(context.projectRoot, file);

    // Only process files that exist in both places
    if (!fs.existsSync(projectFilePath)) {
      continue;
    }

    const templateHash = getFileHash(templateFilePath);
    const projectHash = getFileHash(projectFilePath);

    // If files are identical, store the hash as baseline
    if (templateHash === projectHash) {
      storeFileHash(context.config, file, templateHash);
      initialized++;
    }
  }

  return initialized;
}

/**
 * Initialize baseline hashes for ALL template files.
 * - For identical files: store the shared hash
 * - For different files: store the TEMPLATE's hash as baseline
 *
 * This establishes "current template version is the baseline" for future syncs.
 * Use this after manually resolving differences or for projects that
 * were synced before the hash system was introduced.
 */
export function initializeAllFileHashes(context: SyncContext): { identical: number; different: number; skipped: number } {
  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
  const templateFiles = getAllFiles(context.config, templatePath, templatePath);
  const result = { identical: 0, different: 0, skipped: 0 };

  for (const file of templateFiles) {
    // Skip project-specific files
    if (shouldIgnoreByProjectSpecificFiles(context.config, file)) {
      result.skipped++;
      continue;
    }

    // Skip template-ignored files (example/demo code)
    if (shouldIgnoreTemplateFile(context.config, file)) {
      result.skipped++;
      continue;
    }

    const templateFilePath = path.join(templatePath, file);
    const projectFilePath = path.join(context.projectRoot, file);

    // Skip files that don't exist in project
    if (!fs.existsSync(projectFilePath)) {
      // New template file - store template hash so it shows as "template changed"
      // Don't store hash for files not in project - they should show as "added"
      continue;
    }

    const templateHash = getFileHash(templateFilePath);
    const projectHash = getFileHash(projectFilePath);

    if (templateHash === projectHash) {
      // Files are identical - store the shared hash
      storeFileHash(context.config, file, templateHash);
      result.identical++;
    } else {
      // Files differ - store TEMPLATE's hash as baseline
      // This establishes "current template version" as the reference point
      // So: project hash ≠ template hash → project changed (customization)
      //     template changes later → template hash ≠ stored → safe change
      storeFileHash(context.config, file, templateHash);
      result.different++;
    }
  }

  return result;
}

/**
 * Run init-hashes mode - initialize baseline hashes for all files
 */
export async function runInitHashes(context: SyncContext): Promise<void> {
  log(context.options, '🔧 Initialize Baseline Hashes');
  log(context.options, '='.repeat(60));
  log(context.options, '\nThis will establish your current project state as the baseline.');
  log(context.options, 'Future syncs will detect changes relative to this baseline.\n');

  // Clone template to compare
  cloneTemplate(context);

  try {
    const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
    const templateCommit = exec('git rev-parse HEAD', context.projectRoot, {
      cwd: templatePath,
      silent: true,
    });

    log(context.options, `📍 Template commit: ${templateCommit}`);

    // Show current state before initializing
    const existingHashes = Object.keys(context.config.fileHashes || {}).length;
    log(context.options, `📊 Existing baseline hashes: ${existingHashes}`);

    // Initialize all hashes
    log(context.options, '\n🔄 Initializing hashes...\n');
    const result = initializeAllFileHashes(context);

    // Save config
    context.config.lastSyncCommit = templateCommit;
    context.config.lastSyncDate = new Date().toISOString();
    saveConfig(context.projectRoot, context.config);

    // Print results
    log(context.options, '='.repeat(60));
    log(context.options, '📊 RESULTS');
    log(context.options, '='.repeat(60));
    log(context.options, `\n✅ Identical files (hash stored):      ${result.identical}`);
    log(context.options, `📝 Different files (template baseline): ${result.different}`);
    log(context.options, `⏭️  Skipped (ignored/project-specific):  ${result.skipped}`);
    log(context.options, `\n📦 Total hashes stored: ${Object.keys(context.config.fileHashes || {}).length}`);

    if (result.different > 0) {
      log(context.options, '\n💡 Note: For files that differ, the TEMPLATE version is the baseline.');
      log(context.options, '   These will show as "project customizations" on next sync.');
    }

    log(context.options, '\n✅ Baseline initialization complete!');
    log(context.options, '   Run "yarn sync-template" to see the new analysis.\n');

  } finally {
    cleanupTemplate(context);
  }
}
