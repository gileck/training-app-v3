/**
 * Files module re-exports
 */

export { getAllFiles } from './scanning';
export { getFileHash, getStoredHash, storeFileHash, getTemplateFileHash, getProjectFileHash } from './hashing';
export { compareFiles, getChangeStatus, hasProjectChanges, hasTemplateChanges } from './comparison';
export { matchesPatterns, isProjectOverride, shouldIgnoreTemplateFile, matchesTemplatePaths } from './ignore-patterns';
