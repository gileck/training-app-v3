---
title: Pipeline Architecture Overview
summary: JSON-driven pipeline engine replacing unvalidated status transitions with declared state machines, validated by a generic engine with registered hooks and guards.
description: Use this to understand the new pipeline architecture design, its motivation, and how it replaces the current workflow-service implementation.
---

# Pipeline Architecture Overview

## Problem Statement

The current `workflow-service/` (26 files, ~22 exported functions) has one fundamental flaw: **status transitions are unvalidated strings passed through many entry points**. Functions like `advanceStatus(issue, anyString)`, `setWorkflowStatus(id, anyString)`, and `completeAgentRun(issue, agent, { status: anyString })` accept arbitrary status values with no state machine enforcement. Correctness depends entirely on callers passing the right values.

There is no central definition of which transitions are valid for which item types. The routing maps in `constants.ts` cover only a subset of transitions, while the rest are scattered across individual function implementations. Adding a new status or transition requires modifying multiple files with no compile-time validation that the change is consistent.

## Solution

Replace the current ad-hoc approach with a **JSON-driven pipeline engine** where:

1. **Transitions are declared data** — each pipeline type (feature, bug) defines its valid statuses, transitions, guards, and hooks as a typed const object. Items with `type: 'task'` use the feature pipeline.
2. **A generic engine validates and executes transitions** — callers request transitions by ID; the engine validates the current state, runs guards, executes hooks, and performs the status update
3. **Behavior is composed via registered hooks and guards** — side effects (GitHub API calls, DB writes, notifications) and preconditions (existence checks, time window validation) are extracted into reusable units

## Three-Layer Architecture

```
┌─────────────────────────────────────────────┐
│  Pipeline Definitions (data)                │
│  feature.ts | bug.ts                        │
│  Statuses, transitions, guards, hooks       │
├─────────────────────────────────────────────┤
│  Pipeline Engine (runtime)                  │
│  engine.ts                                  │
│  Validates transitions, runs guards/hooks   │
├─────────────────────────────────────────────┤
│  Guards & Hooks (behavior)                  │
│  guards/*.ts | hooks/*.ts                   │
│  Reusable preconditions and side effects    │
└─────────────────────────────────────────────┘
```

**Pipeline Definitions** are const objects in TypeScript (not MongoDB) — they change with code releases and benefit from type-checking. Each definition declares every valid status, every valid transition between statuses, which guards must pass, and which hooks execute.

**The Pipeline Engine** sits between callers (Telegram handlers, API routes, CLI, agents) and the database/adapter layer. Callers never update status directly — they call `engine.transition(issueNumber, transitionId, context)` and the engine handles validation, guard execution, the dual-write (GitHub Projects adapter + MongoDB workflow-items), and hook execution.

**Guards and Hooks** are extracted from the current 22 workflow-service functions. Guards are pure boolean checks (does the item exist? is the undo window valid?). Hooks are side effects (create GitHub issue, send Telegram notification, sync log to repo). Both are registered in a central registry and referenced by ID in pipeline definitions.

## Target File Structure

```
src/server/template/workflow-service/
  pipeline/
    types.ts              # PipelineDefinition, PipelineTransition, TransitionContext, etc.
    definitions/
      feature.ts          # FEATURE_PIPELINE const (also used by task items)
      bug.ts              # BUG_PIPELINE const
      index.ts            # getPipelineForType(), getAllPipelines()
    engine.ts             # PipelineEngine implementation
    registry.ts           # createHookRegistry() with all guards + hooks
    guards/
      item-guards.ts      # guard:item-exists, guard:in-design-phase, etc.
      pr-guards.ts        # guard:pr-exists, guard:commit-message-exists
      undo-guards.ts      # guard:undo-window-valid
      decision-guards.ts  # guard:decision-exists
      concurrency-guards.ts # guard:concurrent-version-check
    hooks/
      github-hooks.ts     # create-github-issue, merge-pr, close-design-prs, etc.
      db-hooks.ts         # sync-workflow-status, save-design-artifact, etc.
      s3-hooks.ts         # read-design-from-s3, delete-s3-design-files
      phase-hooks.ts      # initialize-phases, advance-implementation-phase, etc.
      notify-hooks.ts     # notify-approved, notify-routed, etc.
      log-hooks.ts        # agent-log, history-log, sync-log-to-repo
  # Existing files kept as thin wrappers during migration
  approve.ts              # delegates to engine.transition('approve', ...)
  route.ts                # delegates to engine.transition('route-to-X', ...)
  ...
```

## Sub-Documents

| Document | Description |
|----------|-------------|
| [pipeline-schema.md](./pipeline-schema.md) | Pipeline definition types, schema design, and key design decisions |
| [engine.md](./engine.md) | Pipeline engine interface, concurrency model, agent integration |
| [guards-and-hooks.md](./guards-and-hooks.md) | Guard/hook registry, complete catalogs, function mapping table |
| [pipeline-definitions.md](./pipeline-definitions.md) | Feature and bug pipeline overviews with design notes |
| [testing.md](./testing.md) | E2E test strategy and regression validation approach |
| [examples/feature-pipeline.json](./examples/feature-pipeline.json) | Full feature pipeline definition with inline explanations |
| [examples/bug-pipeline.json](./examples/bug-pipeline.json) | Full bug pipeline definition with inline explanations |
| [implementation/overview.md](./implementation/overview.md) | Implementation roadmap and progress tracking |
| [implementation/phase-1-foundation.md](./implementation/phase-1-foundation.md) | Types, engine skeleton, registry, DB schema changes |
| [implementation/phase-2-guards-and-hooks.md](./implementation/phase-2-guards-and-hooks.md) | Extract all guards and hooks from current code |
| [implementation/phase-3-pipeline-definitions.md](./implementation/phase-3-pipeline-definitions.md) | Create the 2 pipeline definitions |
| [implementation/phase-4-engine-core.md](./implementation/phase-4-engine-core.md) | Implement engine.transition() with validation and hooks |
| [implementation/phase-5-internal-migration.md](./implementation/phase-5-internal-migration.md) | Refactor internal callers to use engine |
| [implementation/phase-6-external-migration.md](./implementation/phase-6-external-migration.md) | Migrate Telegram, API, CLI, agents to engine |
| [implementation/phase-7-cleanup.md](./implementation/phase-7-cleanup.md) | Remove deprecated wrappers, old constants |

## Critical Files

| File | Role |
|------|------|
| `src/server/template/workflow-service/index.ts` | Central exports — new engine exports added, old ones become wrappers |
| `src/server/template/workflow-service/constants.ts` | STATUS_TRANSITIONS, routing maps — superseded by pipeline definitions |
| `src/server/template/workflow-service/merge-pr.ts` | Most complex function (362 lines) — hardest hook extraction |
| `src/server/template/project-management/config.ts` | STATUSES, REVIEW_STATUSES — pipeline definitions reference these |
| `src/server/database/collections/template/workflow-items/types.ts` | Needs `pipelineId` + `statusVersion` optional fields |
| `src/agents/tests/e2e/workflow-service-actions.e2e.test.ts` | Direct function calls — validates wrappers work |
| `src/agents/tests/e2e/feature-lifecycle.e2e.test.ts` | Full pipeline test — validates end-to-end |
