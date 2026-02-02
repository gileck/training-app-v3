/**
 * Diff summary mode - generate full diff summary file
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, FileChange, TEMPLATE_DIR, DIFF_SUMMARY_FILE } from '../types';
import { exec } from '../utils';
import { cloneTemplate, cleanupTemplate } from '../git';
import { compareFiles, isProjectOverride, matchesTemplatePaths } from '../files';
import { generateFileDiff } from '../analysis';
import { displayTotalDiffSummary } from '../ui';

/**
 * Run diff-summary mode - generate full diff summary file
 */
export async function runDiffSummary(context: SyncContext): Promise<void> {
  console.log('📋 Generating Full Diff Summary');
  console.log('='.repeat(60));

  // Clone template
  cloneTemplate(context);

  try {
    // Get template commit
    const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);
    const templateCommit = exec('git rev-parse HEAD', context.projectRoot, {
      cwd: templatePath,
      silent: true,
    });

    console.log(`📍 Template commit: ${templateCommit}`);

    // Show total diff summary
    displayTotalDiffSummary(context);

    console.log('');

    // Compare files
    if (context.options.modifiedOnly) {
      console.log('🔍 Comparing template with project (modified files only)...');
    } else {
      console.log('🔍 Comparing template with project...');
    }
    const changes = compareFiles(context);

    if (changes.length === 0) {
      console.log('✅ No differences found. Your project matches the template!');
      return;
    }

    // Build the diff summary - categorize by file status
    const lines: string[] = [];
    lines.push('# Template Diff Summary');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Template: ${context.config.templateRepo}`);
    lines.push(`Template Commit: ${templateCommit}`);
    if (context.options.modifiedOnly) {
      lines.push('Mode: Modified files only (new files excluded)');
    }
    lines.push('');
    lines.push('This file shows differences between the template and your current project.');
    lines.push('');
    lines.push('---');
    lines.push('');

    // Categorize: new files, modified files, override files
    const newFiles: FileChange[] = [];
    const modifiedFiles: FileChange[] = [];
    const overrideFiles: FileChange[] = [];

    for (const change of changes) {
      // Check if file is a project override
      if (isProjectOverride(context.config, change.path)) {
        overrideFiles.push(change);
      } else if (change.status === 'added') {
        // Skip new files if --modified-only is set
        if (!context.options.modifiedOnly) {
          newFiles.push(change);
        }
      } else if (change.status === 'modified') {
        modifiedFiles.push(change);
      }
    }

    // Summary section
    lines.push('## Summary');
    lines.push('');
    if (!context.options.modifiedOnly) {
      lines.push(`- **New in template** (not in project): ${newFiles.length} files`);
    }
    lines.push(`- **Modified** (different from template): ${modifiedFiles.length} files`);
    lines.push(`- **Project overrides**: ${overrideFiles.length} files`);
    if (context.options.modifiedOnly) {
      lines.push(`- **Total**: ${modifiedFiles.length} modified files`);
    } else {
      lines.push(`- **Total differences**: ${newFiles.length + modifiedFiles.length + overrideFiles.length} files`);
    }
    lines.push('');

    // Table of contents
    lines.push('## Table of Contents');
    lines.push('');

    if (newFiles.length > 0) {
      lines.push('### New Files (In Template, Not In Project)');
      newFiles.forEach((c, i) => {
        const anchor = `new-${c.path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
        lines.push(`${i + 1}. [${c.path}](#${anchor})`);
      });
      lines.push('');
    }

    if (modifiedFiles.length > 0) {
      lines.push('### Modified Files (Different From Template)');
      modifiedFiles.forEach((c, i) => {
        const anchor = `mod-${c.path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
        lines.push(`${i + 1}. [${c.path}](#${anchor})`);
      });
      lines.push('');
    }

    if (overrideFiles.length > 0) {
      lines.push('### Project Override Files');
      overrideFiles.forEach((c, i) => {
        const anchor = `override-${c.path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
        lines.push(`${i + 1}. [${c.path}](#${anchor}) (${c.status})`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Generate diffs for each category
    const addDiffSection = (title: string, fileChanges: FileChange[], prefix: string) => {
      if (fileChanges.length === 0) return;

      lines.push(`## ${title}`);
      lines.push('');

      for (const change of fileChanges) {
        const anchor = `${prefix}-${change.path}`;
        lines.push(`### ${anchor}`);
        lines.push('');
        lines.push(`**Status**: ${change.status}`);
        lines.push('');
        lines.push('```diff');
        lines.push(generateFileDiff(context, change.path));
        lines.push('```');
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    };

    addDiffSection('New Files (In Template, Not In Project)', newFiles, 'new');
    addDiffSection('Modified Files (Different From Template)', modifiedFiles, 'mod');
    addDiffSection('Project Override Files', overrideFiles, 'override');

    // Write to file
    const outputPath = path.join(context.projectRoot, DIFF_SUMMARY_FILE);
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');

    console.log('\n' + '='.repeat(60));
    console.log('📊 DIFF SUMMARY GENERATED');
    console.log('='.repeat(60));
    console.log(`\n✅ Output written to: ${DIFF_SUMMARY_FILE}`);
    console.log(`\n📈 Summary:`);
    if (!context.options.modifiedOnly) {
      console.log(`   • New in template: ${newFiles.length} files`);
    }
    console.log(`   • Modified: ${modifiedFiles.length} files`);
    console.log(`   • Project overrides: ${overrideFiles.length} files`);
    if (context.options.modifiedOnly) {
      console.log(`   • Total: ${modifiedFiles.length} modified files`);
    } else {
      console.log(`   • Total: ${newFiles.length + modifiedFiles.length + overrideFiles.length} files`);
    }
    console.log('\n💡 Run "yarn sync-template" to see which changes can be safely applied.');
    if (context.options.modifiedOnly) {
      console.log('   Note: Showing modified files only. Remove --modified-only to see all changes.');
    }

  } finally {
    cleanupTemplate(context);
  }
}
