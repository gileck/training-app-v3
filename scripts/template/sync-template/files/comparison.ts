/**
 * File comparison utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, FileChange, ChangeStatus, TEMPLATE_DIR } from '../types';
import { getFileHash, getStoredHash, getTemplateFileHash, getProjectFileHash } from './hashing';
import { shouldIgnoreTemplateFile } from './ignore-patterns';
import { getAllFiles } from './scanning';

/**
 * Compare files between template and project
 */
export function compareFiles(context: SyncContext, includeIgnored: boolean = false): FileChange[] {
  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
  const templateFiles = getAllFiles(context.config, templatePath, templatePath, includeIgnored);
  const projectFiles = getAllFiles(context.config, context.projectRoot, context.projectRoot, includeIgnored);

  const allFiles = Array.from(new Set([...templateFiles, ...projectFiles]));
  const changes: FileChange[] = [];

  for (const file of allFiles) {
    // Skip template-ignored files (example/demo code that should never sync)
    if (shouldIgnoreTemplateFile(context.config, file)) {
      continue;
    }

    const templateFilePath = path.join(templatePath, file);
    const projectFilePath = path.join(context.projectRoot, file);

    const inTemplate = fs.existsSync(templateFilePath);
    const inProject = fs.existsSync(projectFilePath);

    if (!inProject && inTemplate) {
      // New file in template
      changes.push({
        path: file,
        status: 'added',
        inTemplate: true,
        inProject: false,
      });
    } else if (inProject && !inTemplate) {
      // File removed from template (keep in project)
      continue;
    } else if (inProject && inTemplate) {
      // File exists in both - check if different
      const templateHash = getFileHash(templateFilePath);
      const projectHash = getFileHash(projectFilePath);

      if (templateHash !== projectHash) {
        changes.push({
          path: file,
          status: 'modified',
          inTemplate: true,
          inProject: true,
        });
      }
    }
  }

  return changes;
}

/**
 * Determine change status for a file using hash-based comparison.
 * Returns { projectChanged, templateChanged } based on comparing current hashes to stored sync hash.
 */
export function getChangeStatus(context: SyncContext, filePath: string): ChangeStatus {
  const storedHash = getStoredHash(context.config, filePath);

  if (!storedHash) {
    // No baseline - first sync or file was never synced
    // We can't determine who changed what
    return { projectChanged: false, templateChanged: false, hasBaseline: false };
  }

  const projectHash = getProjectFileHash(context.projectRoot, filePath);
  const templateHash = getTemplateFileHash(context.projectRoot, filePath);

  return {
    projectChanged: projectHash !== storedHash,
    templateChanged: templateHash !== storedHash,
    hasBaseline: true,
  };
}

/**
 * Check if a file has changed in the project since the last sync.
 * Uses hash-based comparison against the stored sync baseline.
 */
export function hasProjectChanges(context: SyncContext, filePath: string): boolean {
  const storedHash = getStoredHash(context.config, filePath);

  if (!storedHash) {
    // No baseline - we can't determine if project changed
    // For safety, we'll check if the file differs from template
    // If it does and there's no baseline, treat as project change
    const projectHash = getProjectFileHash(context.projectRoot, filePath);
    const templateHash = getTemplateFileHash(context.projectRoot, filePath);
    return projectHash !== templateHash;  // If different and no baseline, assume project changed
  }

  const projectHash = getProjectFileHash(context.projectRoot, filePath);
  return projectHash !== storedHash;
}

/**
 * Check if a file has changed in the template since the last sync.
 * Uses hash-based comparison against the stored sync baseline.
 */
export function hasTemplateChanges(context: SyncContext, filePath: string): boolean {
  const storedHash = getStoredHash(context.config, filePath);

  if (!storedHash) {
    // No baseline - assume template changed (first sync or untracked file)
    return true;
  }

  const templateHash = getTemplateFileHash(context.projectRoot, filePath);
  return templateHash !== storedHash;
}
