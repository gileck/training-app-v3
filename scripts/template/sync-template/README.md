# Template Sync Tool

A modular tool for syncing updates from a template repository into projects created from that template.

## Folder Structure

```
sync-template/
├── index.ts                 # CLI entry point
├── sync-template-tool.ts    # Main orchestration class
├── types/                   # Type definitions
├── utils/                   # Shared utilities
├── git/                     # Git operations
├── files/                   # File system operations
├── analysis/                # Change analysis & diffs
├── ui/                      # User interaction
├── sync/                    # File sync operations
├── reporting/               # Results & history
└── modes/                   # Specialized run modes
```

## Module Overview

### `types/`
All TypeScript interfaces, types, and constants used throughout the tool.

- `SyncOptions` - CLI options configuration
- `TemplateSyncConfig` - The `.template-sync.json` schema
- `FileChange`, `AnalysisResult`, `SyncResult` - Core data structures
- `SyncContext` - Shared context object passed between modules

### `utils/`
Shared utility functions.

| File | Purpose |
|------|---------|
| `logging.ts` | `log()`, `logVerbose()`, `logError()` with quiet/verbose mode support |
| `exec.ts` | Shell command execution, ANSI stripping |
| `config.ts` | Load/save `.template-sync.json` |

### `git/`
Git repository operations.

| Function | Purpose |
|----------|---------|
| `cloneTemplate()` | Clone template repo to temp directory |
| `cleanupTemplate()` | Remove temp directory |
| `checkGitStatus()` | Verify no uncommitted changes |
| `convertToSSH()` | Convert HTTPS URLs to SSH format |
| `getRepoUrl()` | Get appropriate clone URL |

### `files/`
File system operations and comparisons.

| File | Purpose |
|------|---------|
| `scanning.ts` | Recursively scan directories for files |
| `hashing.ts` | MD5 hash computation and storage |
| `comparison.ts` | Compare files between template and project |
| `ignore-patterns.ts` | Glob pattern matching for ignored files |

### `analysis/`
Change detection and diff generation.

| File | Purpose |
|------|---------|
| `change-analysis.ts` | Categorize changes into safe/conflict/project-only |
| `diff-utils.ts` | Generate diffs, AI descriptions, conflict analysis |

### `ui/`
User interaction and display.

| File | Purpose |
|------|---------|
| `prompts.ts` | Main menu prompts, sync mode selection |
| `conflict-resolution.ts` | Per-file conflict resolution UI |
| `display.ts` | Diff summary display, drift visualization |

### `sync/`
Core file synchronization logic.

| Function | Purpose |
|----------|---------|
| `syncFiles()` | Apply changes based on user selections |

### `reporting/`
Results output and history tracking.

| File | Purpose |
|------|---------|
| `results.ts` | Print sync results, generate `SYNC-REPORT.md` |
| `history.ts` | Track sync history, format commit messages |

### `modes/`
Specialized run modes (non-sync operations).

| File | CLI Flag | Purpose |
|------|----------|---------|
| `init-hashes.ts` | `--init-hashes` | Initialize baseline hashes for all files |
| `project-diffs.ts` | `--project-diffs` | Show diffs for contribute-to-template |
| `show-drift.ts` | `--show-drift` | Display total project drift from template |
| `changelog.ts` | `--changelog` | Show template commits since last sync |
| `diff-summary.ts` | `--diff-summary` | Generate full diff report file |
| `merge-package-json.ts` | `--merge-package-json` | Only merge package.json from template |
| `validation.ts` | (internal) | Run TypeScript and ESLint checks |

## Architecture

The tool uses a **context object pattern** where a `SyncContext` is passed to all module functions:

```typescript
interface SyncContext {
  config: TemplateSyncConfig;  // Loaded .template-sync.json
  options: SyncOptions;        // CLI options
  projectRoot: string;         // Working directory
  rl: readline.Interface;      // For user input
  totalDiffSummary: TotalDiffSummary | null;
}
```

## Main Flow

1. **Parse CLI args** (`index.ts`)
2. **Create tool instance** (`sync-template-tool.ts`)
3. **Check for special modes** (changelog, show-drift, etc.)
4. **Clone template** to temp directory
5. **Analyze changes** - categorize into safe/conflict/project-only
6. **Prompt user** for sync mode and conflict resolution
7. **Apply changes** based on selections
8. **Run validation** (TypeScript + ESLint)
9. **Commit changes** with formatted message
10. **Cleanup** temp directory

## Usage

```bash
# Interactive sync
yarn sync-template

# Preview changes without applying
yarn sync-template --dry-run

# Show what changed in template
yarn sync-template --changelog

# Show total drift from template
yarn sync-template --show-drift

# Only merge package.json (no full sync)
yarn sync-template --merge-package-json

# Auto modes (non-interactive)
yarn sync-template --auto-safe-only
yarn sync-template --auto-skip-conflicts
```

See `index.ts` header comment for full CLI options.
