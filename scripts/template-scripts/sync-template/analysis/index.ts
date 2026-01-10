/**
 * Analysis module re-exports
 */

export { analyzeChanges, fileExistedInTemplateAtLastSync } from './change-analysis';
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
