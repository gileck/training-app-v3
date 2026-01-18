/**
 * Types, interfaces, and constants for the Template Sync Tool
 */

import * as readline from 'readline';

// ============================================================================
// Constants
// ============================================================================

export const CONFIG_FILE = '.template-sync.json';
export const TEMPLATE_DIR = '.template-sync-temp';
export const DIFF_SUMMARY_FILE = 'template-diff-summary.md';
export const SYNC_REPORT_FILE = 'SYNC-REPORT.md';
export const MAX_SYNC_HISTORY = 20;  // Keep last 20 syncs

// ============================================================================
// Types
// ============================================================================

export type SyncMode = 'safe' | 'all' | 'none';

export type ConflictResolution = 'override' | 'skip' | 'merge' | 'nothing';

export type AutoMode = 'none' | 'safe-only' | 'merge-conflicts' | 'override-conflicts' | 'skip-conflicts';

// ============================================================================
// Interfaces
// ============================================================================

export interface SyncHistoryEntry {
  date: string;
  templateCommit: string;
  projectCommit: string;
  filesApplied: number;
  filesSkipped: number;
  filesConflicted: number;
  templateCommits: string[];  // Commit messages synced
}

export interface TemplateSyncConfig {
  templateRepo: string;
  templateBranch: string;
  baseCommit: string | null;
  lastSyncCommit: string | null;
  lastProjectCommit: string | null;
  lastSyncDate: string | null;
  ignoredFiles: string[];
  projectSpecificFiles: string[];
  templateIgnoredFiles?: string[];  // Template files to never sync (e.g., example/demo code)
  templateLocalPath?: string;  // Local path to template repo (for faster sync and contributing changes)
  syncHistory?: SyncHistoryEntry[];  // Track sync history
  fileHashes?: Record<string, string>;  // Hash of each file at last sync time
}

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  inTemplate: boolean;
  inProject: boolean;
}

export interface SyncResult {
  autoMerged: string[];
  conflicts: string[];
  projectOnlyChanges: string[];  // Only changed in project - kept as-is
  skipped: string[];
  errors: string[];
}

export interface AnalysisResult {
  safeChanges: FileChange[];        // Only changed in template - safe to auto-apply
  conflictChanges: FileChange[];    // Changed in BOTH - needs manual merge
  projectOnlyChanges: FileChange[]; // Only changed in project - keep as-is
  skipped: string[];
  newChanges: Set<string>;          // Track which changes are NEW (since last sync)
  packageJsonMerge?: PackageJsonMergeResult;  // Result of package.json auto-merge (if applicable)
}

export interface FieldConflict {
  field: string;
  baseValue: unknown;
  templateValue: unknown;
  projectValue: unknown;
}

export interface PackageJsonMergeResult {
  success: boolean;
  merged: Record<string, unknown> | null;
  autoMergedFields: string[];         // Fields that were auto-merged from template
  projectKeptFields: string[];        // Fields where project changes were kept
  conflicts: FieldConflict[];         // Fields where both changed (kept project value)
  templateOnlyFields: string[];       // Fields only in template (added)
  projectOnlyFields: string[];        // Fields only in project (kept)
}

export interface ConflictResolutionMap {
  [filePath: string]: ConflictResolution;
}

export interface SyncOptions {
  dryRun: boolean;
  force: boolean;
  autoMode: AutoMode;
  diffSummary: boolean;
  skipIgnored: boolean;
  modifiedOnly: boolean;
  changelog: boolean;
  showDrift: boolean;
  report: boolean;
  quiet: boolean;
  verbose: boolean;
  useHTTPS: boolean;
  initHashes: boolean;
  projectDiffs: boolean;
  json: boolean;  // Output JSON result (for programmatic use)
}

/**
 * JSON output structure for --json mode.
 * Used by sync-child-projects for programmatic sync status.
 */
export interface SyncJsonResult {
  status: 'success' | 'no-changes' | 'checks-failed' | 'error';
  message: string;
  filesApplied: string[];
  filesSkipped: string[];
  filesConflicted: string[];
  projectOnlyChanges: string[];
  errors: string[];
  templateCommit?: string;
  projectCommit?: string;
  checksResult?: {
    passed: boolean;
    tsErrors: string[];
    lintErrors: string[];
  };
}

export interface TotalDiffSummary {
  newInTemplate: string[];
  modified: string[];
  identical: number;
  ignoredDiffs: string[];
  projectSpecificDiffs: string[];
}

export interface ChangeStatus {
  projectChanged: boolean;
  templateChanged: boolean;
  hasBaseline: boolean;
}

export interface DiffSummary {
  added: number;
  removed: number;
  preview: string[];
  diff: string;
}

/**
 * Context object passed to all module functions.
 * Holds shared state and configuration.
 */
export interface SyncContext {
  config: TemplateSyncConfig;
  options: SyncOptions;
  projectRoot: string;
  rl: readline.Interface;
  totalDiffSummary: TotalDiffSummary | null;
}
