# Task 36: Improve sync-template with Interactive Conflict Resolution - Implementation Plan

## Objective
Enhance `yarn sync-template` to provide a more intuitive user experience with:
1. Auto-add new template files (unless in projectOverrides)
2. Interactive conflict resolution with improved prompts and batch operations
3. Handling of file deletions with clear user choices
4. "Apply to all" batch operation functionality
5. Better UX with clearer visual feedback and summary statistics

## Current State Analysis

### What Already Exists
The codebase already has a sophisticated sync-template infrastructure:

1. **Analysis System** (`scripts/template/sync-template/analysis/folder-sync-analysis.ts`):
   - `analyzeFolderSync()` already categorizes files into: `toCopy`, `toDelete`, `toSkip`, `conflicts`, `toMerge`, `diverged`
   - Glob pattern expansion and file comparison are fully implemented
   - Diff generation and AI-powered change descriptions exist

2. **Interactive Prompts** (`scripts/template/sync-template/ui/prompts.ts`):
   - `promptConflictResolutionMode()` - asks bulk vs individual
   - `promptBulkConflictResolution()` - bulk resolution
   - `getConflictResolutionOptions()` - returns options: override, skip, merge, nothing

3. **CLI Utilities** (`scripts/template/cli-utils.ts`):
   - `select<T>()` - keyboard-navigable select menu with vim-style navigation
   - `confirm()` - yes/no prompts
   - `isInteractive()` - TTY detection

4. **Sync Operations** (`scripts/template/sync-template/sync/operations.ts`):
   - `syncFolderOwnership()` handles applying changes based on resolutions
   - Already supports `conflictResolutions` and `divergedResolutions` maps
   - Auto-updates `projectOverrides` and `overrideHashes` in config

5. **Main Flow** (`scripts/template/sync-template/sync-template-tool.ts`):
   - `runFolderOwnershipSync()` is the main orchestration method
   - Lines 214-258 handle diverged file resolution (interactive)
   - Lines 262-293 handle conflict resolution (interactive)
   - Current interactive flow uses basic readline prompts

### What Needs Enhancement

1. **Missing "Apply to all" (batch) for diverged files** - Currently only conflicts have bulk mode
2. **Missing "Contribute to template" option** - Not implemented in resolution options
3. **No auto-add of new files** - `toCopy` files that are new require confirmation
4. **Deletion handling is implicit** - `toDelete` files are deleted without explicit prompts in interactive mode
5. **Better summary/progress display** - Current output is verbose but not as clean as the mockup
6. **Missing `--yes` flag** - For non-interactive mode accepting all template changes

## Approach

### Key Design Decisions

1. **Leverage existing cli-utils.ts** - The `select()` function already provides excellent keyboard navigation; extend it rather than adding new dependencies like `inquirer`

2. **Create new resolution type** - Add `'contribute'` to `ConflictResolution` type for upstream contribution marking

3. **Enhance interactive flow** - Refactor the diverged/conflict handling in `sync-template-tool.ts` to use a unified, improved prompt system

4. **Add batch context** - Track "apply to all" decisions in a session context to avoid repetitive prompts

5. **Group similar files** - For batch operations, group files by type (new, modified, deleted) and allow per-group decisions

## Sub-tasks

### Phase 1: Core Type and Utility Updates
- [ ] **1.1** Add `'contribute'` to `ConflictResolution` type in `types/index.ts`
- [ ] **1.2** Add new `InteractiveResolutionContext` interface to track batch decisions
- [ ] **1.3** Add `--yes` flag to `SyncOptions` for non-interactive accept-all mode

### Phase 2: Enhanced Interactive Prompts
- [ ] **2.1** Create `ui/interactive-resolution.ts` with new resolution flow:
  - `promptAutoAddNewFiles()` - confirm auto-adding new files
  - `promptDivergedResolution()` - with "apply to all" support
  - `promptConflictResolutionEnhanced()` - includes "Contribute to template" option
  - `promptDeletionHandling()` - explicit deletion confirmation
- [ ] **2.2** Add `getEnhancedResolutionOptions()` that includes "Contribute to template" option
- [ ] **2.3** Create helper for batch "apply to all" tracking

### Phase 3: Summary and Display Improvements
- [ ] **3.1** Create `ui/summary-display.ts` with improved formatting:
  - `displaySyncPlan()` - shows planned actions before execution
  - `displaySyncResults()` - final summary with counts
  - `displayProgressIndicator()` - shows current operation
