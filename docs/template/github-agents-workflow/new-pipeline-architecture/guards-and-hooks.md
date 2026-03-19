---
title: Guards and Hooks
summary: Complete catalog of guards (precondition checks) and hooks (side effects) extracted from current workflow-service functions, with registry design and function mapping table.
---

# Guards and Hooks

## Registry Design

Guards and hooks are registered in a central registry at application startup:

```typescript
// pipeline/registry.ts
interface GuardFunction {
  (item: WorkflowItem, transition: PipelineTransition, context: TransitionContext): Promise<{ valid: boolean; reason?: string }>;
}

interface HookFunction {
  (item: WorkflowItem, transition: PipelineTransition, context: TransitionContext, params?: Record<string, unknown>): Promise<HookResult>;
}

interface HookResult {
  success: boolean;
  error?: string;
  data?: unknown;  // Hook-specific return data (e.g., merge commit SHA, PR URL)
}

class GuardRegistry {
  private guards = new Map<string, GuardFunction>();
  register(id: string, fn: GuardFunction): void;
  get(id: string): GuardFunction;
  has(id: string): boolean;
  validateAll(ids: string[]): void;  // Throws if any ID not registered
}

class HookRegistry {
  private hooks = new Map<string, HookFunction>();
  register(id: string, fn: HookFunction): void;
  get(id: string): HookFunction;
  has(id: string): boolean;
  validateAll(ids: string[]): void;  // Throws if any ID not registered
}
```

At startup, the engine validates that every guard and hook ID referenced in pipeline definitions is registered. This catches typos and missing registrations at boot time, not at runtime.

## Guard Catalog

19 guards total: 14 extracted from current workflow-service functions, 5 new for multi-match resolution and concurrency control:

### Item Guards (`pipeline/guards/item-guards.ts`)

