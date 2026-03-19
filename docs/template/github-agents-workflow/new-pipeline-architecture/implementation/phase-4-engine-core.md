---
title: "Phase 4: Engine Core"
summary: Implement the pipeline engine with transition validation, guard execution, hook orchestration, dual-write, and concurrency control.
---

# Phase 4: Engine Core

## Goal

Implement the `PipelineEngine` class methods so the engine can validate and execute transitions. After this phase, the engine is fully functional but no callers use it yet.

## Dependencies

Phase 1 (types, engine skeleton), Phase 2 (guards and hooks registered), Phase 3 (pipeline definitions exist).

## Tasks

- [ ] **4.1** Implement `PipelineEngine.getValidTransitions(issueNumber, trigger?)`
  - Load workflow item from DB
  - Resolve pipeline from `pipelineId` or item type
  - Filter transitions where `from` matches current status (or `from === '*'`)
  - Optionally filter by trigger type
  - Return matching transitions

- [ ] **4.2** Implement `PipelineEngine.canTransition(issueNumber, transitionId, context?)`
  - Load item, resolve pipeline, find transition by ID
  - Validate `from` matches current status (handle `'*'` wildcard)
  - Run all guards sequentially
  - Return `{ valid: true }` or `{ valid: false, reason }` without side effects

- [ ] **4.3** Implement `PipelineEngine.transition(issueNumber, transitionId, context)` — the core method:
  1. Load workflow item from DB (get current status, pipelineId, statusVersion)
  2. Resolve pipeline definition (from pipelineId or item type via `getPipelineForType`)
  3. Find transition by ID in pipeline definition
  4. Validate from-status:
     - If `transition.from` is a specific status: current status must match
     - If `transition.from` is `'*'`: any status is valid
  5. Resolve to-status:
     - If `transition.to` is a specific status: use it directly
     - If `transition.to` is `'*'`: use `context.restoreStatus` (undo/revert cases)
  6. Run all guards sequentially:
     - Each guard receives `(item, transition, context)`
     - If any returns `{ valid: false }`, abort with reason
  7. Run `'before'` hooks in order:
     - Each hook receives `(item, transition, context, hookParams)`
     - Non-optional hook failure aborts transition
     - Hook results collected in `context.hookResults` for subsequent hooks
  8. Execute dual-write:
     - `adapter.updateItemStatus(projectItemId, newStatus)` for GitHub Projects
     - `updateWorkflowFields({ status, statusVersion: expected + 1, ... })` with version check
     - Handle concurrent modification (modifiedCount === 0)
  9. Run `'after'` hooks in order:
     - Same signature as before hooks
     - Non-optional failures logged as errors but don't rollback
     - Optional failures logged at debug level
  10. Append history entry to workflow-items document
  11. Return `TransitionResult`

- [ ] **4.4** Implement `PipelineEngine.updateReviewStatus(issueNumber, reviewStatus, context?)`
  - Load item and pipeline
  - Find `ReviewFlowDefinition` for current status
  - Validate requested review status is valid for this status
  - Update review status via adapter and DB
  - If review action has `triggersTransition`, fire that transition via `this.transition()`
  - Return result

- [ ] **4.5** Implement `PipelineEngine.transitionByTrigger(issueNumber, trigger, context)`
  - Load item and pipeline
  - Find all transitions matching `trigger` and `from` (current status or `'*'`)
  - Use multi-match guard resolution: run guards on each candidate in order, pick first pass
  - If no candidate passes, return `{ success: false, error: 'No matching transition for trigger' }`
  - Delegate to `this.transition()` with the resolved transition ID and context

- [ ] **4.6** Implement `PipelineEngine.completeAgent(issueNumber, agentType, result)`
  - Set `context.agentType` and `context.agentResult` from the completion result
  - Delegate to `this.transitionByTrigger(issueNumber, 'agent_complete', context)`
  - No agent-specific logic — disambiguation is handled by guards on the pipeline definition

- [ ] **4.7** Implement `PipelineEngine.getHistory(issueNumber)`
  - Load workflow item
  - Return `item.history` array sorted chronologically

- [ ] **4.8** Handle `from: '*'` and `to: '*'` transitions:
  - `from: '*'`: Match from any current status
  - `to: '*'`: Resolve target using four semantics:
    1. If `context.restoreStatus` provided → use it (undo case)
    2. If `context.decisionSelection?.routing?.targetStatus` provided → use it (choose-recommended)
    3. If no dynamic target and transition is not delete → keep current status unchanged (no-op like merge-revert-pr, design-pr-request-changes)
    4. For delete transitions → item is removed from pipeline (status irrelevant)

