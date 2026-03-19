---
title: "Phase 6: External Migration"
summary: Migrate all transport layer callers (Telegram handlers, API handlers, CLI, agents) from direct workflow-service function calls to engine-based calls.
---

# Phase 6: External Migration

## Goal

Migrate all external callers to use the engine (either directly or through the thin wrapper functions from Phase 5). After Phase 5, the wrapper functions already use the engine internally, so most callers don't need changes. This phase focuses on callers that bypass the wrapper functions or have transport-specific logic that should be simplified.

## Dependencies

Phase 5 (all internal functions are wrappers around the engine).

## Rationale

After Phase 5, all wrapper functions delegate to the engine. External callers that import and call these functions already use the engine transitively. The primary work in this phase is:

1. **Verifying** each caller still works correctly with the wrapper functions
2. **Simplifying** callers that do their own status validation (now handled by the engine)
3. **Migrating** callers that bypass wrapper functions (e.g., direct `updateWorkflowFields` calls)

## Tasks

### Telegram Handlers

- [ ] **6.1** Verify Telegram approval handlers (`src/pages/api/telegram-webhook/handlers/approval.ts`)
  - `handleFeatureRequestApproval` → calls `approveWorkflowItem()` (wrapper) — verify works
  - `handleBugReportApproval` → calls `approveWorkflowItem()` (wrapper) — verify works
  - `handleFeatureRequestDeletion` → calls `deleteWorkflowItem()` (wrapper) — verify works
  - `handleBugReportDeletion` → calls `deleteWorkflowItem()` (wrapper) — verify works

- [ ] **6.2** Verify Telegram routing handlers (`routing.ts`)
  - `handleFeatureRouting` → calls `routeWorkflowItem()` (wrapper) — verify works
  - `handleBugRouting` → calls `routeWorkflowItem()` (wrapper) — verify works

- [ ] **6.3** Verify Telegram merge handlers (`merge.ts`)
  - `handleMergeCallback` → calls `mergeImplementationPR()` (wrapper) — verify works
  - `handleMergeFinalPRCallback` → calls `mergeFinalPR()` (wrapper) — verify works
  - `handleRevertMerge` → calls `revertMerge()` (wrapper) — verify works
  - `handleMergeRevertPR` → calls `mergeRevertPR()` (wrapper) — verify works

- [ ] **6.4** Verify Telegram design-review handlers (`design-review.ts`, `design-pr.ts`)
  - `handleDesignReviewAction` → calls `reviewDesign()` (wrapper) — verify works
  - `handleDesignPRApproval` → calls `approveDesign()` (wrapper) — verify works
  - `handleDesignPRRequestChanges` → calls `requestChangesOnDesignPR()` (wrapper) — verify works
  - `handleRequestChangesCallback` → calls `requestChangesOnPR()` (wrapper) — verify works

- [ ] **6.5** Verify Telegram clarification handler (`clarification.ts`)
  - `handleClarificationReceived` → calls `markClarificationReceived()` (wrapper) — verify works

- [ ] **6.6** Verify Telegram undo handler (`undo.ts`)
  - `handleUndoRequestChanges` → calls `undoStatusChange()` (wrapper) — verify works
  - `handleUndoDesignChanges` → calls `undoStatusChange()` (wrapper) — verify works
  - `handleUndoDesignReview` → calls `undoStatusChange()` (wrapper) — verify works

- [ ] **6.7** Verify Telegram choose-recommended handler (`handle-choose-recommended.ts`)
  - `handleChooseRecommended` → calls `chooseRecommendedOption()` (wrapper) — verify works

### API Handlers

- [ ] **6.8** Verify API workflow action handler (`src/apis/template/workflow/handlers/workflowAction.ts`)
  - All 14 action cases call wrapper functions — verify each works
  - Simplify any action-specific status validation that the engine now handles

- [ ] **6.9** Verify API updateStatus handler (`updateStatus.ts`)
  - Fallback chain: `routeWorkflowItemByWorkflowId` → `advanceStatus` → `setWorkflowStatus`
  - All three are wrappers — verify the chain works

- [ ] **6.10** Verify API feature-request approve handler
  - Calls `approveWorkflowItem()` — verify works

- [ ] **6.11** Verify API bug-report approve handler
  - Calls `approveWorkflowItem()` — verify works

- [ ] **6.12** Verify API decision submit handler
  - Calls `submitDecisionRouting()` — verify works

### CLI

- [ ] **6.13** Verify CLI approve/route/create commands
  - Commands call wrapper functions — verify each works
  - `yarn agent-workflow start` → uses `approveWorkflowItem()`, `routeWorkflowItem()`

### Agents

- [ ] **6.14** Verify agent `completeAgentRun` calls:
  - `src/agents/core-agents/implementAgent/index.ts` → calls `completeAgentRun()` (wrapper) — verify works
  - `src/agents/core-agents/bugInvestigatorAgent/index.ts` → calls `completeAgentRun()` (wrapper) — verify auto-submit path works
  - `src/agents/core-agents/prReviewAgent/index.ts` → calls `completeAgentRun()` (wrapper) — verify works
  - `src/agents/shared/design-agent-processor.ts` → calls `completeAgentRun()` (wrapper) — verify works

- [ ] **6.15** Verify auto-advance (`src/agents/auto-advance.ts`)
  - Calls `autoAdvanceApproved()` (wrapper) — verify batch processing works

### E2E Validation

- [ ] **6.16** Run full E2E suite — all tests must pass

- [ ] **6.17** Smoke test via Telegram:
  - Approve a feature request → verify GitHub issue created
  - Route to Product Design → verify status changes
  - Verify agent picks up the item

- [ ] **6.18** Smoke test via UI:
  - Approve a bug report → verify auto-route to Bug Investigation
  - Submit decision → verify routing
  - Mark done → verify source doc updated

## Files to Potentially Modify

Most callers need **no changes** since they call wrapper functions. Files that might need changes:

```
src/pages/api/telegram-webhook/handlers/
  approval.ts          (simplify validation if any)
  routing.ts           (simplify validation if any)
  merge.ts             (simplify phase resolution if any)

src/apis/template/workflow/handlers/
  workflowAction.ts    (simplify action validation)
  updateStatus.ts      (simplify fallback chain)
```

## Key Insight

Phase 6 is largely a **verification phase**, not a code change phase. Since Phase 5 turned all workflow-service functions into engine wrappers, callers that import these functions automatically use the engine. The main work is:

1. Running all tests to confirm nothing broke
2. Removing redundant validation logic in transport handlers (now handled by engine guards)
3. Smoke testing the full flow via each transport (Telegram, UI, CLI)

## Validation

1. `yarn checks` passes
2. Full E2E suite passes
3. Telegram smoke test: approve → route → agent picks up → PR created → merge → Done
4. UI smoke test: approve bug → auto-route → investigation → decision → implementation → Done

## Rollback

Since most callers aren't modified, rollback means reverting any simplifications made to transport handlers. The wrapper functions can be individually reverted per Phase 5's rollback strategy.
