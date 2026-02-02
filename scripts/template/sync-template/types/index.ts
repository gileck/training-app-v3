/**
 * Types, interfaces, and constants for the Template Sync Tool
 */

import * as readline from 'readline';

// ============================================================================
// Constants
// ============================================================================

export const CONFIG_FILE = '.template-sync.json';  // Project-owned config
export const TEMPLATE_CONFIG_FILE = '.template-sync.template.json';  // Template-owned config (synced)
export const TEMPLATE_DIR = '.template-sync-temp';
export const DIFF_SUMMARY_FILE = 'template-diff-summary.md';
export const SYNC_REPORT_FILE = 'SYNC-REPORT.md';
export const MAX_SYNC_HISTORY = 20;  // Keep last 20 syncs

// ============================================================================
// Types
// ============================================================================

export type SyncMode = 'safe' | 'all' | 'none';

export type ConflictResolution = 'override' | 'skip' | 'merge' | 'nothing' | 'contribute';

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

/**
 * Template-owned config file (.template-sync.template.json)
 * This file is synced FROM the template and defines what the template owns.
 * Projects should NOT modify this file.
 */
export interface TemplateOwnedConfig {
  /**
   * Paths owned by template (files, folders, globs).
   * These paths are synced exactly - including deletions.
   * Examples: ["package.json", "docs/template/**", "src/client/components/ui/**"]
   */
  templatePaths: string[];

  /**
   * Template files to never sync to child projects.
   * Example: demo/example code that exists in template but shouldn't be synced.
   * Examples: ["src/apis/todos/**", "src/client/routes/Todos/**"]
   */
  templateIgnoredFiles?: string[];
}

/**
 * Project-owned config file (.template-sync.json)
 * This file is owned by the project and is NOT synced from template.
 */
export interface ProjectOwnedConfig {
  templateRepo: string;
  templateBranch: string;
  templateLocalPath?: string;  // Local path to template repo (for faster sync)
  lastSyncCommit: string | null;
  lastSyncDate: string | null;

  /**
   * Files within templatePaths that project wants to keep different.
   * Template changes to these files will show as conflicts.
   * Only specific files (not globs) are supported here.
   * Examples: ["src/client/components/ui/badge.tsx"]
   */
  projectOverrides: string[];

  /**
   * Hashes of override files at the time they were overridden.
   * Used to detect when template changes a file that project has overridden.
   */
  overrideHashes?: Record<string, string>;

  // Optional - for tracking history
  syncHistory?: SyncHistoryEntry[];
}

/**
 * Combined config (merged in memory for sync operations)
 */
export interface FolderOwnershipConfig extends TemplateOwnedConfig, ProjectOwnedConfig {}

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
  mergePackageJson: boolean;  // Only merge package.json (no full sync)
  acceptAll: boolean;  // Non-interactive mode: accept all template changes (--yes flag)
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
  config: FolderOwnershipConfig;
  options: SyncOptions;
  projectRoot: string;
  rl: readline.Interface;
  totalDiffSummary: TotalDiffSummary | null;
}

// ============================================================================
// Folder Ownership Analysis Types
// ============================================================================

/**
 * Action type for a file in the folder ownership model
 */
export type FolderSyncAction = 'copy' | 'delete' | 'skip' | 'conflict' | 'merge' | 'diverged';

/**
 * A file analysis result in the folder ownership model
 */
export interface FolderSyncFile {
  path: string;
  action: FolderSyncAction;
  reason: string;
  inTemplate: boolean;
  inProject: boolean;
  isOverride: boolean;
  templateChanged?: boolean;  // For overrides: did template change this file?
}

/**
 * Result of folder ownership analysis
 */
export interface FolderSyncAnalysis {
  /** Files to copy from template (add or update) */
  toCopy: FolderSyncFile[];

  /** Files to delete from project (removed in template) */
  toDelete: FolderSyncFile[];

  /** Files to skip (project overrides with no template change) */
  toSkip: FolderSyncFile[];

  /** Conflicts (project override files where template also changed) */
  conflicts: FolderSyncFile[];

  /** Files to 3-way merge (package.json) */
  toMerge: FolderSyncFile[];

  /** Diverged files (project modified template file without adding to overrides) */
  diverged: FolderSyncFile[];

  /** Summary of template paths expanded from globs */
  expandedTemplatePaths: string[];
}

// ============================================================================
// Interactive Resolution Types
// ============================================================================

/**
 * Resolution options for diverged files (project modified template files)
 */
export type DivergedResolution = 'override' | 'keep' | 'merge' | 'contribute';

/**
 * Resolution options for deleted files (template removed files)
 */
export type DeletionResolution = 'delete' | 'keep' | 'skip';

/**
 * Tracks "apply to all" decisions during interactive resolution.
 * When a user selects "apply to all" for a resolution type, we store
 * the decision here to avoid prompting for similar files.
 */
export interface InteractiveResolutionContext {
  /** "Apply to all" decision for diverged files */
  divergedApplyAll: DivergedResolution | null;

  /** "Apply to all" decision for conflict files */
  conflictApplyAll: ConflictResolution | null;

  /** "Apply to all" decision for deleted files */
  deletionApplyAll: DeletionResolution | null;

  /** Files marked for contribution to template */
  pendingContributions: string[];
}

/**
 * Result from an interactive resolution prompt
 */
export interface ResolutionPromptResult<T> {
  /** The resolution chosen */
  resolution: T;

  /** Whether to apply this to all similar files */
  applyToAll: boolean;
}

/**
 * Enhanced file info for interactive prompts
 */
export interface InteractiveFileInfo {
  path: string;
  templateLinesAdded?: number;
  templateLinesRemoved?: number;
  projectLinesAdded?: number;
  projectLinesRemoved?: number;
  templateDescription?: string;
  projectDescription?: string;
}
