/**
 * Project diffs mode - show diffs for files that differ between project and template
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, TEMPLATE_DIR } from '../types';
import { exec } from '../utils';
import { cloneTemplate, cleanupTemplate } from '../git';
import { getAllFiles, getFileHash, getChangeStatus } from '../files';
import { shouldIgnoreTemplateFile, matchesTemplatePaths } from '../files/ignore-patterns';

/**
 * Run project-diffs mode - show diffs for files that differ between project and template.
 * Designed for the contribute-to-template command to easily find what changed.
 *
 * Output format (easy for agent to parse):
 * ════════════════════════════════════════════════════════════════
 * FILE: path/to/file.ts
 * STATUS: project-only | template-only | both-changed | no-baseline
 * ════════════════════════════════════════════════════════════════
 * [diff content]
 */
export async function runProjectDiffs(context: SyncContext): Promise<void> {
  // Clone template to compare
  cloneTemplate(context);

  try {
    const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
    const templateCommit = exec('git rev-parse HEAD', context.projectRoot, {
      cwd: templatePath,
      silent: true,
    });

    console.log(`# Project Diffs Report`);
    console.log(`# Template commit: ${templateCommit}`);
    console.log(`# Generated: ${new Date().toISOString()}`);
    console.log('');

    // Get all files from template
    const templateFiles = getAllFiles(templatePath);

    // Find files that exist in both and might differ
    const filesToCheck = templateFiles.filter(file => {
      // Must exist in project
      const projectFilePath = path.join(context.projectRoot, file);
      if (!fs.existsSync(projectFilePath)) return false;

      // Skip template-ignored files
      if (shouldIgnoreTemplateFile(context.config, file)) return false;

      // Only check files in templatePaths
      if (!matchesTemplatePaths(context.config, file)) return false;

      return true;
    });

    // Check each file for differences
    const diffs: Array<{
      path: string;
      status: 'project-only' | 'template-only' | 'both-changed' | 'no-baseline' | 'identical';
      diff: string;
    }> = [];

    for (const file of filesToCheck) {
      const templateFilePath = path.join(templatePath, file);
      const projectFilePath = path.join(context.projectRoot, file);

      const templateHash = getFileHash(templateFilePath);
      const projectHash = getFileHash(projectFilePath);

      // Skip identical files
      if (templateHash === projectHash) continue;

      // Determine change status
      const changeStatus = getChangeStatus(context, file);
      let status: 'project-only' | 'template-only' | 'both-changed' | 'no-baseline';

      if (!changeStatus.hasBaseline) {
        status = 'no-baseline';
      } else if (changeStatus.projectChanged && changeStatus.templateChanged) {
        status = 'both-changed';
      } else if (changeStatus.projectChanged) {
        status = 'project-only';
      } else {
        status = 'template-only';
      }

      // Generate diff (project vs template)
      let diff = '';
      try {
        diff = exec(
          `diff -u "${templateFilePath}" "${projectFilePath}" || true`,
          context.projectRoot,
          { silent: true }
        );
        // Clean up diff header paths for readability
        diff = diff
          .replace(templateFilePath, `a/${file} (template)`)
          .replace(projectFilePath, `b/${file} (project)`);
      } catch {
        diff = '(unable to generate diff)';
      }

      diffs.push({ path: file, status, diff });
    }

    // Output results
    console.log(`# Found ${diffs.length} files with differences`);
    console.log('');

    // Summary by status
    const byStatus = {
      'project-only': diffs.filter(d => d.status === 'project-only'),
      'template-only': diffs.filter(d => d.status === 'template-only'),
      'both-changed': diffs.filter(d => d.status === 'both-changed'),
      'no-baseline': diffs.filter(d => d.status === 'no-baseline'),
    };

    console.log('## Summary');
    console.log(`- Project-only changes: ${byStatus['project-only'].length} files`);
    console.log(`- Template-only changes: ${byStatus['template-only'].length} files`);
    console.log(`- Both changed: ${byStatus['both-changed'].length} files`);
    console.log(`- No baseline: ${byStatus['no-baseline'].length} files`);
    console.log('');

    // Output each diff
    for (const { path: filePath, status, diff } of diffs) {
      console.log('═'.repeat(70));
      console.log(`FILE: ${filePath}`);
      console.log(`STATUS: ${status}`);
      console.log('═'.repeat(70));
      console.log(diff);
      console.log('');
    }

    console.log('# End of report');

  } finally {
    cleanupTemplate(context);
  }
}
