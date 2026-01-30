/**
 * User prompting utilities
 */

import * as readline from 'readline';
import { SyncContext, SyncMode, AnalysisResult, ConflictResolution, TotalDiffSummary } from '../types';
import { select, isInteractive, SelectOption } from '../../cli-utils';
import {
  isAgentAvailable,
  getFileDiffSummary,
  formatDiffStats,
  getAIDescription,
  getConflictAnalysis,
  ConflictAnalysis,
} from '../analysis';
import { displayTotalDiffDetails } from './display';

/**
 * Prompt user for sync mode and handle menu options
 */
export async function promptUser(
  context: SyncContext,
  analysis: AnalysisResult,
  rl: readline.Interface
): Promise<SyncMode> {
  console.log('\n' + '='.repeat(60));
  console.log('📊 ANALYSIS SUMMARY');
  console.log('='.repeat(60));

  const aiAvailable = isAgentAvailable();

  // Separate safe changes into NEW and EXISTING
  const newSafeChanges = analysis.safeChanges.filter(f => analysis.newChanges.has(f.path));
  const existingSafeChanges = analysis.safeChanges.filter(f => !analysis.newChanges.has(f.path));

  // Show NEW safe changes first
  if (newSafeChanges.length > 0) {
    console.log(`\n✅ Safe changes - NEW since last sync (${newSafeChanges.length} files):`);
    console.log('   Only changed in template, no conflicts:');

    // Generate AI descriptions for safe changes if available
    if (aiAvailable && newSafeChanges.length <= 10) {
      console.log('   🤖 Generating descriptions...\n');

      // Run all descriptions in parallel for speed
      const descriptionsPromises = newSafeChanges.map(async (f) => {
        const diffSummary = getFileDiffSummary(context, f.path);
        const description = await getAIDescription(diffSummary.diff, `Template changes to ${f.path}`);
        return { path: f.path, description };
      });

      const descriptions = await Promise.all(descriptionsPromises);

      for (const { path, description } of descriptions) {
        const stats = formatDiffStats(context, path);
        if (description) {
          console.log(`   • ${path}${stats}`);
          console.log(`     📝 ${description}`);
        } else {
          console.log(`   • ${path}${stats}`);
        }
      }
    } else {
      newSafeChanges.forEach(f => {
        const stats = formatDiffStats(context, f.path);
        console.log(`   • ${f.path}${stats}`);
      });
      if (newSafeChanges.length > 10) {
        console.log('   (AI descriptions skipped for large batch)');
      }
    }
  }

  // Show EXISTING safe changes (edge case - should rarely happen with hash tracking)
  if (existingSafeChanges.length > 0) {
    console.log(`\n✅ Safe changes - existing differences (${existingSafeChanges.length} files):`);
    console.log('   Template changes (safe to apply):');
    existingSafeChanges.forEach(f => {
      const stats = formatDiffStats(context, f.path);
      console.log(`   • ${f.path}${stats}`);
    });
  }

  // Show project-only changes (user's customizations that will be kept)
  if (analysis.projectOnlyChanges.length > 0) {
    console.log(`\n✅ Project customizations (${analysis.projectOnlyChanges.length} files):`);
    console.log('   Only changed in your project (will be kept):');
    analysis.projectOnlyChanges.forEach(f => {
      const stats = formatDiffStats(context, f.path);
      console.log(`   • ${f.path}${stats}`);
    });
  }

  // Separate conflicts into NEW and EXISTING
  const newConflicts = analysis.conflictChanges.filter(f => analysis.newChanges.has(f.path));
  const existingConflicts = analysis.conflictChanges.filter(f => !analysis.newChanges.has(f.path));

  // Analyze conflicts with AI if available
  const allConflicts = [...newConflicts, ...existingConflicts];
  const conflictAnalyses: Map<string, ConflictAnalysis> = new Map();

  if (aiAvailable && allConflicts.length > 0 && allConflicts.length <= 10) {
    console.log(`\n⚠️  Conflicts (${allConflicts.length} files):`);
    console.log('   🤖 Analyzing conflicts...\n');

    // Analyze all conflicts in parallel
    const analysisPromises = allConflicts.map(async (f) => {
      const conflictAnalysis = await getConflictAnalysis(context, f.path);
      return { path: f.path, analysis: conflictAnalysis };
    });

    const results = await Promise.all(analysisPromises);
    for (const { path: filePath, analysis: conflictAnalysis } of results) {
      if (conflictAnalysis) {
        conflictAnalyses.set(filePath, conflictAnalysis);
      }
    }
  }

  if (newConflicts.length > 0) {
    console.log(`\n⚠️  Conflicts - NEW since last sync (${newConflicts.length} files):`);
    console.log('   Changed in both template and your project:');
    for (const f of newConflicts) {
      const stats = formatDiffStats(context, f.path);
      const conflictAnalysis = conflictAnalyses.get(f.path);
      console.log(`   • ${f.path}${stats}`);
      if (conflictAnalysis) {
        const difficultyColor = conflictAnalysis.difficulty === 'easy' ? '\x1b[32m' :
                                 conflictAnalysis.difficulty === 'moderate' ? '\x1b[33m' : '\x1b[31m';
        const recColor = conflictAnalysis.recommendation === 'take-template' ? '\x1b[36m' :
                         conflictAnalysis.recommendation === 'keep-project' ? '\x1b[35m' : '\x1b[33m';
        console.log(`     📝 Template: ${conflictAnalysis.templateChanges}`);
        console.log(`     📝 Project:  ${conflictAnalysis.projectChanges}`);
        console.log(`     ${difficultyColor}⚡ Difficulty: ${conflictAnalysis.difficulty}\x1b[0m | ${recColor}💡 ${conflictAnalysis.recommendation}\x1b[0m`);
      }
    }
  }

  if (existingConflicts.length > 0) {
    console.log(`\n⚠️  Conflicts - no baseline (${existingConflicts.length} files):`);
    console.log('   Files differ from template with no sync history:');
    for (const f of existingConflicts) {
      const stats = formatDiffStats(context, f.path);
      const conflictAnalysis = conflictAnalyses.get(f.path);
      console.log(`   • ${f.path}${stats}`);
      if (conflictAnalysis) {
        const difficultyColor = conflictAnalysis.difficulty === 'easy' ? '\x1b[32m' :
                                 conflictAnalysis.difficulty === 'moderate' ? '\x1b[33m' : '\x1b[31m';
        const recColor = conflictAnalysis.recommendation === 'take-template' ? '\x1b[36m' :
                         conflictAnalysis.recommendation === 'keep-project' ? '\x1b[35m' : '\x1b[33m';
        console.log(`     📝 Template: ${conflictAnalysis.templateChanges}`);
        console.log(`     📝 Project:  ${conflictAnalysis.projectChanges}`);
        console.log(`     ${difficultyColor}⚡ Difficulty: ${conflictAnalysis.difficulty}\x1b[0m | ${recColor}💡 ${conflictAnalysis.recommendation}\x1b[0m`);
      }
    }
  }

  if (analysis.skipped.length > 0) {
    console.log(`\n⏭️  Skipped (${analysis.skipped.length} files) - \x1b[90mproject-specific, press [s] to show\x1b[0m`);

    // Warning about skipped files
    console.log('\n' + '─'.repeat(60));
    console.log('⚠️  WARNING: Skipped files have template changes!');
    console.log('   These changes will NOT be applied to your project.');
    console.log('   If synced files depend on skipped file changes, your code may break.');
    console.log('─'.repeat(60));
  }

  console.log('\n' + '='.repeat(60));

  if (analysis.projectOnlyChanges.length > 0) {
    console.log('\n   ℹ️  Note: Project customizations will be kept automatically.');
  }

  // Build menu options
  type MenuOption = SyncMode | 'show-skipped' | 'show-total-diff';
  const options: SelectOption<MenuOption>[] = [
    {
      value: 'safe',
      label: 'Safe only',
      description: 'Apply only safe changes (skip conflicts)'
    },
    {
      value: 'all',
      label: 'All changes',
      description: 'Apply safe changes + choose how to handle each conflict'
    },
    {
      value: 'none',
      label: 'Cancel',
      description: "Don't apply any changes"
    },
  ];

  // Add option to show skipped files if there are any
  if (analysis.skipped.length > 0) {
    options.push({
      value: 'show-skipped',
      label: 'Show skipped files',
      description: `View the ${analysis.skipped.length} skipped project-specific files`
    });
  }

  // Add option to show total diff details if there are any differences
  if (context.totalDiffSummary) {
    const totalDiffs = context.totalDiffSummary.newInTemplate.length +
                       context.totalDiffSummary.modified.length +
                       context.totalDiffSummary.projectSpecificDiffs.length +
                       context.totalDiffSummary.ignoredDiffs.length;
    if (totalDiffs > 0) {
      options.push({
        value: 'show-total-diff',
        label: 'Show total drift details',
        description: `View all ${totalDiffs} files that differ from template`
      });
    }
  }

  // Loop to handle "show skipped" option
  while (true) {
    let result: MenuOption | null;

    if (isInteractive()) {
      result = await select('🤔 What would you like to do?', options);
    } else {
      // Fallback for non-TTY
      console.log('\n🤔 What would you like to do?\n');
      options.forEach((opt, i) => {
        console.log(`  [${i + 1}] ${opt.label} - ${opt.description}`);
      });
      console.log('');

      result = await new Promise<MenuOption | null>((resolve) => {
        rl.question(`Enter your choice (1-${options.length}): `, (answer) => {
          const index = parseInt(answer.trim()) - 1;
          if (index >= 0 && index < options.length) {
            resolve(options[index].value);
          } else {
            resolve(null);
          }
        });
      });
    }

    // Handle show skipped option
    if (result === 'show-skipped') {
      console.log('\n' + '─'.repeat(60));
      console.log(`⏭️  Skipped files (${analysis.skipped.length}):`);
      console.log('   Project-specific files (ignored):');
      analysis.skipped.forEach(f => console.log(`   • ${f}`));
      console.log('─'.repeat(60));
      continue; // Go back to menu
    }

    // Handle show total diff details option
    if (result === 'show-total-diff') {
      displayTotalDiffDetails(context.totalDiffSummary);
      continue; // Go back to menu
    }

    // Return the sync mode
    if (result === 'safe' || result === 'all' || result === 'none') {
      return result;
    }

    return 'none'; // Default if cancelled
  }
}

