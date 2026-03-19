---
title: "Phase 2: Guards and Hooks"
summary: Extract all precondition checks and side effects from current workflow-service functions into standalone guard and hook modules.
---

# Phase 2: Guards and Hooks

## Goal

Extract the 19 guards and 38 hooks from existing workflow-service functions into standalone, registered modules. After this phase, all guards and hooks exist as reusable functions but are not yet called by the engine.

## Dependencies

Phase 1 (types must exist for guard/hook function signatures).

## Tasks

### Guard Extraction

- [ ] **2.1** Create `src/server/template/workflow-service/pipeline/guards/item-guards.ts`
  - Extract `guard:item-exists` — from `findItemByIssueNumber()` pattern used in every function
  - Extract `guard:not-double-approved` — from `approve.ts` check for existing `githubIssueUrl`
  - Extract `guard:in-design-phase` — from `design-review.ts` status check (Product Dev, Product Design, Bug Investigation, Tech Design)
  - Extract `guard:github-synced` — from `route.ts` check for `githubProjectItemId`
  - Extract `guard:not-github-synced` — from `delete.ts` check for no `githubIssueUrl`
  - Extract `guard:valid-routing-destination` — from `route.ts` routing map validation
  - Extract `guard:waiting-for-clarification` — from `clarification.ts` review status check
  - Extract `guard:has-approved-review-status` — from `auto-advance.ts` check for Approved review status + valid transition target
  - Extract `guard:is-single-phase` — NEW guard for multi-match resolution: item has no phases or `phases.length <= 1`
  - Extract `guard:is-middle-phase` — NEW guard for multi-match resolution: item has multiple phases and current phase is not the last
  - Extract `guard:is-final-phase` — NEW guard for multi-match resolution: item has multiple phases and current phase is the last

- [ ] **2.2** Create `src/server/template/workflow-service/pipeline/guards/pr-guards.ts`
  - Extract `guard:pr-exists` — from `merge-pr.ts` PR resolution logic (context, artifacts, or latest PR)
  - Extract `guard:commit-message-exists` — from `merge-pr.ts` commit message lookup (DB or PR comment)
  - Extract `guard:pr-open-and-not-merged` — from `revert.ts` PR state validation
  - Extract `guard:merge-commit-sha-valid` — from `revert.ts` SHA validation

- [ ] **2.3** Create `src/server/template/workflow-service/pipeline/guards/undo-guards.ts`
  - Extract `guard:undo-window-valid` — from `undo.ts` time window check against `DEFAULT_UNDO_WINDOW_MS`

- [ ] **2.4** Create `src/server/template/workflow-service/pipeline/guards/decision-guards.ts`
  - Extract `guard:decision-exists` — from `choose-recommended.ts` decision data validation (DB-first, fallback to comment parsing)
  - Extract `guard:auto-submit-conditions-met` — NEW guard for multi-match resolution: checks `autoSubmit: true`, high confidence, S complexity, destination=implement, recommended option exists

- [ ] **2.5** Create `src/server/template/workflow-service/pipeline/guards/concurrency-guards.ts`
  - Create `guard:concurrent-version-check` — NEW guard, validates `statusVersion` matches expected value

### Hook Extraction

- [ ] **2.6** Create `src/server/template/workflow-service/pipeline/hooks/github-hooks.ts`
  - Extract `hook:create-github-issue` — from `approve.ts` github-sync call
  - Extract `hook:close-github-issue` — from `delete.ts` issue close + comment
  - Extract `hook:add-issue-comment` — from multiple files (artifact updates, phase progress, decisions)
  - Extract `hook:delete-pr-branch` — from `merge-pr.ts` and `merge-final-pr.ts` branch deletion
  - Extract `hook:create-revert-pr` — from `revert.ts` revert PR creation
  - Extract `hook:create-final-pr` — from `merge-pr.ts` final PR creation (multi-phase)
  - Extract `hook:merge-pr` — from `merge-pr.ts` squash merge with commit message
  - Extract `hook:merge-final-pr` — from `merge-final-pr.ts` final PR merge
  - Extract `hook:close-design-prs` — from `advance.ts` (markDone) design PR cleanup
  - Extract `hook:merge-revert-pr` — from `revert.ts` revert PR merge

