/**
 * Utility re-exports
 */

export { log, logVerbose, logError } from './logging';
export { exec, stripAnsi, type ExecOptions } from './exec';
export {
  loadConfig,
  saveConfig,
  loadTemplateConfig,
  loadProjectConfig,
  saveTemplateConfig,
  saveProjectConfig,
  hasSplitConfig,
  mergeTemplateIgnoredFiles,
} from './config';
export {
  mergePackageJson,
  mergePackageJsonFiles,
  readPackageJson,
  writePackageJson,
  formatMergeSummary,
  formatConflictMessage,
  formatValue,
  resolveFieldConflictsInteractively,
  type FieldConflict,
  type FieldResolution,
  type PackageJsonMergeResult,
} from './package-json-merge';
