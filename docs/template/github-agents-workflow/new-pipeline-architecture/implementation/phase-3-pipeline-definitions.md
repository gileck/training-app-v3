---
title: "Phase 3: Pipeline Definitions"
summary: Create the two pipeline definition const objects (feature, bug) with unit tests validating internal consistency.
---

# Phase 3: Pipeline Definitions

## Goal

Create the two typed const objects that define every valid status, transition, guard, and hook for each pipeline type. Unit tests validate that all references are internally consistent.

## Dependencies

Phase 1 (types), Phase 2 (guards and hooks must be registered for validation tests).

## Tasks

- [ ] **3.1** Create `src/server/template/workflow-service/pipeline/definitions/feature.ts`
  - Define `FEATURE_PIPELINE` const satisfying `PipelineDefinition`
  - 8 statuses (Backlog through Done) using `STATUSES` constants
  - ~23 transitions covering all feature flows
  - 4 review flows (Product Dev, Product Design, Tech Design, PR Review)
  - Use the [feature-pipeline.json](../examples/feature-pipeline.json) example as reference

- [ ] **3.2** Create `src/server/template/workflow-service/pipeline/definitions/bug.ts`
  - Define `BUG_PIPELINE` const satisfying `PipelineDefinition`
  - 8 statuses (Backlog, Bug Investigation, design phases, impl, review, done)
  - ~23 transitions covering investigation, decision routing, shared design/impl/merge/revert/global flows
  - 4 review flows (Bug Investigation, Product Design, Tech Design, PR Review)
  - Use the [bug-pipeline.json](../examples/bug-pipeline.json) example as reference

- [ ] **3.3** Create `src/server/template/workflow-service/pipeline/definitions/index.ts`
  - `getPipelineForType(type: 'feature' | 'bug' | 'task'): PipelineDefinition` — tasks map to feature pipeline
  - `getPipelineById(id: string): PipelineDefinition`
  - `getAllPipelines(): PipelineDefinition[]`

- [ ] **3.4** Add unit tests: `src/server/template/workflow-service/pipeline/__tests__/definitions.test.ts`
  - For each pipeline definition:
    - All transition `from` values reference valid status IDs (or are `'*'`)
    - All transition `to` values reference valid status IDs (or are `'*'`)
    - All guard IDs referenced in transitions are registered in the GuardRegistry
    - All hook IDs referenced in transitions are registered in the HookRegistry
    - All review flow `statusId` values reference valid statuses
    - `entryStatus` exists in the statuses list
    - All `terminalStatuses` exist in the statuses list
    - No duplicate transition IDs
    - No duplicate status IDs
  - Cross-pipeline:
    - Every pipeline has at least one transition with `trigger: 'system_approve'`
    - Every pipeline has at least one terminal status

- [ ] **3.5** Run `yarn checks` — zero errors

## Files to Create

```
src/server/template/workflow-service/pipeline/definitions/
  feature.ts
  bug.ts
  index.ts

src/server/template/workflow-service/pipeline/__tests__/
  definitions.test.ts
```

## Design Notes

### Using STATUSES Constants

Pipeline definitions reference `STATUSES` from `src/server/template/project-management/config.ts`:

```typescript
import { STATUSES, REVIEW_STATUSES } from '@/server/template/project-management/config';

export const FEATURE_PIPELINE: PipelineDefinition = {
  id: 'feature',
  label: 'Feature Pipeline',
  entryStatus: STATUSES.backlog,
  terminalStatuses: [STATUSES.done],
  statuses: [
    { id: STATUSES.backlog, label: 'Backlog' },
    { id: STATUSES.productDevelopment, label: 'Product Development', isDesignPhase: true, agentPhase: 'product-dev' },
    // ...
  ],
  // ...
};
```

This ensures that if status string values change in the config, the pipeline definitions automatically stay in sync.

### Transition ID Naming Convention

Transition IDs follow a verb-noun pattern:
- `approve` — entry approval
- `route-to-{destination}` — routing to a specific phase
- `agent-complete-{phase}` — agent finishing a phase
- `merge-impl-pr` — merging implementation PR (single-phase)
- `merge-impl-pr-next-phase` — merging implementation PR (multi-phase middle)
- `merge-impl-pr-final` — merging implementation PR (multi-phase final)
- `approve-design-{type}` — approving a specific design type (reads from S3, saves artifact, advances)
- `manual-mark-done` — admin manual completion
- `undo-action` — undo within time window

### Shared vs Duplicated Transitions

Some transitions are identical across both pipelines (e.g., `merge-impl-pr`, `undo-action`). Rather than sharing transition objects, each pipeline defines its own copy. This keeps each pipeline self-contained and allows future divergence without coupling.

### No Task Pipeline

Items with `type: 'task'` use the feature pipeline (`pipelineId: 'feature'`). Tasks are typically routed directly to implementation, skipping design phases. The feature pipeline already supports this via `route-to-implementation`. No separate task pipeline definition is needed.

## Validation

1. `yarn checks` passes with zero errors
2. All unit tests in `definitions.test.ts` pass
3. Pipeline definitions match the behavior documented in [workflow-e2e.md](../../workflow-e2e.md)
4. All existing E2E tests pass without modification

## Rollback

Delete the definition files and test file. No behavior was changed.
