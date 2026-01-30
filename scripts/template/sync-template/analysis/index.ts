/**
 * Analysis module re-exports
 */

export { analyzeChanges, fileExistedInTemplateAtLastSync, getBaselinePackageJson } from './change-analysis';
export {
  getFileDiffSummary,
  formatDiffStats,
  getLocalDiff,
  getTemplateDiff,
  generateFileDiff,
  getAIDescription,
  getConflictAnalysis,
  isAgentAvailable,
  type ConflictAnalysis,
} from './diff-utils';

// Folder Ownership Model (new)
export {
  analyzeFolderSync,
  printFolderSyncAnalysis,
  expandGlob,
  expandTemplatePaths,
  matchesPatterns,
  getProjectFilesMatchingTemplatePaths,
} from './folder-sync-analysis';
