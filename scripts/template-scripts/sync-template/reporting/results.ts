/**
 * Sync results printing and reporting
 */

import * as fs from 'fs';
import * as path from 'path';
import { SyncContext, SyncResult, SYNC_REPORT_FILE } from '../types';
import { log } from '../utils/logging';

/**
 * Print sync results to console
 */
export function printResults(context: SyncContext, result: SyncResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SYNC RESULTS');
  console.log('='.repeat(60));

  if (result.autoMerged.length > 0) {
    console.log(`\n✅ Applied successfully (${result.autoMerged.length} files):`);
    result.autoMerged.forEach(f => console.log(`   ${f}`));
  }

  if (result.conflicts.length > 0) {
    console.log(`\n🔀 Needs manual merge (${result.conflicts.length} files):`);
    result.conflicts.forEach(f => {
      console.log(`   ${f}`);
      console.log(`      → Template version saved to: ${f}.template`);
    });
  }

  if (result.projectOnlyChanges && result.projectOnlyChanges.length > 0) {
    console.log(`\n✅ Project customizations kept (${result.projectOnlyChanges.length} files):`);
    console.log('   These files were only changed in your project:');
    result.projectOnlyChanges.forEach(f => console.log(`   ${f}`));
  }

  if (result.skipped.length > 0) {
    console.log(`\n⏭️  Skipped (${result.skipped.length} files):`);
    result.skipped.forEach(f => console.log(`   ${f}`));
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ Errors (${result.errors.length}):`);
    result.errors.forEach(e => console.log(`   ${e}`));
  }

  console.log('\n' + '='.repeat(60));

  if (result.conflicts.length > 0) {
    console.log('\n💡 Next steps for manual merges:');
    console.log('   1. Review each conflict file');
    console.log('   2. Compare with the .template version');
    console.log('   3. Manually merge the changes');
    console.log('   4. Delete the .template files when done');
    console.log('   5. Commit your changes');
  }
}

/**
 * Generate a sync report file
 */
export function generateSyncReport(
  context: SyncContext,
  result: SyncResult,
  templateCommit: string,
  templateCommits: string[]
): void {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('# Template Sync Report');
  lines.push('');
  lines.push(`**Generated:** ${now}`);
  lines.push(`**Template:** ${context.config.templateRepo}`);
  lines.push(`**Template Commit:** ${templateCommit}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Files Applied | ${result.autoMerged.length} |`);
  lines.push(`| Files Needing Merge | ${result.conflicts.length} |`);
  lines.push(`| Files Skipped | ${result.skipped.length} |`);
  lines.push(`| Project Customizations Kept | ${result.projectOnlyChanges.length} |`);
  lines.push(`| Errors | ${result.errors.length} |`);
  lines.push('');

  // Template commits
  if (templateCommits.length > 0) {
    lines.push('## Template Commits Synced');
    lines.push('');
    templateCommits.forEach(c => lines.push(`- ${c}`));
    lines.push('');
  }

  // Applied files
  if (result.autoMerged.length > 0) {
    lines.push('## Files Applied');
    lines.push('');
    result.autoMerged.forEach(f => lines.push(`- \`${f}\``));
    lines.push('');
  }

  // Conflicts
  if (result.conflicts.length > 0) {
    lines.push('## Files Needing Manual Merge');
    lines.push('');
    lines.push('These files have `.template` versions that need to be manually merged:');
    lines.push('');
    result.conflicts.forEach(f => lines.push(`- \`${f}\``));
    lines.push('');
  }

  // Skipped
  if (result.skipped.length > 0) {
    lines.push('## Skipped Files');
    lines.push('');
    result.skipped.forEach(f => lines.push(`- \`${f}\``));
    lines.push('');
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    result.errors.forEach(e => lines.push(`- ${e}`));
    lines.push('');
  }

  // Write report
  const reportPath = path.join(context.projectRoot, SYNC_REPORT_FILE);
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
  log(context.options, `\n📄 Sync report saved to: ${SYNC_REPORT_FILE}`);
}
