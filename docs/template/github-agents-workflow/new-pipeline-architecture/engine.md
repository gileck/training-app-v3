---
title: Pipeline Engine
summary: Pipeline engine interface, concurrency model, dual-write pattern, and agent integration for executing validated state transitions.
---

# Pipeline Engine

## Interface

```typescript
interface IPipelineEngine {
  /**
   * Returns all transitions valid from the item's current status,
   * optionally filtered by trigger type.
   */
  getValidTransitions(issueNumber: number, trigger?: TransitionTrigger): Promise<PipelineTransition[]>;

  /**
   * Checks whether a specific transition can execute.
   * Runs all guards and returns the result without side effects.
   */
  canTransition(issueNumber: number, transitionId: string, context?: TransitionContext): Promise<{ valid: boolean; reason?: string }>;

  /**
   * Executes a transition: validates state, runs guards, executes before-hooks,
   * performs dual-write, executes after-hooks, appends history.
   */
  transition(issueNumber: number, transitionId: string, context: TransitionContext): Promise<TransitionResult>;

  /**
   * Returns the transition history for a workflow item.
   */
  getHistory(issueNumber: number): Promise<HistoryEntry[]>;

  /**
   * Updates review status within the current pipeline status.
   * Validates against the ReviewFlowDefinition for the current status.
   */
  updateReviewStatus(issueNumber: number, reviewStatus: string, context?: TransitionContext): Promise<TransitionResult>;

  /**
   * Resolves and executes a transition by trigger instead of transition ID.
   * Finds all transitions matching trigger + from(currentStatus), runs
   * multi-match guard resolution, and delegates to transition().
   * Used by callers that know the trigger but not the specific transition ID
   * (e.g., merge wrappers calling with 'admin_merge_pr').
   */
  transitionByTrigger(issueNumber: number, trigger: string, context: TransitionContext): Promise<TransitionResult>;

  /**
   * Called when an agent completes work. Resolves the appropriate transition
   * from the pipeline definition and delegates to transition().
   * Internally uses transitionByTrigger with 'agent_complete' trigger.
   */
  completeAgent(issueNumber: number, agentType: string, result: AgentCompletionResult): Promise<TransitionResult>;
}
```

## Execution Flow

### `engine.transition(issueNumber, transitionId, context)`

This is the core method. Every status change flows through it:

```
1. Load workflow item from DB (get current status, pipelineId, statusVersion)
2. Resolve pipeline definition (from pipelineId or item type)
3. Find transition by ID in pipeline definition (or use multi-match resolution if called via trigger)
4. Validate from-status:
   - If transition.from is a specific status: current status must match
   - If transition.from is '*': any status is valid
5. Resolve to-status:
   - If transition.to is a specific status: use it directly
   - If transition.to is '*': use context.restoreStatus (undo case)
6. Run all guards sequentially:
   - Each guard receives (item, transition, context)
   - If any guard returns { valid: false }, abort with reason
7. Run 'before' hooks in order:
   - Each hook receives (item, transition, context, hookParams)
   - If a non-optional hook throws, abort transition
   - Hook results are collected and passed to subsequent hooks via context.hookResults
8. Execute dual-write (see below):
   - adapter.updateItemStatus() for GitHub Projects
   - updateWorkflowFields() for MongoDB with statusVersion check
9. Run 'after' hooks in order:
   - Same signature as before hooks
   - Non-optional hook failures are logged but don't rollback the transition
   - Optional hook failures are logged at debug level
10. Append history entry to workflow-items document
11. Return TransitionResult with all collected data
```

### `engine.transitionByTrigger(issueNumber, trigger, context)`

Resolves and executes a transition by trigger instead of by explicit transition ID. This is the primary method for callers that know *what action* to perform but not *which specific transition* applies (e.g., merge wrappers, auto-advance):

```
1. Load workflow item from DB (get current status, pipelineId)
2. Resolve pipeline definition
3. Find all transitions matching trigger + from (current status or '*')
4. Use multi-match resolution: run guards on each candidate in order, pick first pass
5. If no candidate passes: return { success: false, reason: 'No matching transition for trigger' }
6. Delegate to engine.transition(issueNumber, resolvedTransitionId, context)
```

