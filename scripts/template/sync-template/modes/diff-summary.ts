/**
 * Diff summary mode - generate full diff summary file
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, FileChange, TEMPLATE_DIR, DIFF_SUMMARY_FILE } from '../types';
import { exec } from '../utils';
import { cloneTemplate, cleanupTemplate } from '../git';
import { compareFiles, shouldIgnore, shouldIgnoreByProjectSpecificFiles } from '../files';
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

    // Compare files - include ignored files unless --skip-ignored or --modified-only is set
    const includeIgnored = !context.options.skipIgnored && !context.options.modifiedOnly;
    if (context.options.modifiedOnly) {
      console.log('🔍 Comparing template with project (modified files only)...');
    } else if (includeIgnored) {
      console.log('🔍 Comparing template with project (including ignored files)...');
    } else {
      console.log('🔍 Comparing template with project (skipping ignored files)...');
    }
    const changes = compareFiles(context, includeIgnored);

    if (changes.length === 0) {
      console.log('✅ No differences found. Your project matches the template!');
      return;
    }

    // Build the diff summary - simple categorization by file status and ignore patterns
    const lines: string[] = [];
    lines.push('# Template Diff Summary');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Template: ${context.config.templateRepo}`);
    lines.push(`Template Commit: ${templateCommit}`);
    if (context.options.modifiedOnly) {
      lines.push('Mode: Modified files only (new, ignored, and project-specific files excluded)');
    } else if (!includeIgnored) {
      lines.push('Note: Ignored files were excluded (--skip-ignored)');
    }
    lines.push('');
    lines.push('This file shows differences between the template and your current project.');
    lines.push('');
    lines.push('---');
    lines.push('');

    // Simple categorization: new files, modified files, ignored files
    const newFiles: FileChange[] = [];
    const modifiedFiles: FileChange[] = [];
    const ignoredFiles: FileChange[] = [];

    for (const change of changes) {
      // Check if file is in ignore list (ignoredFiles or projectSpecificFiles)
      if (shouldIgnore(context.config, change.path) || shouldIgnoreByProjectSpecificFiles(context.config, change.path)) {
        ignoredFiles.push(change);
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
    if (includeIgnored) {
      lines.push(`- **Ignored** (in ignore list): ${ignoredFiles.length} files`);
    }
    if (context.options.modifiedOnly) {
      lines.push(`- **Total**: ${modifiedFiles.length} modified files`);
    } else {
      lines.push(`- **Total differences**: ${newFiles.length + modifiedFiles.length + (includeIgnored ? ignoredFiles.length : 0)} files`);
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

    if (includeIgnored && ignoredFiles.length > 0) {
      lines.push('### Ignored Files (In Ignore List)');
      ignoredFiles.forEach((c, i) => {
        const anchor = `ignored-${c.path.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
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
    if (includeIgnored) {
      addDiffSection('Ignored Files (In Ignore List)', ignoredFiles, 'ignored');
    }

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
    if (includeIgnored) {
      console.log(`   • Ignored: ${ignoredFiles.length} files`);
    }
    if (context.options.modifiedOnly) {
      console.log(`   • Total: ${modifiedFiles.length} modified files`);
    } else {
      console.log(`   • Total: ${newFiles.length + modifiedFiles.length + (includeIgnored ? ignoredFiles.length : 0)} files`);
    }
    console.log('\n💡 Run "yarn sync-template" to see which changes can be safely applied.');
    if (context.options.modifiedOnly) {
      console.log('   Note: Showing modified files only. Remove --modified-only to see all changes.');
    } else if (!includeIgnored) {
      console.log('   Note: Ignored files were excluded. Remove --skip-ignored to include them.');
    }

  } finally {
    cleanupTemplate(context);
  }
}
