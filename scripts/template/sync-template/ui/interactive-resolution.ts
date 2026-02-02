/**
 * Enhanced Interactive Resolution Module
 *
 * Provides improved prompts for conflict resolution with:
 * - "Apply to all" batch operations
 * - "Contribute to template" option
 * - Better visual feedback
 */

import * as readline from 'readline';
import {
  ConflictResolution,
  DivergedResolution,
  DeletionResolution,
  InteractiveResolutionContext,
  ResolutionPromptResult,
  InteractiveFileInfo,
  FolderSyncFile,
} from '../types';
import { select, confirm, isInteractive, SelectOption } from '../../cli-utils';

// ============================================================================
// Context Management
// ============================================================================

/**
 * Create a new interactive resolution context
 */
export function createResolutionContext(): InteractiveResolutionContext {
  return {
    divergedApplyAll: null,
    conflictApplyAll: null,
    deletionApplyAll: null,
    pendingContributions: [],
  };
}

// ============================================================================
// Enhanced Resolution Options
// ============================================================================

/**
 * Get enhanced resolution options for diverged files (project modified template files)
 * Includes "Contribute to template" option
 */
export function getDivergedResolutionOptions(): SelectOption<DivergedResolution>[] {
  return [
    {
      value: 'override',
      label: 'Accept template version',
      description: 'Replace your changes with template version (lose your changes)',
    },
    {
      value: 'keep',
      label: 'Keep project version',
      description: 'Keep your version and add to projectOverrides',
    },
    {
      value: 'merge',
      label: 'Merge manually',
      description: 'Create .template file for manual merge, add to overrides',
    },
    {
      value: 'contribute',
      label: 'Contribute to template',
      description: 'Mark for contribution to upstream template',
    },
  ];
}

/**
 * Get enhanced resolution options for conflicts (override files where template also changed)
 */
export function getEnhancedConflictOptions(): SelectOption<ConflictResolution>[] {
  return [
    {
      value: 'override',
      label: 'Accept template version',
      description: 'Replace your changes with template version',
    },
    {
      value: 'skip',
      label: 'Keep project version',
      description: 'Keep your current version, ignore template changes',
    },
    {
      value: 'merge',
      label: 'Merge manually',
      description: 'Create .template file for manual merge',
    },
    {
      value: 'contribute',
      label: 'Contribute to template',
      description: 'Mark for contribution to upstream template',
    },
    {
      value: 'nothing',
      label: 'Skip for now',
      description: 'Leave file unchanged, decide later',
    },
  ];
}

/**
 * Get resolution options for deleted files (template removed files)
 */
export function getDeletionResolutionOptions(): SelectOption<DeletionResolution>[] {
  return [
    {
      value: 'delete',
      label: 'Delete locally',
      description: 'Remove the file from your project',
    },
    {
      value: 'keep',
      label: 'Keep file',
      description: 'Keep file and add to projectOverrides',
    },
    {
      value: 'skip',
      label: 'Skip for now',
      description: 'Decide later',
    },
  ];
}

// ============================================================================
// File Info Display
// ============================================================================

/**
 * Display file info with diff statistics
 */
export function displayFileInfo(file: InteractiveFileInfo, index: number, total: number): void {
  console.log('\n' + '─'.repeat(60));
  console.log(`\n📄 File ${index + 1} of ${total}: ${file.path}`);
  console.log('');

  if (file.templateLinesAdded !== undefined || file.templateLinesRemoved !== undefined) {
    const added = file.templateLinesAdded ?? 0;
    const removed = file.templateLinesRemoved ?? 0;
    console.log(`   📊 Template changes: +${added} lines, -${removed} lines`);
  }

  if (file.templateDescription) {
    console.log(`   📝 Template: ${file.templateDescription}`);
  }

  if (file.projectLinesAdded !== undefined || file.projectLinesRemoved !== undefined) {
    const added = file.projectLinesAdded ?? 0;
    const removed = file.projectLinesRemoved ?? 0;
    console.log(`   📊 Your changes: +${added} lines, -${removed} lines`);
  }

  if (file.projectDescription) {
    console.log(`   📝 Your changes: ${file.projectDescription}`);
  }

  console.log('');
}

// ============================================================================
// Batch Resolution Prompts
// ============================================================================

/**
 * Prompt for batch mode selection
 */
