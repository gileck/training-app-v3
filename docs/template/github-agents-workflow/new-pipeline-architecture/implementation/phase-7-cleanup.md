---
title: "Phase 7: Cleanup"
summary: Remove deprecated function bodies, old constants, and unused code after all callers have been migrated to the pipeline engine.
---

# Phase 7: Cleanup

## Goal

Remove the old function bodies (now dead code behind wrapper functions), deprecated constants, and unused imports. After this phase, the codebase is clean with no dual implementations.

## Dependencies

Phase 6 (all callers verified working with engine wrappers).

## Tasks

### Remove Old Function Bodies

- [ ] **7.1** Clean up entry operations:
  - `approve.ts` — remove old function body, keep wrapper export (or inline into index.ts)
  - `route.ts` — same
  - `delete.ts` — same

- [ ] **7.2** Clean up mid-pipeline operations:
  - `advance.ts` — remove old `advanceStatus` and `markDone` bodies
  - `review-status.ts` — remove old `updateReviewStatus` and `clearReviewStatus` bodies
  - `set-status.ts` — remove old `setWorkflowStatus` body
  - `phase.ts` — remove old `advanceImplementationPhase` and `clearImplementationPhase` bodies
  - `agent-complete.ts` — remove old `completeAgentRun` body
  - `decision.ts` — remove old `submitDecisionRouting` body
  - `undo.ts` — remove old `undoStatusChange` body
  - `auto-advance.ts` — remove old `autoAdvanceApproved` body

- [ ] **7.3** Clean up design and review operations:
  - `design-review.ts` — remove old `reviewDesign` body
  - `clarification.ts` — remove old `markClarificationReceived` body
  - `request-changes.ts` — remove old `requestChangesOnPR` body
  - `request-changes-design.ts` — remove old `requestChangesOnDesignPR` body
  - `choose-recommended.ts` — remove old `chooseRecommendedOption` body

- [ ] **7.4** Clean up merge and revert operations:
  - `approve-design.ts` — remove old `approveDesign` body
  - `merge-design-pr.ts` — remove entirely (already DEPRECATED, `approveDesign` replaces it)
  - `merge-pr.ts` — remove old `mergeImplementationPR` body (362 lines → thin wrapper)
  - `merge-final-pr.ts` — remove old `mergeFinalPR` body
  - `revert.ts` — remove old `revertMerge` and `mergeRevertPR` bodies

### Remove Deprecated Constants

- [ ] **7.5** Clean up `constants.ts`:
  - `STATUS_TRANSITIONS` map — superseded by pipeline transition definitions
  - `FEATURE_ROUTING_STATUS_MAP` — superseded by pipeline routing transitions
  - `BUG_ROUTING_STATUS_MAP` — superseded by pipeline routing transitions
  - `ROUTING_DESTINATION_LABELS` — may still be needed by UI; keep if used, remove if not
  - `getRoutingStatusMap()` — superseded by pipeline definitions
  - `statusToDestination()` — evaluate if still needed by any UI code
  - **Decision**: Keep labels and UI-facing utilities if they're imported by client code. Remove only the internal routing/transition maps.

### Update Exports

- [ ] **7.6** Update `index.ts` exports:
  - Ensure all wrapper functions are exported
  - Add engine exports: `getPipelineEngine`, `getPipelineForType`, `getAllPipelines`
  - Remove exports for deprecated internal functions (if any were exported)
  - Verify no external caller uses removed exports

### Clean Up Imports

- [ ] **7.7** Remove unused imports across all cleaned-up files:
  - Old utility imports no longer needed (direct adapter calls, DB operations)
  - Old constant imports replaced by pipeline definitions
  - Dead code in utility functions (`utils.ts`) that only the old implementations called
  - Dead code in `notify.ts` — notification functions replaced by `hook:notify-*` hooks

### Validation

- [ ] **7.8** Run `yarn checks`:
  - Zero TypeScript errors
  - Zero ESLint errors
  - Zero circular dependency warnings
  - Zero unused dependency warnings

- [ ] **7.9** Run full E2E suite — all tests must pass

### Documentation Update

Update CLAUDE.md to reference the new pipeline architecture:

Note: This is tracked but executed via `yarn build:claude` after updating the doc frontmatter. The overview.md file in this design doc folder already has appropriate frontmatter for inclusion.

## Files to Modify

```
src/server/template/workflow-service/
  approve.ts
  route.ts
  delete.ts
  advance.ts
  review-status.ts
  set-status.ts
  phase.ts
  agent-complete.ts
  decision.ts
  undo.ts
  auto-advance.ts
  design-review.ts
  clarification.ts
  request-changes.ts
  request-changes-design.ts
  choose-recommended.ts
  approve-design.ts
  merge-pr.ts
  merge-final-pr.ts
  revert.ts
  notify.ts
  constants.ts
  index.ts
  utils.ts
```

## Files to Potentially Delete

```
src/server/template/workflow-service/merge-design-pr.ts  (already DEPRECATED)
```

## Cleanup Guidelines

1. **Keep wrapper functions** — external callers import these by name. The wrapper pattern is intentional so callers don't need to know about the engine.
2. **Keep the file structure** — each file still exists with its wrapper function. This maintains import compatibility.
3. **Don't consolidate prematurely** — it's tempting to merge all wrappers into a single file, but keeping them separate matches the import patterns callers already use.
4. **Remove aggressively from function bodies** — the old 50–362 line function bodies are now 5–15 line wrappers. Remove all the old logic.
5. **Test after each file** — after cleaning each file, run `yarn checks` to catch import errors immediately.

## Validation

1. `yarn checks` passes with zero errors in all 4 categories
2. Full E2E suite passes
3. `git diff --stat` shows significant line reduction (expect ~2000+ lines removed)
4. No external caller modifications needed (all imports still resolve)

## Rollback

Restore removed code from git. Since the wrapper functions still call the engine, restoring old function bodies would create dead code but wouldn't break anything. The wrapper function call takes precedence.