- [ ] **3.2** Update `printFolderSyncAnalysis()` to match new visual design

### Phase 4: Main Flow Integration
- [ ] **4.1** Refactor `runFolderOwnershipSync()` in `sync-template-tool.ts`:
  - Add auto-add flow for new files at the beginning
  - Integrate enhanced diverged resolution
  - Integrate enhanced conflict resolution
  - Add explicit deletion confirmation
- [ ] **4.2** Handle `--yes` flag to bypass all interactive prompts
- [ ] **4.3** Update `syncFolderOwnership()` to handle 'contribute' resolution (mark files, don't sync)

### Phase 5: Config and Persistence
- [ ] **5.1** Add `pendingContributions` array to config for tracking files to contribute
- [ ] **5.2** Implement logic to update `projectOverrides` when user chooses "Keep project version"
- [ ] **5.3** Ensure config is saved atomically after all resolutions

### Phase 6: Documentation and Testing
- [ ] **6.1** Update `docs/template/template-sync/template-sync.md` with new interactive flow
- [ ] **6.2** Document new `--yes` flag in help text
- [ ] **6.3** Add examples of batch operations in documentation

## Files to Modify

| File | Changes |
|------|---------|
| `scripts/template/sync-template/types/index.ts` | Add `'contribute'` to `ConflictResolution`, add `InteractiveResolutionContext` interface, update `SyncOptions` with `acceptAll` flag |
| `scripts/template/sync-template/ui/prompts.ts` | Add enhanced resolution options including "Contribute to template" |
| `scripts/template/sync-template/ui/interactive-resolution.ts` (NEW) | New file with improved interactive resolution flow and batch support |
| `scripts/template/sync-template/ui/index.ts` | Export new functions from interactive-resolution.ts |
| `scripts/template/sync-template/sync-template-tool.ts` | Refactor `runFolderOwnershipSync()` to use enhanced interactive flow |
| `scripts/template/sync-template/sync/operations.ts` | Handle 'contribute' resolution type |
| `scripts/template/sync-template/index.ts` | Add `--yes` flag parsing |
| `scripts/template/sync-template/analysis/folder-sync-analysis.ts` | Minor updates to `printFolderSyncAnalysis()` for improved display |
| `docs/template/template-sync/template-sync.md` | Update documentation with new features |

## Notes

### Trade-offs Considered

1. **inquirer vs native readline**: The existing `cli-utils.ts` already provides excellent keyboard-navigable menus. Adding `inquirer` would add a dependency and require significant refactoring. Decision: **Extend existing cli-utils**.

2. **Auto-add behavior**: The task says to auto-add new template files unless in `projectOverrides`. However, this changes existing behavior where all changes require confirmation. Decision: **Add auto-add with a confirmation prompt by default, skippable with `--yes`**.

3. **"Contribute to template" implementation**: Full implementation would require creating PRs or branches in the template repo. Decision: **Mark files for contribution and inform user, defer actual contribution to a separate command/workflow**.

4. **Deletion handling**: Currently deletions happen silently in non-interactive mode. Decision: **In interactive mode, show deletions grouped and ask for confirmation. In `--yes` mode, delete as before**.

### Potential Challenges

1. **State management for batch operations**: Need to carefully track which files user chose "apply to all" for, and apply consistently. Solution: Create `InteractiveResolutionContext` to hold session state.

2. **CI compatibility**: The `--yes` flag and existing auto modes must continue working in CI. All new interactive features must be bypassed appropriately.

3. **Error recovery**: If user interrupts mid-resolution, partial state should be handled gracefully. The existing config save pattern should be preserved.

### Dependencies

- No new npm dependencies required
- Existing `cli-utils.ts` is sufficient for interactive prompts
- Changes are additive and backward compatible

### Critical Files for Implementation
- `scripts/template/sync-template/sync-template-tool.ts` - Main orchestration logic to refactor
- `scripts/template/sync-template/types/index.ts` - Core types to extend
- `scripts/template/sync-template/ui/prompts.ts` - Existing prompt infrastructure to build upon
- `scripts/template/cli-utils.ts` - Interactive selection utilities to leverage
- `scripts/template/sync-template/sync/operations.ts` - Sync operations to extend with new resolution types