- [ ] **4.9** Add unit tests: `src/server/template/workflow-service/pipeline/__tests__/engine.test.ts`
  - Valid transition succeeds with correct TransitionResult
  - Invalid transition (wrong current status) rejected with reason
  - Guard failure blocks transition and returns guard error
  - Multiple guards: first failure short-circuits
  - Before hooks execute in order before status change
  - After hooks execute in order after status change
  - Optional hook failure doesn't block transition
  - Non-optional before hook failure aborts transition (no status change)
  - Concurrent version check: stale version rejected
  - Concurrent version check: correct version succeeds
  - Wildcard `from: '*'` transition works from any status
  - Wildcard `to: '*'` transition resolves from `context.restoreStatus`
  - Multi-match resolution: first candidate where all guards pass is selected
  - Multi-match resolution: order matters — first match wins
  - Multi-match resolution: no matching candidate returns error
  - `completeAgent` resolves correct transition via multi-match (no agent-specific engine logic)
  - `updateReviewStatus` validates against ReviewFlowDefinition
  - `updateReviewStatus` fires triggered transition when applicable
  - `transitionByTrigger` resolves correct transition via multi-match resolution
  - `transitionByTrigger` returns error when no candidate passes guards
  - `getValidTransitions` returns only matching transitions
  - `getValidTransitions` filters by trigger when provided
  - `getHistory` returns chronological entries

- [ ] **4.10** Add integration tests: `src/server/template/workflow-service/pipeline/__tests__/integration.test.ts`
  - Use real pipeline definitions but mock the adapter and DB
  - Test scenarios from `testing.md`:
    - Feature pipeline end-to-end (approve → route → agent complete → merge → done)
    - Bug pipeline (approve → auto-route investigation → decision → implementation → done)
    - Task item using feature pipeline (approve → route to implementation → merge → done)
    - Multi-phase feature (3 phases: merge phase 1, advance, merge phase 2, advance, merge phase 3, final PR)
    - Undo within time window (advance → undo → verify restored status)
    - Revert after merge (merge → revert → merge revert PR)
    - Guard rejection (attempt invalid transition, verify blocked with reason)

- [ ] **4.11** Run `yarn checks` — zero errors; run E2E tests — all pass (engine exists but callers don't use it yet)

## Files to Modify

```
src/server/template/workflow-service/pipeline/engine.ts  (replace skeleton with implementation)
```

## Files to Create

```
src/server/template/workflow-service/pipeline/__tests__/engine.test.ts
src/server/template/workflow-service/pipeline/__tests__/integration.test.ts
```

## Implementation Notes

### Dual-Write Pattern

The engine preserves the existing dual-write pattern:

```typescript
// 1. Update GitHub Projects adapter
const adapter = await getInitializedAdapter();
await adapter.updateItemStatus(item.githubProjectItemId, newStatus);

// 2. Update MongoDB workflow-items with optimistic concurrency
const result = await workflowItemsCollection.updateOne(
  { _id: item._id, statusVersion: expectedVersion },
  {
    $set: {
      status: newStatus,
      statusVersion: expectedVersion + 1,
      updatedAt: new Date(),
    },
  }
);

if (result.modifiedCount === 0) {
  throw new ConcurrentModificationError(issueNumber, expectedVersion);
}
```

### Hook Result Propagation

Before hooks can return data that subsequent hooks need. For example, `hook:merge-pr` returns `{ data: { mergeCommitSha } }`, and `hook:save-phase-artifact` needs the merge commit SHA.

The engine collects hook results and makes them available via `context.hookResults`:

```typescript
context.hookResults = context.hookResults || [];

for (const hookRef of beforeHooks) {
  const hookFn = this.hooks.get(hookRef.id);
  const result = await hookFn(item, transition, context, hookRef.params);
  context.hookResults.push({ hookId: hookRef.id, ...result });
}
```

### Multi-Match Resolution

When multiple transitions match the same `trigger + from`, the engine uses guard-based resolution:

```typescript
// In engine — fully generic, no domain-specific logic
function resolveTransition(candidates: PipelineTransition[], item, context): PipelineTransition | null {
  for (const transition of candidates) {
    const guardResults = await runGuards(transition.guards, item, transition, context);
    if (guardResults.every(r => r.valid)) {
      return transition;  // First candidate where all guards pass
    }
  }
  return null;  // No candidate matched
}
```

This replaces the hardcoded merge resolution logic. The engine doesn't inspect phase artifacts or agent results — guards on each transition handle disambiguation:
- Merge transitions: `guard:is-single-phase` / `guard:is-middle-phase` / `guard:is-final-phase`
- Agent completion: `guard:auto-submit-conditions-met` (first) vs no special guard (fallback)

Pipeline definition order determines evaluation priority — more specific transitions (with restrictive guards) must be listed before generic fallbacks.

## Validation

1. `yarn checks` passes with zero errors
2. All unit tests in `engine.test.ts` pass
3. All existing E2E tests pass without modification (engine not used by callers yet)
4. Engine handles edge cases: missing pipeline, invalid transition ID, concurrent modifications

## Rollback

Revert `engine.ts` to the skeleton implementation (all methods throw "not implemented"). Delete test file.
