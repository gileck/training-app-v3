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