`completeAgent()` uses this internally with `trigger: 'agent_complete'`. Callers like the merge wrapper use it directly:

```typescript
// Merge wrapper — caller doesn't know which merge variant applies
await engine.transitionByTrigger(issueNumber, 'admin_merge_pr', {
  actor: 'admin',
  prNumber,
  commitMessage,
});
```

### `engine.completeAgent(issueNumber, agentType, result)`

Agents don't know about transition IDs — they report completion with a result object:

```typescript
interface AgentCompletionResult {
  status?: string;           // New status (e.g., STATUSES.prReview)
  reviewStatus?: string;     // New review status (e.g., REVIEW_STATUSES.waitingForReview)
  clearReviewStatus?: boolean;
}
```

The engine resolves the appropriate transition using `transitionByTrigger`:

1. Set `context.agentType` and `context.agentResult` from the completion result
2. Delegate to `engine.transitionByTrigger(issueNumber, 'agent_complete', context)`
3. `transitionByTrigger` handles multi-match resolution internally

The engine has **no agent-specific logic**. Disambiguation between agent completion variants (e.g., bug investigator normal completion vs auto-submit) is handled entirely by guards on the pipeline definition's transitions. For example, `agent-auto-submit-investigation` has a `guard:auto-submit-conditions-met` guard that checks the agent result; if it fails, the engine falls through to `agent-complete-investigation`.

This replaces the current `completeAgentRun()` which accepts arbitrary status values.

### `engine.updateReviewStatus(issueNumber, reviewStatus, context)`

Review status changes don't change the pipeline status but must be validated:

1. Load the item and its pipeline definition
2. Find the `ReviewFlowDefinition` for the current status
3. Validate the requested review status is valid for this status
4. Update review status via adapter and DB
5. If the review action triggers a transition (e.g., approve triggers `approve-design-{type}`), fire that transition
6. Return result

## Dual-Write Pattern

The current system maintains two parallel status stores. The engine preserves this:

1. **GitHub Projects adapter** (`adapter.updateItemStatus()`):
   - Updates the Status field on the GitHub Projects item
   - Updates the Review Status custom field
   - Updates the Implementation Phase field
   - Source of truth for GitHub UI visibility

2. **MongoDB workflow-items** (`updateWorkflowFields()`):
   - Updates `status`, `reviewStatus`, `implementationPhase` fields
   - Maintains `history` array
   - Source of truth for the web UI and API queries

Both writes happen within `engine.transition()`, after before-hooks and before after-hooks. If the adapter write succeeds but the DB write fails (or vice versa), the after-hooks still run but the result includes an error. The `sync-workflow-status` hook (run periodically) reconciles any drift.