| Guard ID | Derived From | Logic | Used By |
|----------|-------------|-------|---------|
| `guard:item-exists` | Every function | Workflow item exists in GitHub Projects (via `findItemByIssueNumber`) | All transitions except `approve` (item doesn't exist in GitHub Projects yet during approval) |
| `guard:not-double-approved` | `approve.ts` | Item doesn't have `githubIssueUrl` (prevents re-approval) | `approve` transition |
| `guard:in-design-phase` | `design-review.ts` | Current status is a design phase (Product Dev, Product Design, Bug Investigation, Tech Design) | Design review transitions |
| `guard:github-synced` | `route.ts` | Item has `githubProjectItemId` (was synced to GitHub Projects) | Routing transitions |
| `guard:not-github-synced` | `delete.ts` | Item does NOT have `githubIssueUrl` (safe to delete without force) | Delete transition |
| `guard:valid-routing-destination` | `route.ts` | Destination is in the routing map for this item type | Routing transitions |
| `guard:waiting-for-clarification` | `clarification.ts` | Item's review status is `Waiting for Clarification` | Clarification received transition |
| `guard:has-approved-review-status` | `auto-advance.ts` | Item's review status is `Approved` and status is not `Done` and status has a defined transition in STATUS_TRANSITIONS | Auto-advance transitions |
| `guard:is-single-phase` | `merge-pr.ts` | Item has no phases or single phase (`!item.artifacts?.phases \|\| phases.length <= 1`) | `merge-impl-pr` (multi-match disambiguation) |
| `guard:is-middle-phase` | `merge-pr.ts` | Item has multiple phases and current phase is not the last one | `merge-impl-pr-next-phase` (multi-match disambiguation) |
| `guard:is-final-phase` | `merge-pr.ts` | Item has multiple phases and current phase is the last one | `merge-impl-pr-final` (multi-match disambiguation) |

### PR Guards (`pipeline/guards/pr-guards.ts`)

| Guard ID | Derived From | Logic | Used By |
|----------|-------------|-------|---------|
| `guard:pr-exists` | `merge-pr.ts` | PR number is resolvable (from context, artifacts, or latest PR) | Merge transitions |
| `guard:commit-message-exists` | `merge-pr.ts` | Commit message exists in DB or PR comment | Merge transitions |
| `guard:pr-open-and-not-merged` | `revert.ts` | Revert PR is open (not closed, not already merged) | Merge revert transition |
| `guard:merge-commit-sha-valid` | `revert.ts` | Merge commit SHA exists and prefix matches `shortSha` if provided | Revert transition |

### Undo Guards (`pipeline/guards/undo-guards.ts`)

| Guard ID | Derived From | Logic | Used By |
|----------|-------------|-------|---------|
| `guard:undo-window-valid` | `undo.ts` | Current time is within `DEFAULT_UNDO_WINDOW_MS` (5 min) of the action timestamp | Undo transitions |

### Decision Guards (`pipeline/guards/decision-guards.ts`)

| Guard ID | Derived From | Logic | Used By |
|----------|-------------|-------|---------|
| `guard:decision-exists` | `choose-recommended.ts` | Decision data exists (DB-first, fallback to GitHub comment parsing) with a recommended option | Choose recommended transition |
| `guard:auto-submit-conditions-met` | `choose-recommended.ts`, bug investigator | Agent result has `autoSubmit: true`, high confidence, S complexity, destination is implement, recommended option exists | `agent-auto-submit-investigation` (multi-match disambiguation) |

### Concurrency Guards (`pipeline/guards/concurrency-guards.ts`)

| Guard ID | Derived From | Logic | Used By |
|----------|-------------|-------|---------|
| `guard:concurrent-version-check` | NEW | `item.statusVersion` matches `context.statusVersion` (optimistic concurrency) | All transitions (implicit) |

## Hook Catalog

38 hooks derived from current side effects, organized by concern domain:

### GitHub Hooks (`pipeline/hooks/github-hooks.ts`)

| Hook ID | Derived From | Phase | Logic |
|---------|-------------|-------|-------|
| `hook:create-github-issue` | `approve.ts` | before | Creates GitHub issue via github-sync, returns issue number/URL/projectItemId |
| `hook:close-github-issue` | `delete.ts` | after | Closes GitHub issue and adds deletion comment (fire-and-forget) |
| `hook:add-issue-comment` | Multiple files | after | Posts a comment to the GitHub issue (artifact updates, phase progress, decisions) |
| `hook:delete-pr-branch` | `merge-pr.ts`, `merge-final-pr.ts` | after | Deletes the PR head branch after merge |
| `hook:create-revert-pr` | `revert.ts` | before | Creates a revert PR for the merge commit SHA |
| `hook:create-final-pr` | `merge-pr.ts` | after | Creates final PR from feature branch to main (multi-phase final) |
| `hook:merge-pr` | `merge-pr.ts` | before | Squash-merges the implementation PR with saved commit message |
| `hook:merge-final-pr` | `merge-final-pr.ts` | before | Merges the final PR; handles already-merged gracefully |
| `hook:close-design-prs` | `advance.ts` (markDone) | after | Closes any open design PRs (never merged in S3 flow) |
| `hook:merge-revert-pr` | `revert.ts` | before | Merges the revert PR |

### Database Hooks (`pipeline/hooks/db-hooks.ts`)

| Hook ID | Derived From | Phase | Logic |
|---------|-------------|-------|-------|
| `hook:sync-workflow-status` | `utils.ts` (`syncWorkflowStatus`) | after | Syncs status/reviewStatus/phase to workflow-items MongoDB collection |
| `hook:clear-review-status-db` | `review-status.ts` | after | Clears review status in both adapter and workflow-items |
| `hook:update-source-doc-status` | `advance.ts` (markDone) | after | Updates source document status (feature→done, bug→resolved) |
| `hook:revert-source-doc-status` | `revert.ts` | after | Reverts source document status (feature→in_progress, bug→investigating) |
| `hook:delete-source-doc` | `delete.ts` | before | Deletes the source document (feature-request or report) |
| `hook:delete-workflow-item` | `delete.ts` | after | Cleans up orphaned workflow-items entries |
| `hook:save-design-artifact` | `approve-design.ts` | after | Saves design artifact to workflow-items (content, type, timestamp) |
| `hook:save-phase-artifact` | `merge-pr.ts` | after | Updates phase artifact status ("merged") in workflow-items |
| `hook:set-last-merged-pr` | `merge-pr.ts` | after | Saves last merged PR info to artifacts |
| `hook:set-final-pr-number` | `merge-pr.ts` | after | Saves final PR number to artifacts |
| `hook:set-revert-pr-number` | `revert.ts` | after | Persists revert PR number to workflow-items |
| `hook:clear-revert-pr-number` | `revert.ts` | after | Clears revert PR number after revert merge |
| `hook:save-decision-selection` | `choose-recommended.ts`, `decision.ts` | after | Saves decision selection to workflow-items artifacts |

### S3 Hooks (`pipeline/hooks/s3-hooks.ts`)

| Hook ID | Derived From | Phase | Logic |
|---------|-------------|-------|-------|
| `hook:read-design-from-s3` | `approve-design.ts` | before | Reads design document from S3 for the current design phase |
| `hook:delete-s3-design-files` | `advance.ts` (markDone) | after | Deletes all S3 design files for the item |

### Phase Hooks (`pipeline/hooks/phase-hooks.ts`)

| Hook ID | Derived From | Phase | Logic |
|---------|-------------|-------|-------|
| `hook:initialize-phases` | `approve-design.ts` | after | Parses tech design for phases, initializes implementation phase tracking |
| `hook:advance-implementation-phase` | `phase.ts`, `merge-pr.ts` | after | Advances to next implementation phase (e.g., "1/3" → "2/3") |
| `hook:clear-implementation-phase` | `phase.ts`, `advance.ts` (markDone) | after | Clears implementation phase field |
| `hook:clean-up-task-branch` | `merge-final-pr.ts` | after | Deletes task branch and all phase branches |

### Notification Hooks (`pipeline/hooks/notify-hooks.ts`)

| Hook ID | Derived From | Phase | Logic |
|---------|-------------|-------|-------|
| `hook:notify-approved` | `approve.ts` | after | Sends Telegram notification that item needs routing |
| `hook:notify-routed` | `route.ts` | after | Sends Telegram notification with routing destination |
| `hook:notify-deleted` | `delete.ts` | after | Sends Telegram notification of deletion |
| `hook:notify-decision-submitted` | `choose-recommended.ts`, `decision.ts` | after | Sends Telegram notification of decision selection |
| `hook:notify-auto-advance` | `auto-advance.ts` | after | Sends Telegram notification of auto-advance |
| `hook:post-decision-comment` | `choose-recommended.ts` | after | Posts decision selection audit trail comment to GitHub |

### Logging Hooks (`pipeline/hooks/log-hooks.ts`)

| Hook ID | Derived From | Phase | Logic |
|---------|-------------|-------|-------|
| `hook:agent-log` | Multiple files | after | Logs webhook action + phase start/end to agent-logs/issue-N.md |
| `hook:history-log` | Multiple files | after | Appends history entry to workflow-items document |
| `hook:sync-log-to-repo` | `advance.ts` (markDone) | after | Syncs agent log file to the repository (non-blocking) |

## Function → Transition + Guards + Hooks Mapping

Complete mapping of every current exported function to its pipeline engine equivalent:

| Current Function | Transition ID(s) | Guards | Before Hooks | After Hooks |
|-----------------|-------------------|--------|--------------|-------------|
| `approveWorkflowItem()` | `approve` | not-double-approved | create-github-issue | sync-workflow-status, agent-log, history-log, notify-approved |
| `routeWorkflowItem()` | `route-to-{dest}` (one per destination) | item-exists, github-synced, valid-routing-destination | — | clear-review-status-db, sync-workflow-status, agent-log, history-log, notify-routed |
| `deleteWorkflowItem()` | `delete` | not-github-synced (unless force) | delete-source-doc | delete-workflow-item, close-github-issue, notify-deleted |
| `advanceStatus()` | Subsumed by specific transitions | item-exists | — | sync-workflow-status, agent-log, history-log |
| `markDone()` | `manual-mark-done` | item-exists | — | clear-review-status-db, clear-implementation-phase, sync-workflow-status, update-source-doc-status, close-design-prs, delete-s3-design-files, agent-log, history-log, sync-log-to-repo |
| `updateReviewStatus()` | `engine.updateReviewStatus()` | item-exists | — | agent-log |
| `clearReviewStatus()` | `engine.updateReviewStatus(null)` | item-exists | — | agent-log |
| `setWorkflowStatus()` | `manual-status-set` | item-exists | — | sync-workflow-status, history-log |
| `advanceImplementationPhase()` | Subsumed by `merge-impl-pr-next-phase` | item-exists | — | advance-implementation-phase, sync-workflow-status, agent-log |
| `clearImplementationPhase()` | Subsumed by `manual-mark-done` | item-exists | — | clear-implementation-phase, agent-log |
| `completeAgentRun()` | `engine.completeAgent()` → multi-match resolution by guards | item-exists | — | sync-workflow-status, agent-log, history-log |
| `submitDecisionRouting()` | `bug-decision-to-{dest}` | item-exists | — | save-decision-selection, sync-workflow-status, agent-log, history-log |
| `undoStatusChange()` | `undo-action` (from: '*', to: '*') | undo-window-valid | — | sync-workflow-status, agent-log, history-log |
| `autoAdvanceApproved()` | `approve-design-{type}` (batch) | item-exists, has-approved-review-status | read-design-from-s3 | save-design-artifact, clear-review-status-db, sync-workflow-status, agent-log, history-log |
| `reviewDesign()` | Handled via `engine.updateReviewStatus()` → ReviewFlowDefinition triggers `approve-design-{type}` on approve | item-exists, in-design-phase | read-design-from-s3 | save-design-artifact, sync-workflow-status, agent-log, history-log |
| `markClarificationReceived()` | `clarification-received` | item-exists, waiting-for-clarification | — | agent-log, history-log |
| `requestChangesOnPR()` | `pr-request-changes` | item-exists | — | sync-workflow-status, agent-log, history-log |
| `requestChangesOnDesignPR()` | `design-pr-request-changes` | item-exists | — | agent-log, history-log |
| `chooseRecommendedOption()` | `choose-recommended` | item-exists, decision-exists | — | save-decision-selection, post-decision-comment, sync-workflow-status, notify-decision-submitted, history-log |
| `approveDesign()` | `approve-design-{type}` | item-exists | read-design-from-s3 | save-design-artifact, add-issue-comment, initialize-phases (tech only), sync-workflow-status, agent-log, history-log |
| `mergeDesignPR()` | DEPRECATED — use `approveDesign()` | — | — | — |
| `mergeImplementationPR()` | `merge-impl-pr` / `merge-impl-pr-next-phase` / `merge-impl-pr-final` (multi-match resolution via is-single-phase / is-middle-phase / is-final-phase guards) | item-exists, pr-exists, commit-message-exists, + phase guard | merge-pr | save-phase-artifact, set-last-merged-pr, delete-pr-branch, advance-implementation-phase (multi), create-final-pr (final), add-issue-comment, sync-workflow-status, agent-log, history-log |
| `mergeFinalPR()` | `merge-final-pr` | item-exists, pr-exists | merge-final-pr | clean-up-task-branch, add-issue-comment, *then markDone hooks* |
| `revertMerge()` | `revert-merge` | item-exists, merge-commit-sha-valid | create-revert-pr | set-revert-pr-number, revert-source-doc-status, sync-workflow-status, agent-log, history-log |
| `mergeRevertPR()` | `merge-revert-pr` | item-exists, pr-open-and-not-merged | merge-revert-pr | clear-revert-pr-number, delete-pr-branch, agent-log, history-log |

## Guard and Hook Registration

All guards and hooks are registered in `pipeline/registry.ts`:

```typescript
// pipeline/registry.ts
import { itemGuards } from './guards/item-guards';
import { prGuards } from './guards/pr-guards';
import { undoGuards } from './guards/undo-guards';
import { decisionGuards } from './guards/decision-guards';
import { concurrencyGuards } from './guards/concurrency-guards';

import { githubHooks } from './hooks/github-hooks';
import { dbHooks } from './hooks/db-hooks';
import { s3Hooks } from './hooks/s3-hooks';
import { phaseHooks } from './hooks/phase-hooks';
import { notifyHooks } from './hooks/notify-hooks';
import { logHooks } from './hooks/log-hooks';

export function createRegistries() {
  const guards = new GuardRegistry();
  const hooks = new HookRegistry();

  // Register all guards
  for (const [id, fn] of Object.entries(itemGuards)) guards.register(id, fn);
  for (const [id, fn] of Object.entries(prGuards)) guards.register(id, fn);
  for (const [id, fn] of Object.entries(undoGuards)) guards.register(id, fn);
  for (const [id, fn] of Object.entries(decisionGuards)) guards.register(id, fn);
  for (const [id, fn] of Object.entries(concurrencyGuards)) guards.register(id, fn);

  // Register all hooks
  for (const [id, fn] of Object.entries(githubHooks)) hooks.register(id, fn);
  for (const [id, fn] of Object.entries(dbHooks)) hooks.register(id, fn);
  for (const [id, fn] of Object.entries(s3Hooks)) hooks.register(id, fn);
  for (const [id, fn] of Object.entries(phaseHooks)) hooks.register(id, fn);
  for (const [id, fn] of Object.entries(notifyHooks)) hooks.register(id, fn);
  for (const [id, fn] of Object.entries(logHooks)) hooks.register(id, fn);

  return { guards, hooks };
}
```