- [ ] **2.7** Create `src/server/template/workflow-service/pipeline/hooks/db-hooks.ts`
  - Extract `hook:sync-workflow-status` — from `utils.ts` `syncWorkflowStatus()` call
  - Extract `hook:clear-review-status-db` — from `review-status.ts` clear pattern
  - Extract `hook:update-source-doc-status` — from `advance.ts` (markDone) source doc update
  - Extract `hook:revert-source-doc-status` — from `revert.ts` source doc status revert
  - Extract `hook:delete-source-doc` — from `delete.ts` source document deletion
  - Extract `hook:delete-workflow-item` — from `delete.ts` orphan cleanup
  - Extract `hook:save-design-artifact` — from `approve-design.ts` artifact save
  - Extract `hook:save-phase-artifact` — from `merge-pr.ts` phase status update
  - Extract `hook:set-last-merged-pr` — from `merge-pr.ts` last merged PR info
  - Extract `hook:set-final-pr-number` — from `merge-pr.ts` final PR number save
  - Extract `hook:set-revert-pr-number` — from `revert.ts` revert PR number persist
  - Extract `hook:clear-revert-pr-number` — from `revert.ts` revert PR number cleanup
  - Extract `hook:save-decision-selection` — from `choose-recommended.ts` and `decision.ts`

- [ ] **2.8** Create `src/server/template/workflow-service/pipeline/hooks/s3-hooks.ts`
  - Extract `hook:read-design-from-s3` — from `approve-design.ts` S3 read
  - Extract `hook:delete-s3-design-files` — from `advance.ts` (markDone) S3 cleanup

- [ ] **2.9** Create `src/server/template/workflow-service/pipeline/hooks/phase-hooks.ts`
  - Extract `hook:initialize-phases` — from `approve-design.ts` phase parsing + initialization
  - Extract `hook:advance-implementation-phase` — from `phase.ts` and `merge-pr.ts` phase advancement
  - Extract `hook:clear-implementation-phase` — from `phase.ts` and `advance.ts` (markDone)
  - Extract `hook:clean-up-task-branch` — from `merge-final-pr.ts` branch cleanup

- [ ] **2.10** Create `src/server/template/workflow-service/pipeline/hooks/notify-hooks.ts`
  - Extract `hook:notify-approved` — from `approve.ts` Telegram notification
  - Extract `hook:notify-routed` — from `route.ts` Telegram notification
  - Extract `hook:notify-deleted` — from `delete.ts` Telegram notification
  - Extract `hook:notify-decision-submitted` — from `choose-recommended.ts` and `decision.ts`
  - Extract `hook:notify-auto-advance` — from `auto-advance.ts` Telegram notification
  - Extract `hook:post-decision-comment` — from `choose-recommended.ts` GitHub comment

- [ ] **2.11** Create `src/server/template/workflow-service/pipeline/hooks/log-hooks.ts`
  - Extract `hook:agent-log` — from multiple files `logWebhookAction()` + `logPhaseEnd()`/`logPhaseStart()` calls
  - Extract `hook:history-log` — from multiple files `logHistory()` / history entry append
  - Extract `hook:sync-log-to-repo` — from `advance.ts` (markDone) log sync

### Registration

- [ ] **2.12** Update `src/server/template/workflow-service/pipeline/registry.ts`:
  - Import all guard modules
  - Import all hook modules
  - Register all guards and hooks in `createRegistries()`

### Validation

- [ ] **2.13** Run `yarn checks` — zero errors

- [ ] **2.14** Run E2E tests — all pass (guards/hooks extracted but not yet called by engine)

## Files to Create

```
src/server/template/workflow-service/pipeline/guards/
  item-guards.ts
  pr-guards.ts
  undo-guards.ts
  decision-guards.ts
  concurrency-guards.ts

src/server/template/workflow-service/pipeline/hooks/
  github-hooks.ts
  db-hooks.ts
  s3-hooks.ts
  phase-hooks.ts
  notify-hooks.ts
  log-hooks.ts
```

## Files to Modify

```
src/server/template/workflow-service/pipeline/registry.ts  (register all guards + hooks)
```

## Extraction Guidelines

When extracting guards and hooks:

1. **Don't duplicate code** — the hook/guard function should call the same utility functions the original code calls. Just wrap the call pattern in the hook function signature.
2. **Pass dependencies via context** — hooks may need the adapter, DB collection, or other services. These should be resolved inside the hook function (same pattern as current code) rather than passed as parameters.
3. **Return structured results** — hooks return `HookResult` with `success`, `error`, and `data` fields. The `data` field carries operation-specific return values (e.g., merge commit SHA, PR URL) that subsequent hooks or the engine may need.
4. **Keep the original functions intact** — this phase only creates new files. The original function bodies remain unchanged and continue to work. Phase 5 will replace them with engine calls.

## Validation

1. `yarn checks` passes with zero errors
2. All existing E2E tests pass without modification
3. All guard and hook IDs can be validated against the registry at import time
4. No circular dependencies introduced between pipeline/ and existing workflow-service files

## Rollback

Delete the new guard and hook files and revert registry.ts to empty registrations. No behavior was changed.