The engine returns a generic `TransitionResult` containing only engine-level fields (`success`, `previousStatus`, `newStatus`, `transitionId`) plus the raw `hookResults` array. The engine never interprets hook return data — domain-specific values like merge commit SHAs, created PR numbers, or phase info are returned by hooks in their `data` field and extracted by callers using `getHookData()` (see [pipeline-schema.md](./pipeline-schema.md#transitionresult)).

## Multi-Match Resolution

When the engine finds multiple transitions matching the same `trigger + from`, it uses **guard-based resolution** instead of hardcoded logic:

1. Collect all transitions matching `trigger` and `from` (current status or `'*'`)
2. For each candidate transition (in pipeline definition order):
   a. Run all guards for this transition
   b. If all guards pass → select this transition
   c. If any guard fails → skip to next candidate
3. If no candidate passes all guards → return `{ valid: false, reason: 'No matching transition' }`

This keeps the engine **fully generic** — it never inspects domain-specific fields like phase artifacts or agent results. All disambiguation logic lives in the pipeline definition's guards.

**Example: Merge transition resolution.** Three transitions share `trigger: admin_merge_pr` and `from: PR Review`. Each has a phase-inspection guard:
- `merge-impl-pr` → `guard:is-single-phase` (no phases or single phase)
- `merge-impl-pr-next-phase` → `guard:is-middle-phase` (more phases remaining)
- `merge-impl-pr-final` → `guard:is-final-phase` (last phase)

The engine runs guards on each in order and picks the first pass. The pipeline definition declares the disambiguation; the engine just evaluates guards.

**Example: Agent completion resolution.** Two transitions share `trigger: agent_complete` and `from: Bug Investigation`:
- `agent-auto-submit-investigation` → `guard:auto-submit-conditions-met` (checks auto-submit flag, confidence, complexity)
- `agent-complete-investigation` → no special guards (fallback)

The auto-submit transition is listed first. If its guard passes, the agent auto-routes. If not, the normal completion transition is selected.

## Concurrency Control

The current system has no concurrency protection — two simultaneous requests can both read the same status and both attempt transitions, leading to invalid states (e.g., double-approving, merging an already-merged PR).

The engine adds optimistic concurrency via a `statusVersion` field:

```typescript
// On read
const item = await getWorkflowItem(issueNumber);
const expectedVersion = item.statusVersion ?? 0;

// On write (inside engine.transition)
const result = await collection.updateOne(
  { _id: item._id, statusVersion: expectedVersion },
  {
    $set: {
      status: newStatus,
      statusVersion: expectedVersion + 1,
      // ...other fields
    }
  }
);

if (result.modifiedCount === 0) {
  // Another transition happened between read and write
  throw new ConcurrentModificationError(issueNumber, expectedVersion);
}
```

This is lightweight — no distributed locks, no SQLite transactions. The `statusVersion` field is added as an optional field (defaults to 0 for existing documents), so the migration is backward-compatible.

The `guard:concurrent-version-check` guard validates the version before running hooks, providing an early failure path.

## Agent Integration

### Current Pattern

Agents call `completeAgentRun()` at the end of their work:

```typescript
// implementAgent/index.ts
await completeAgentRun(issueNumber, 'implementation', {
  status: STATUSES.prReview,
  reviewStatus: REVIEW_STATUSES.waitingForReview,
});
```

### New Pattern

Agents call `engine.completeAgent()`:

```typescript
// implementAgent/index.ts
await engine.completeAgent(issueNumber, 'implementation', {
  status: STATUSES.prReview,
  reviewStatus: REVIEW_STATUSES.waitingForReview,
});
```

The interface is nearly identical, but internally the engine resolves the correct transition from the pipeline definition, runs guards, and executes hooks. The agent doesn't need to know about transition IDs.

During migration, `completeAgentRun()` becomes a thin wrapper:

```typescript
export async function completeAgentRun(
  issueNumber: number,
  agentType: string,
  result: AgentCompletionResult
): Promise<ServiceResult> {
  const engine = await getPipelineEngine();
  return engine.completeAgent(issueNumber, agentType, result);
}
```

## Error Handling

The engine follows the existing project pattern (see [error-handling.md](../../error-handling.md)):

- Guard failures return `{ success: false, error: 'Guard guard:item-exists failed: item not found' }`
- Before-hook failures abort the transition and return `{ success: false, error: 'Hook hook:create-github-issue failed: ...' }`
- After-hook failures are logged but the transition result is still `{ success: true }` (with hook errors in `hookResults`)
- Concurrent modification errors return `{ success: false, error: 'Concurrent modification: expected version 3, found 4' }`
- All errors use `cleanErrorMessage()` for user-facing messages

## Pipeline Resolution

The engine determines which pipeline definition to use for an item:

1. **Explicit pipelineId**: If the workflow item has a `pipelineId` field, use that
2. **Type-based fallback**: Map `item.type` to pipeline — `'feature'` → FEATURE_PIPELINE, `'bug'` → BUG_PIPELINE, `'task'` → FEATURE_PIPELINE (tasks use the feature pipeline)
3. **Default**: If no type match, throw — every item must have a valid pipeline

During migration, existing items won't have `pipelineId`. The type-based fallback handles this. New items created after the migration get `pipelineId` set during the approve transition's `after` hook.
