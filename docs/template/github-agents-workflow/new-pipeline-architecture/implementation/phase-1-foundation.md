---
title: "Phase 1: Foundation"
summary: Create type system, engine skeleton, guard/hook registries, and DB schema changes for the pipeline architecture.
---

# Phase 1: Foundation

## Goal

Establish the type system, empty registries, engine skeleton, and DB schema changes. After this phase, the pipeline infrastructure exists but does nothing — no behavior changes, no risk.

## Dependencies

None — this is the first phase.

## Tasks

- [ ] **1.1** Create `src/server/template/workflow-service/pipeline/types.ts` with all interfaces:
  - `PipelineDefinition`
  - `PipelineStatus`
  - `PipelineTransition`
  - `TransitionTrigger` (`string` type — engine accepts any trigger value)
  - `KNOWN_TRIGGERS` const object (documents the 21 known trigger strings for pipeline definitions)
  - `TransitionGuardRef`
  - `TransitionHookRef`
  - `ReviewFlowDefinition`
  - `ReviewAction`
  - `TransitionContext`
  - `TransitionResult`
  - `AgentCompletionResult`
  - `GuardFunction` type
  - `HookFunction` type
  - `HookResult`
  - `getHookData<T>(result, hookId)` utility function (extracts typed hook data from TransitionResult.hookResults)
  - `HistoryEntry` (extend existing type from workflow-items — defines action, description, timestamp, actor, metadata)
  - `ConcurrentModificationError` error class (thrown when statusVersion check fails)

- [ ] **1.2** Create `src/server/template/workflow-service/pipeline/registry.ts` with:
  - `GuardRegistry` class (register, get, has, validateAll methods)
  - `HookRegistry` class (register, get, has, validateAll methods)
  - `createRegistries()` factory function (empty registries initially)

- [ ] **1.3** Create `src/server/template/workflow-service/pipeline/engine.ts` with:
  - `IPipelineEngine` interface
  - `PipelineEngine` class implementing IPipelineEngine
  - All methods throw `new Error('Not implemented')` initially
  - `getPipelineEngine()` factory function (lazy singleton)

- [ ] **1.4** Add `pipelineId?: string` field to `WorkflowItemDocument` in `src/server/database/collections/template/workflow-items/types.ts`

- [ ] **1.5** Add `statusVersion?: number` field to `WorkflowItemDocument` in `src/server/database/collections/template/workflow-items/types.ts`

- [ ] **1.6** Add `pipelineId` and `statusVersion` to the allowed fields in `updateWorkflowFields()` in `src/server/database/collections/template/workflow-items/index.ts`

- [ ] **1.7** Create `src/server/template/workflow-service/pipeline/definitions/index.ts` with:
  - `getPipelineForType(type: string): PipelineDefinition` — stub that throws
  - `getPipelineById(id: string): PipelineDefinition` — stub that throws
  - `getAllPipelines(): PipelineDefinition[]` — stub returning empty array

- [ ] **1.8** Create migration script `scripts/migrate-pipeline-id.ts` that sets `pipelineId` on all existing workflow items based on `item.type` (`'feature'` → `'feature'`, `'bug'` → `'bug'`, `'task'` → `'feature'` — tasks use the feature pipeline). This implements Decision #4 from OPEN-QUESTIONS.md.

- [ ] **1.9** Run `yarn checks` — zero errors

- [ ] **1.10** Run E2E tests — all pass (no behavior changes)

## Files to Create

```
src/server/template/workflow-service/pipeline/
  types.ts
  registry.ts
  engine.ts
  definitions/
    index.ts
```

## Files to Modify

```
src/server/database/collections/template/workflow-items/types.ts   (add pipelineId, statusVersion)
src/server/database/collections/template/workflow-items/index.ts   (allow new fields in updateWorkflowFields)
```

## Validation

1. `yarn checks` passes with zero errors
2. All existing E2E tests pass without modification
3. New files compile and export expected types
4. No new circular dependencies introduced

## Rollback

Delete the `pipeline/` directory and revert the two modified files. No behavior was changed.
