/**
 * UI module re-exports
 */

export {
  promptUser,
  promptConflictResolutionMode,
  promptBulkConflictResolution,
  getConflictResolutionOptions,
  printConflictResolutionOptions,
  parseConflictResolution,
} from './prompts';

export {
  promptIndividualConflictResolution,
  handleConflictResolution,
  printConflictResolutionSummary,
} from './conflict-resolution';

export {
  displayTotalDiffSummary,
  displayTotalDiffDetails,
} from './display';

// Enhanced interactive resolution (batch operations, "contribute to template")
export {
  createResolutionContext,
  getDivergedResolutionOptions,
  getEnhancedConflictOptions,
  getDeletionResolutionOptions,
  displayFileInfo,
  promptBatchMode,
  promptDivergedResolution,
  promptConflictResolution,
  promptDeletionResolution,
  promptBulkDivergedResolution,
  promptBulkDeletionResolution,
  displaySyncPlan,
  displaySyncResults,
  displayContributionReminder,
  promptAutoAddConfirmation,
  promptDeletionConfirmation,
} from './interactive-resolution';