export async function promptBatchMode(
  fileCount: number,
  fileType: 'diverged' | 'conflict' | 'deletion',
  rl: readline.Interface
): Promise<'bulk' | 'individual'> {
  const typeLabels = {
    diverged: 'diverged files (project modified template files)',
    conflict: 'conflicts (override files with template changes)',
    deletion: 'deleted files (removed from template)',
  };

  console.log('\n' + '─'.repeat(60));
  console.log(`📋 ${fileCount} ${typeLabels[fileType]}`);
  console.log('─'.repeat(60));

  const options: SelectOption<'bulk' | 'individual'>[] = [
    {
      value: 'bulk',
      label: 'Apply same action to all',
      description: 'Choose one action for all files',
    },
    {
      value: 'individual',
      label: 'Choose per file',
      description: 'Review and choose action for each file individually',
    },
  ];

  if (isInteractive()) {
    const result = await select('How would you like to handle these files?', options);
    return result ?? 'bulk';
  } else {
    console.log('\nHow would you like to handle these files?\n');
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

// ============================================================================
// Individual Resolution Prompts
// ============================================================================

/**
 * Prompt for diverged file resolution with "apply to all" option
 */
export async function promptDivergedResolution(
  file: InteractiveFileInfo,
  index: number,
  total: number,
  context: InteractiveResolutionContext,
  rl: readline.Interface
): Promise<ResolutionPromptResult<DivergedResolution>> {
  // Check if we have an "apply to all" decision
  if (context.divergedApplyAll !== null) {
    return { resolution: context.divergedApplyAll, applyToAll: true };
  }

  displayFileInfo(file, index, total);

  const options = getDivergedResolutionOptions();

  // Add "apply to all" variants if there are more files
  const remainingFiles = total - index - 1;
  if (remainingFiles > 0) {
    options.push({
      value: 'override' as DivergedResolution,
      label: `Accept template (apply to all ${remainingFiles + 1} remaining)`,
      description: 'Use template version for this and all remaining diverged files',
    });
    options.push({
      value: 'keep' as DivergedResolution,
      label: `Keep project (apply to all ${remainingFiles + 1} remaining)`,
      description: 'Keep project version for this and all remaining diverged files',
    });
  }

  if (isInteractive()) {
    const result = await select('How do you want to resolve this?', options);
    const resolution = result ?? 'keep';

    // Check if user selected an "apply to all" option (indices 4 or 5)
    const selectedIndex = options.findIndex((o) => o === options.find((opt) => opt.value === resolution));
    const applyToAll = remainingFiles > 0 && selectedIndex >= 4;

    return { resolution, applyToAll };
  } else {
    console.log('How do you want to resolve this?\n');
    options.slice(0, 4).forEach((opt, i) => {
      console.log(`  [${i + 1}] ${opt.label} - ${opt.description}`);
    });
    console.log('');

    return new Promise((resolve) => {
      rl.question('Enter your choice (1/2/3/4): ', (answer) => {
        const choice = answer.trim();
        const resolutionMap: Record<string, DivergedResolution> = {
          '1': 'override',
          '2': 'keep',
          '3': 'merge',
          '4': 'contribute',
        };
        resolve({ resolution: resolutionMap[choice] ?? 'keep', applyToAll: false });
      });
    });
  }
}

/**
 * Prompt for conflict resolution with "apply to all" option
 */
export async function promptConflictResolution(
  file: InteractiveFileInfo,
  index: number,
  total: number,
  context: InteractiveResolutionContext,
  rl: readline.Interface
): Promise<ResolutionPromptResult<ConflictResolution>> {
  // Check if we have an "apply to all" decision
  if (context.conflictApplyAll !== null) {
    return { resolution: context.conflictApplyAll, applyToAll: true };
  }

  displayFileInfo(file, index, total);

  const options = getEnhancedConflictOptions();

  if (isInteractive()) {
    const result = await select('How do you want to resolve this conflict?', options);
    return { resolution: result ?? 'nothing', applyToAll: false };
  } else {
    console.log('How do you want to resolve this conflict?\n');
    options.forEach((opt, i) => {
      console.log(`  [${i + 1}] ${opt.label} - ${opt.description}`);
    });
    console.log('');

    return new Promise((resolve) => {
      rl.question('Enter your choice (1/2/3/4/5): ', (answer) => {
        const choice = answer.trim();
        const resolutionMap: Record<string, ConflictResolution> = {
          '1': 'override',
          '2': 'skip',
          '3': 'merge',
          '4': 'contribute',
          '5': 'nothing',
        };
        resolve({ resolution: resolutionMap[choice] ?? 'nothing', applyToAll: false });
      });
    });
  }
}

/**
 * Prompt for deletion resolution with "apply to all" option
 */
export async function promptDeletionResolution(
  file: FolderSyncFile,
  index: number,
  total: number,
  context: InteractiveResolutionContext,
  rl: readline.Interface
): Promise<ResolutionPromptResult<DeletionResolution>> {
  // Check if we have an "apply to all" decision
  if (context.deletionApplyAll !== null) {
    return { resolution: context.deletionApplyAll, applyToAll: true };
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n🗑️  File ${index + 1} of ${total}: ${file.path}`);
  console.log('   This file was removed from the template.');
  console.log('');

  const options = getDeletionResolutionOptions();

  // Add "apply to all" variants if there are more files
  const remainingFiles = total - index - 1;
  if (remainingFiles > 0) {
    options.push({
      value: 'delete' as DeletionResolution,
      label: `Delete all (${remainingFiles + 1} remaining)`,
      description: 'Delete this and all remaining removed files',
    });
    options.push({
      value: 'keep' as DeletionResolution,
      label: `Keep all (${remainingFiles + 1} remaining)`,
      description: 'Keep this and all remaining removed files',
    });
  }

  if (isInteractive()) {
    const result = await select('What do you want to do with this file?', options);
    const resolution = result ?? 'skip';

    // Check if user selected an "apply to all" option (indices 3 or 4)
    const selectedIndex = options.findIndex((o) => o === options.find((opt) => opt.value === resolution));
    const applyToAll = remainingFiles > 0 && selectedIndex >= 3;

    return { resolution, applyToAll };
  } else {
    console.log('What do you want to do with this file?\n');
    options.slice(0, 3).forEach((opt, i) => {
      console.log(`  [${i + 1}] ${opt.label} - ${opt.description}`);
    });
    console.log('');

    return new Promise((resolve) => {
      rl.question('Enter your choice (1/2/3): ', (answer) => {
        const choice = answer.trim();
        const resolutionMap: Record<string, DeletionResolution> = {
          '1': 'delete',
          '2': 'keep',
          '3': 'skip',
        };
        resolve({ resolution: resolutionMap[choice] ?? 'skip', applyToAll: false });
      });
    });
  }
}

// ============================================================================
// Bulk Resolution Prompts
// ============================================================================

/**
 * Prompt for bulk diverged resolution
 */
export async function promptBulkDivergedResolution(
  rl: readline.Interface
): Promise<DivergedResolution> {
  const options = getDivergedResolutionOptions();

  if (isInteractive()) {
    const result = await select('Choose action for ALL diverged files:', options);
    return result ?? 'keep';
  } else {
    console.log('\nChoose action for ALL diverged files:\n');
    options.forEach((opt, i) => {
      console.log(`  [${i + 1}] ${opt.label} - ${opt.description}`);
    });
    console.log('');

    return new Promise((resolve) => {
      rl.question('Enter your choice (1/2/3/4): ', (answer) => {
        const choice = answer.trim();
        const resolutionMap: Record<string, DivergedResolution> = {
          '1': 'override',
          '2': 'keep',
          '3': 'merge',
          '4': 'contribute',
        };
        resolve(resolutionMap[choice] ?? 'keep');
      });
    });
  }
}

/**
 * Prompt for bulk deletion resolution
 */
export async function promptBulkDeletionResolution(
  rl: readline.Interface
): Promise<DeletionResolution> {
  const options = getDeletionResolutionOptions();

  if (isInteractive()) {
    const result = await select('Choose action for ALL deleted files:', options);
    return result ?? 'skip';
  } else {
    console.log('\nChoose action for ALL deleted files:\n');
    options.forEach((opt, i) => {
      console.log(`  [${i + 1}] ${opt.label} - ${opt.description}`);
    });
    console.log('');

    return new Promise((resolve) => {
      rl.question('Enter your choice (1/2/3): ', (answer) => {
        const choice = answer.trim();
        const resolutionMap: Record<string, DeletionResolution> = {
          '1': 'delete',
          '2': 'keep',
          '3': 'skip',
        };
        resolve(resolutionMap[choice] ?? 'skip');
      });
    });
  }
}

// ============================================================================
// Summary Display
// ============================================================================

/**
 * Display sync plan summary before execution
 */
export function displaySyncPlan(
  newFiles: string[],
  updatedFiles: string[],
  deletedFiles: string[],
  conflicts: string[],
  diverged: string[],
  skipped: string[]
): void {
  console.log('\n' + '═'.repeat(60));
  console.log('📋 SYNC PLAN');
  console.log('═'.repeat(60));

  if (newFiles.length > 0) {
    console.log(`\n✅ Auto-add: ${newFiles.length} new files`);
    newFiles.slice(0, 5).forEach((f) => console.log(`   + ${f}`));
    if (newFiles.length > 5) {
      console.log(`   ... and ${newFiles.length - 5} more`);
    }
  }

  if (updatedFiles.length > 0) {
    console.log(`\n📝 Update: ${updatedFiles.length} files`);
    updatedFiles.slice(0, 5).forEach((f) => console.log(`   ~ ${f}`));
    if (updatedFiles.length > 5) {
      console.log(`   ... and ${updatedFiles.length - 5} more`);
    }
  }

  if (deletedFiles.length > 0) {
    console.log(`\n🗑️  Delete: ${deletedFiles.length} files`);
    deletedFiles.slice(0, 5).forEach((f) => console.log(`   - ${f}`));
    if (deletedFiles.length > 5) {
      console.log(`   ... and ${deletedFiles.length - 5} more`);
    }
  }

  if (conflicts.length > 0) {
    console.log(`\n⚠️  Conflicts: ${conflicts.length} files (need resolution)`);
    conflicts.forEach((f) => console.log(`   ! ${f}`));
  }

  if (diverged.length > 0) {
    console.log(`\n🔀 Diverged: ${diverged.length} files (project modified template files)`);
    diverged.forEach((f) => console.log(`   ⚡ ${f}`));
  }

  if (skipped.length > 0) {
    console.log(`\n⏭️  Skip: ${skipped.length} files (project overrides)`);
  }

  console.log('\n' + '═'.repeat(60));
}

/**
 * Display final sync results
 */
export function displaySyncResults(
  added: number,
  updated: number,
  deleted: number,
  merged: number,
  skipped: number,
  contributed: number,
  errors: string[]
): void {
  console.log('\n' + '━'.repeat(60));
  console.log('✅ Sync complete!');
  console.log('');

  if (added > 0) console.log(`   Added: ${added} files`);
  if (updated > 0) console.log(`   Updated: ${updated} files`);
  if (deleted > 0) console.log(`   Deleted: ${deleted} files`);
  if (merged > 0) console.log(`   Merged: ${merged} files (.template created)`);
  if (skipped > 0) console.log(`   Skipped: ${skipped} files`);
  if (contributed > 0) console.log(`   Marked for contribution: ${contributed} files`);

  if (errors.length > 0) {
    console.log(`\n   ❌ Errors: ${errors.length}`);
    errors.forEach((e) => console.log(`      - ${e}`));
  }

  console.log('━'.repeat(60));
}

/**
 * Display contribution reminder
 */
export function displayContributionReminder(files: string[]): void {
  if (files.length === 0) return;

  console.log('\n' + '─'.repeat(60));
  console.log('📤 Files marked for contribution to template:');
  files.forEach((f) => console.log(`   • ${f}`));
  console.log('\nTo contribute these files, use:');
  console.log('  yarn sync-template --project-diffs');
  console.log('─'.repeat(60));
}

// ============================================================================
// Auto-add Confirmation
// ============================================================================

/**
 * Prompt to confirm auto-adding new files
 */
export async function promptAutoAddConfirmation(
  newFiles: string[],
  rl: readline.Interface
): Promise<boolean> {
  if (newFiles.length === 0) return true;

  console.log(`\n✨ Found ${newFiles.length} new files from template:`);
  newFiles.slice(0, 10).forEach((f) => console.log(`   + ${f}`));
  if (newFiles.length > 10) {
    console.log(`   ... and ${newFiles.length - 10} more`);
  }

  return confirm('Add these new files to your project?', true);
}

/**
 * Prompt to confirm deletions
 */
export async function promptDeletionConfirmation(
  deletedFiles: string[],
  rl: readline.Interface
): Promise<boolean> {
  if (deletedFiles.length === 0) return true;

  console.log(`\n🗑️  Template removed ${deletedFiles.length} files:`);
  deletedFiles.slice(0, 10).forEach((f) => console.log(`   - ${f}`));
  if (deletedFiles.length > 10) {
    console.log(`   ... and ${deletedFiles.length - 10} more`);
  }

  return confirm('Delete these files from your project?', true);
}
