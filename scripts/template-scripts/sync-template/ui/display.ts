/**
 * Display utilities for showing diff summaries and results
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, TotalDiffSummary, TEMPLATE_DIR } from '../types';
import { getFileHash } from '../files';
import { shouldIgnore, shouldIgnoreByProjectSpecificFiles, shouldIgnoreTemplateFile } from '../files/ignore-patterns';
import { getAllFiles } from '../files/scanning';

/**
 * Generate and display a high-level summary of total differences between project and template.
 * This shows the complete picture of drift from template, regardless of when changes occurred.
 * Only counts files that exist in BOTH template and project and are different.
 */
export function displayTotalDiffSummary(context: SyncContext): TotalDiffSummary {
  const templatePath = path.join(context.projectRoot, TEMPLATE_DIR);

  // Get all files including ignored ones for complete picture
  const templateFiles = getAllFiles(context.config, templatePath, templatePath, true);
  const projectFiles = getAllFiles(context.config, context.projectRoot, context.projectRoot, true);

  const allFiles = Array.from(new Set([...templateFiles, ...projectFiles]));

  // Categorize all differences
  const summary: TotalDiffSummary = {
    newInTemplate: [],        // In template, not in project (not ignored/project-specific)
    modified: [],             // Different content (not ignored/project-specific)
    identical: 0,             // Same content
    ignoredDiffs: [],         // Different AND in both AND matches ignored pattern
    projectSpecificDiffs: [], // Different AND in both AND matches project-specific pattern
  };

  for (const file of allFiles) {
    // Skip template-ignored files completely (example/demo code)
    if (shouldIgnoreTemplateFile(context.config, file)) {
      continue;
    }

    const templateFilePath = path.join(templatePath, file);
    const projectFilePath = path.join(context.projectRoot, file);

    const inTemplate = fs.existsSync(templateFilePath);
    const inProject = fs.existsSync(projectFilePath);

    const isIgnored = shouldIgnore(context.config, file);
    const isProjectSpecific = shouldIgnoreByProjectSpecificFiles(context.config, file);

    if (inTemplate && !inProject) {
      // New in template - only count if NOT ignored/project-specific
      if (!isIgnored && !isProjectSpecific) {
        summary.newInTemplate.push(file);
      }
      // If ignored or project-specific and missing from project, don't count it
    } else if (inProject && !inTemplate) {
      // Project-only file (not in template) - don't count these at all
      // These are project additions, not template drift
    } else if (inTemplate && inProject) {
      // Both exist - check if different
      const templateHash = getFileHash(templateFilePath);
      const projectHash = getFileHash(projectFilePath);

      if (templateHash !== projectHash) {
        // Only count ignored/project-specific if they exist in BOTH and are different
        if (isIgnored) {
          summary.ignoredDiffs.push(file);
        } else if (isProjectSpecific) {
          summary.projectSpecificDiffs.push(file);
        } else {
          summary.modified.push(file);
        }
      } else {
        summary.identical++;
      }
    }
  }

  // Store in context for later use
  context.totalDiffSummary = summary;

  // Calculate totals (only files that represent drift from template)
  const totalDiffs = summary.newInTemplate.length +
                     summary.modified.length +
                     summary.ignoredDiffs.length +
                     summary.projectSpecificDiffs.length;

  // Display summary
  console.log('\n' + '─'.repeat(60));
  console.log('📊 TOTAL PROJECT DRIFT FROM TEMPLATE');
  console.log('─'.repeat(60));

  if (totalDiffs === 0) {
    console.log('\n✅ Project is identical to template!');
  } else {
    console.log('\n📈 Summary of all differences:\n');

    // Build a table-like display
    const rows: Array<[string, number, string]> = [];

    if (summary.newInTemplate.length > 0) {
      rows.push(['New in template (missing locally)', summary.newInTemplate.length, '🆕']);
    }
    if (summary.modified.length > 0) {
      rows.push(['Modified (different from template)', summary.modified.length, '📝']);
    }
    if (summary.projectSpecificDiffs.length > 0) {
      rows.push(['Project-specific (in config)', summary.projectSpecificDiffs.length, '⚙️']);
    }
    if (summary.ignoredDiffs.length > 0) {
      rows.push(['Ignored (in config)', summary.ignoredDiffs.length, '🚫']);
    }

    // Calculate max width for alignment
    const maxLabelWidth = Math.max(...rows.map(r => r[0].length));

    for (const [label, count, icon] of rows) {
      const paddedLabel = label.padEnd(maxLabelWidth);
      console.log(`   ${icon} ${paddedLabel}  ${count}`);
    }

    console.log('   ' + '─'.repeat(maxLabelWidth + 8));
    console.log(`   📊 ${'Total differences'.padEnd(maxLabelWidth)}  ${totalDiffs}`);
    console.log(`   ✅ ${'Identical files'.padEnd(maxLabelWidth)}  ${summary.identical}`);

    console.log('\n   💡 Use --show-drift to see full file list');
  }

  console.log('─'.repeat(60));

  return summary;
}

/**
 * Display the full list of files for each category in the total diff summary.
 */
export function displayTotalDiffDetails(summary: TotalDiffSummary | null): void {
  if (!summary) {
    console.log('No diff summary available.');
    return;
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📋 DETAILED FILE LIST');
  console.log('═'.repeat(60));

  if (summary.newInTemplate.length > 0) {
    console.log(`\n🆕 New in template (${summary.newInTemplate.length} files):`);
    console.log('   Files that exist in template but not in your project:');
    summary.newInTemplate.forEach(f => console.log(`   • ${f}`));
  }

  if (summary.modified.length > 0) {
    console.log(`\n📝 Modified (${summary.modified.length} files):`);
    console.log('   Files that differ from the template:');
    summary.modified.forEach(f => console.log(`   • ${f}`));
  }

  if (summary.projectSpecificDiffs.length > 0) {
    console.log(`\n⚙️  Project-specific (${summary.projectSpecificDiffs.length} files):`);
    console.log('   Files matching projectSpecificFiles patterns that differ:');
    summary.projectSpecificDiffs.forEach(f => console.log(`   • ${f}`));
  }

  if (summary.ignoredDiffs.length > 0) {
    console.log(`\n🚫 Ignored (${summary.ignoredDiffs.length} files):`);
    console.log('   Files matching ignoredFiles patterns that differ:');
    summary.ignoredDiffs.forEach(f => console.log(`   • ${f}`));
  }

  console.log('\n' + '═'.repeat(60));
}
