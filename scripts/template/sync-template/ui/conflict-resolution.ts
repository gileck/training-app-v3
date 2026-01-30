/**
 * Conflict resolution UI utilities
 */

import * as readline from 'readline';
import * as path from 'path';
import { SyncContext, FileChange, ConflictResolution, ConflictResolutionMap } from '../types';
import { select, isInteractive, SelectOption } from '../../cli-utils';
import { isAgentAvailable, getFileDiffSummary, getAIDescription, getLocalDiff } from '../analysis';
import {
  promptConflictResolutionMode,
  promptBulkConflictResolution,
  getConflictResolutionOptions,
  printConflictResolutionOptions,
  parseConflictResolution,
} from './prompts';

/**
 * Prompt user for individual conflict resolution for each file
 */
export async function promptIndividualConflictResolution(
  context: SyncContext,
  conflicts: FileChange[],
  rl: readline.Interface
): Promise<ConflictResolutionMap> {
  const resolutions: ConflictResolutionMap = {};
  const aiAvailable = isAgentAvailable();
  const interactive = isInteractive();

  console.log('\n📋 Choose an action for each conflicting file:\n');

  if (aiAvailable) {
    console.log('🤖 AI descriptions enabled (cursor-agent detected)\n');
  }

  const options = getConflictResolutionOptions();

  for (let i = 0; i < conflicts.length; i++) {
    const file = conflicts[i];
    console.log('─'.repeat(60));
    console.log(`\n📄 File ${i + 1} of ${conflicts.length}: \x1b[1m${file.path}\x1b[0m`);

    // Show diff preview
    const diffSummary = getFileDiffSummary(context, file.path);
    if (diffSummary.added > 0 || diffSummary.removed > 0) {
      console.log(`\n   📊 Template changes: \x1b[32m+${diffSummary.added}\x1b[0m lines, \x1b[31m-${diffSummary.removed}\x1b[0m lines`);

      // Get AI descriptions if available
      if (aiAvailable && diffSummary.diff) {
        console.log('   🤖 Analyzing changes...');

        const [templateDesc, localDesc] = await Promise.all([
          getAIDescription(diffSummary.diff, `Template changes to ${file.path}`),
          getAIDescription(getLocalDiff(context, file.path), `Your local changes to ${file.path}`),
        ]);

        // Clear the "Analyzing..." line and show descriptions
        process.stdout.write('\x1b[1A\x1b[2K'); // Move up and clear line

        if (templateDesc) {
          console.log(`   📝 Template: ${templateDesc}`);
        }
        if (localDesc) {
          console.log(`   📝 Your changes: ${localDesc}`);
        }
      }

      if (diffSummary.preview.length > 0 && !aiAvailable) {
        console.log('   Preview:');
        diffSummary.preview.forEach(line => {
          const color = line.startsWith('+') ? '\x1b[32m' : '\x1b[31m';
          console.log(`   ${color}${line}\x1b[0m`);
        });
        if (diffSummary.added + diffSummary.removed > 5) {
          console.log(`   ... and ${diffSummary.added + diffSummary.removed - 5} more changes`);
        }
      }
    }

    let resolution: ConflictResolution;

    if (interactive) {
      const result = await select(`Choose action for ${path.basename(file.path)}:`, options);
      resolution = result ?? 'nothing';
    } else {
      printConflictResolutionOptions();
      resolution = await new Promise<ConflictResolution>((resolve) => {
        rl.question(`Action for ${file.path} (1/2/3/4): `, (answer) => {
          const res = parseConflictResolution(answer);
          resolve(res ?? 'nothing');
        });
      });
    }

    resolutions[file.path] = resolution;
  }

  return resolutions;
}

/**
 * Handle conflict resolution (determines mode and collects resolutions)
 */
export async function handleConflictResolution(
  context: SyncContext,
  conflicts: FileChange[],
  rl: readline.Interface
): Promise<ConflictResolutionMap> {
  if (conflicts.length === 0) {
    return {};
  }

  // Show list of conflicting files
  console.log('\n' + '='.repeat(60));
  console.log('📋 FILES WITH POTENTIAL CONFLICTS');
  console.log('='.repeat(60));
  console.log('\nThese files have changes in both your project AND the template:\n');
  conflicts.forEach((f, i) => console.log(`  ${i + 1}. ${f.path}`));

  // Ask user how they want to handle conflicts
  const mode = await promptConflictResolutionMode(conflicts.length, rl);

  if (mode === 'bulk') {
    const resolution = await promptBulkConflictResolution(rl);
    const resolutions: ConflictResolutionMap = {};
    for (const conflict of conflicts) {
      resolutions[conflict.path] = resolution;
    }
    return resolutions;
  } else {
    return promptIndividualConflictResolution(context, conflicts, rl);
  }
}

/**
 * Print summary of conflict resolutions
 */
export function printConflictResolutionSummary(resolutions: ConflictResolutionMap): void {
  const counts = {
    override: 0,
    skip: 0,
    merge: 0,
    nothing: 0,
  };

  for (const resolution of Object.values(resolutions)) {
    counts[resolution]++;
  }

  console.log('\n' + '─'.repeat(60));
  console.log('📊 CONFLICT RESOLUTION SUMMARY');
  console.log('─'.repeat(60));

  if (counts.override > 0) {
    console.log(`\n🔄 Override with template (${counts.override} files):`);
    Object.entries(resolutions)
      .filter(([, r]) => r === 'override')
      .forEach(([filePath]) => console.log(`   • ${filePath}`));
  }

  if (counts.skip > 0) {
    console.log(`\n⏭️  Skip (${counts.skip} files):`);
    Object.entries(resolutions)
      .filter(([, r]) => r === 'skip')
      .forEach(([filePath]) => console.log(`   • ${filePath}`));
  }

  if (counts.merge > 0) {
    console.log(`\n🔀 Merge (${counts.merge} files):`);
    Object.entries(resolutions)
      .filter(([, r]) => r === 'merge')
      .forEach(([filePath]) => console.log(`   • ${filePath}`));
  }

  if (counts.nothing > 0) {
    console.log(`\n⏸️  Do nothing (${counts.nothing} files):`);
    Object.entries(resolutions)
      .filter(([, r]) => r === 'nothing')
      .forEach(([filePath]) => console.log(`   • ${filePath}`));
  }

  console.log('');
}