/**
 * Prompt user to choose conflict resolution mode (bulk vs individual)
 */
export async function promptConflictResolutionMode(
  conflictCount: number,
  rl: readline.Interface
): Promise<'bulk' | 'individual'> {
  console.log('\n' + '─'.repeat(60));
  console.log(`⚠️  CONFLICT RESOLUTION (${conflictCount} files)`);
  console.log('─'.repeat(60));

  const options: SelectOption<'bulk' | 'individual'>[] = [
    {
      value: 'bulk',
      label: 'Apply same action to all',
      description: 'Choose one action for all conflicting files'
    },
    {
      value: 'individual',
      label: 'Choose per file',
      description: 'Review and choose action for each file individually'
    },
  ];

  if (isInteractive()) {
    const result = await select('How would you like to handle conflicts?', options);
    return result ?? 'bulk';
  } else {
    console.log('\nHow would you like to handle the conflicting files?\n');
    options.forEach((opt, i) => {
      console.log(`  [${i + 1}] ${opt.label} - ${opt.description}`);
    });
    console.log('');

    return new Promise((resolve) => {
      rl.question('Enter your choice (1/2): ', (answer) => {
        resolve(answer.trim() === '2' ? 'individual' : 'bulk');
      });
    });
  }
}

/**
 * Get the conflict resolution options for select menu
 */
