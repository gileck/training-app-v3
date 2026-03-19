---
title: Testing Strategy
summary: E2E test strategy using existing tests as regression validation, with no test changes needed during migration since exported function signatures are preserved.
---

# Testing Strategy

## Existing E2E Tests as Regression Validation

The current E2E test suite is the primary validation mechanism for the pipeline migration. The tests don't need to change because:

1. **Boundary-only mocking**: Tests mock only at system boundaries (LLM, Telegram, S3, filesystem, child_process) via dependency injection. All workflow-service code runs against real logic with an in-memory MongoDB and `MockProjectAdapter`.

2. **Preserved function signatures**: The exported functions (`approveWorkflowItem`, `routeWorkflowItem`, `mergeImplementationPR`, etc.) become thin wrappers around `engine.transition()`. Same parameters, same return types — callers don't know the engine exists.

3. **Full pipeline coverage**: Lifecycle tests go through agent processors and the complete status flow, validating that the refactor produces identical status transitions, DB writes, and side effects.

## Test Files and Coverage

| Test File | What It Validates |
|-----------|------------------|
| `workflow-service-actions.e2e.test.ts` | Direct function calls to ~17 workflow-service functions. Tests each function's return value, status changes, review status changes, and error cases. Validates that the thin wrapper layer works identically to the original implementation. |
| `feature-lifecycle.e2e.test.ts` | Full feature pipeline: Backlog → Product Design → Tech Design → Implementation → PR Review → Done. Validates end-to-end with real agent processors. |
| `bug-lifecycle.e2e.test.ts` | Full bug pipeline: Bug Investigation → Implementation → PR Review → Done. Includes decision making and auto-submit flows. |
| `multi-phase.e2e.test.ts` | Multi-phase features with sequential PRs. Tech design outputs phases → implementation creates phase PRs → advances through phases → creates final PR. |
| `clarification.e2e.test.ts` | Clarification request handling: agent requests clarification → admin marks received → agent continues. |
| `request-changes.e2e.test.ts` | Request changes workflows: admin requests changes → agent revises → re-review cycle. |
| `design-approval-s3.e2e.test.ts` | S3 design storage: design saved to S3 → approved via S3 read (not PR merge). |
| `design-review.e2e.test.ts` | Design review actions: approve, request changes, reject across design phases. |
| `design-mock-decision.e2e.test.ts` | Mock selection decisions for bug investigation. |
| `design-pr.e2e.test.ts` | Design PR operations (legacy PR-based flow). |
| `multi-agent-flow.e2e.test.ts` | Multi-agent orchestration across pipeline phases. |
| `workflow-review.e2e.test.ts` | Workflow review agent (post-completion analysis). |

## Migration Validation Strategy

### Per-Function Migration (Phase 5)

Each function is migrated one at a time. After each migration:

1. Run the full E2E suite: `yarn test:e2e`
2. All tests must pass — any failure means the wrapper doesn't match the original behavior
3. If a test fails, compare the wrapper's behavior against the original function to find the discrepancy

### Per-Transport Migration (Phase 6)

Each transport layer (Telegram handler, API handler, CLI command, agent) is migrated one at a time:

1. Run the full E2E suite after each migration
2. Smoke test via Telegram: approve a feature, route it, verify status changes
3. Smoke test via UI: approve a bug, verify auto-route to Bug Investigation
4. Verify agent completion: run an agent cycle, verify status transition

### Cleanup Validation (Phase 7)

After removing deprecated code:

1. `yarn checks` — zero TypeScript errors, zero ESLint errors, zero circular deps, zero unused deps
2. Full E2E suite — all tests pass
3. Manual smoke test of the most complex flow (multi-phase feature with design review cycle)

## New Tests for Pipeline Engine

While existing tests validate the migration doesn't break behavior, new tests validate the engine itself:

### Unit Tests (Phase 3 — Pipeline Definitions)

```
- All transition from/to values reference valid status IDs within the pipeline
- All guard IDs referenced in transitions are registered in the GuardRegistry
- All hook IDs referenced in transitions are registered in the HookRegistry
- All review flow statusIds reference valid statuses in the pipeline
- Entry status exists in the statuses list
- Terminal statuses exist in the statuses list
- No duplicate transition IDs within a pipeline
- No duplicate status IDs within a pipeline
```

### Unit Tests (Phase 4 — Engine Core)

```
- Valid transition succeeds and returns correct TransitionResult
- Invalid transition (wrong current status) rejected with reason
- Guard failure blocks transition and returns guard error
- Multiple guards: first failure short-circuits
- Before hooks execute in order before status change
- After hooks execute in order after status change
- Optional hook failure doesn't block transition
- Non-optional before hook failure aborts transition
- Concurrent version check: stale version rejected
- Concurrent version check: correct version succeeds
- Wildcard 'from: *' transition works from any status
- Wildcard 'to: *' transition resolves from context.restoreStatus
- completeAgent resolves correct transition for agent type
- updateReviewStatus validates against ReviewFlowDefinition
- getValidTransitions returns only transitions matching current status
- getValidTransitions filters by trigger when provided
- getHistory returns chronological history entries
```

### Integration Tests

These are separate from E2E — they test the engine with real pipeline definitions but mock the adapter and DB:

```
- Feature pipeline: approve → route → design review approve → advance → implementation complete → merge → Done
- Bug pipeline: approve → auto-route to investigation → agent complete → decision → implementation → merge → Done
- Task item (using feature pipeline): approve → route to implementation → merge → Done
- Multi-phase: implementation → merge phase 1 → advance phase → merge phase 2 → final PR → merge final → Done
- Undo: request changes → undo within window → restored
- Undo: request changes → undo after window → expired
- Revert: merge → revert → merge revert → clean
```

## Running Tests

```bash
# Full E2E suite (existing tests — regression validation)
yarn test:e2e

# Pipeline engine unit tests (new)
yarn test src/server/template/workflow-service/pipeline/__tests__/

# All checks (TypeScript, ESLint, circular deps, unused deps)
yarn checks
```