export function getConflictResolutionOptions(): SelectOption<ConflictResolution>[] {
  return [
    {
      value: 'override',
      label: 'Override with template',
      description: 'Replace your changes with template version'
    },
    {
      value: 'skip',
      label: 'Skip file',
      description: 'Keep your current version, ignore template'
    },
    {
      value: 'merge',
      label: 'Merge',
      description: 'Apply template changes (may cause conflicts)'
    },
    {
      value: 'nothing',
      label: 'Do nothing',
      description: 'Leave file unchanged for now'
    },
  ];
}

/**
 * Prompt user for bulk conflict resolution
 */
export async function promptBulkConflictResolution(
  rl: readline.Interface
): Promise<ConflictResolution> {
  const options = getConflictResolutionOptions();

  if (isInteractive()) {
    const result = await select('📋 Choose action for ALL conflicting files:', options);
    return result ?? 'nothing';
  } else {
    console.log('\n📋 Choose the action to apply to ALL conflicting files:');
    printConflictResolutionOptions();

    return new Promise((resolve) => {
      rl.question('Enter your choice (1/2/3/4): ', (answer) => {
        const resolution = parseConflictResolution(answer);
        resolve(resolution ?? 'nothing');
      });
    });
  }
}

/**
 * Print conflict resolution options for non-interactive mode
 */
export function printConflictResolutionOptions(): void {
  console.log('');
  console.log('  [1] Override with template - Replace your changes with template version');
  console.log('  [2] Skip file              - Keep your current version, ignore template');
  console.log('  [3] Merge                  - Apply template changes (may cause conflicts)');
  console.log('  [4] Do nothing             - Leave file unchanged for now');
  console.log('');
}

/**
 * Parse conflict resolution from user input
 */
export function parseConflictResolution(input: string): ConflictResolution | null {
  const choice = input.trim();
  switch (choice) {
    case '1': return 'override';
    case '2': return 'skip';
    case '3': return 'merge';
    case '4': return 'nothing';
    default: return null;
  }
}
