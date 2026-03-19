---
title: Workflow E2E Tests
summary: "E2E tests that verify the full agent workflow lifecycle by mocking only at system boundaries (LLM, Telegram, filesystem) while running real code for artifacts, phases, parsing, workflow-db, logging, and decision-utils against an in-memory MongoDB."
---

# Workflow E2E Tests

End-to-end tests that verify the full agent pipeline by mocking only at 4 true system boundaries and running everything else for real — prompt building, structured output parsing, status transitions, PR creation, review submission, notifications, artifacts, phases, workflow-db, logging, and decision-utils.

## Running

```bash
yarn test:e2e
```

This runs vitest with the config in `vitest.config.ts`, which includes only `src/agents/tests/e2e/**/*.e2e.test.ts`.

## Test Files

| File | Coverage |
|------|----------|
| `feature-lifecycle.e2e.test.ts` | Product Design → Tech Design → Implementation → PR Review → Done |
| `bug-lifecycle.e2e.test.ts` | Bug Investigation (auto-submit) → Implementation → PR Review → Done |
| `multi-phase.e2e.test.ts` | Multi-phase implementation with phase advancement |
| `request-changes.e2e.test.ts` | Request changes flow on both design and implementation PRs |
| `clarification.e2e.test.ts` | Clarification request and received flow |
| `multi-agent-flow.e2e.test.ts` | Multiple agents processing items concurrently |
| `workflow-service-actions.e2e.test.ts` | Direct workflow-service function tests (approve, route, delete, advance, review, merge, revert, undo, clarification, decision routing, choose-recommended) |
| `design-approval-s3.e2e.test.ts` | S3-backed design approval flow (approve without merge, S3 storage, next agent reads from S3) |
| `design-mock-decision.e2e.test.ts` | Product design mock decision flow (mock options, decision creation, option selection, design routing) |
| `workflow-review.e2e.test.ts` | Workflow review agent: Done item → LLM analysis → findings created → log section appended → DB updated |

### Feature Lifecycle

Traces a feature request through all 4 agent stages:

1. **Product Design** — `runBatch` picks up the item, AI generates design, creates a design PR, sets review status to "Waiting for Review"
2. Admin approves → **Tech Design** — same pattern, creates another design PR
3. Admin approves → **Implementation** — creates feature branch, runs AI, commits changes, creates implementation PR, moves to "PR Review"
4. **PR Review** — checks out branch, fetches PR files/comments, runs review, submits GitHub APPROVE, sets review status to "Approved"
5. Verifies exactly 4 agent calls in order: `product-design`, `tech-design`, `implementation`, `pr-review`

### Bug Lifecycle

Traces a bug report through 3 agent stages:

1. **Bug Investigation** — runs read-only investigation, posts root cause analysis with fix options, auto-submits (high confidence, small complexity), auto-routes to "Ready for development"
2. **Implementation** — creates fix branch, runs AI, commits, creates PR
3. **PR Review** — reviews and approves
4. Verifies exactly 3 agent calls: `bug-investigation`, `implementation`, `pr-review`

## Architecture

### Boundary-Only Mocking via DI

The tests use dependency injection (DI) to replace system boundaries at runtime, rather than `vi.mock()` for internal modules. This means internal refactoring won't break the tests as long as behavior is unchanged.

Three DI singletons are injected in `beforeAll` via `setupBoundaries()`:

1. **`setProjectManagementAdapter()`** — injects `MockProjectAdapter` (in-memory items, issues, PRs)
2. **`setGitAdapter()`** — injects `MockGitAdapter` (no-op git with controllable `hasUncommittedChanges`)
3. **`setMongoUri()`** — points the real DB connection at `mongodb-memory-server`

### What's Mocked (9 `vi.mock()` calls — true system boundaries)

| # | Module | Why |
|---|--------|-----|
| 1 | `@/agents/lib` (runAgent) | LLM boundary — returns canned `AgentRunResult` per workflow |
| 2 | `@/agents/shared/notifications` | Telegram HTTP boundary — captures calls |
| 3 | `@/agents/lib/devServer` | External process boundary |
| 4 | `@/agents/shared/loadEnv` | Side-effect import (loads .env files) |
| 5 | `child_process` | `runYarnChecks()` calls `execSync('yarn checks:ci')` |
| 6 | `@/agents/lib/design-files` | Filesystem boundary — in-memory design docs |
| 7 | `@/agents/agents.config` | Requires env vars not available in tests |
| 8 | `@/agents/shared/config` | Requires env vars not available in tests |
| 9 | `@/server/template/s3/sdk` | S3 boundary — in-memory storage for design docs |

### What Runs Real (via DI — no `vi.mock()`)

| Module | What it exercises |
|--------|-------------------|
| `@/server/template/project-management` | Adapter injected via `setProjectManagementAdapter()` |
| `@/agents/shared/git-utils` | Delegates to `MockGitAdapter` via `setGitAdapter()` |
| `@/agents/lib/workflow-db` | Real code against mongodb-memory-server |
| `@/server/template/database` (all paths) | Real MongoDB connection to memory server |
| `@/agents/lib/artifacts` | Real artifact management (uses adapter + MongoDB) |
| `@/agents/lib/phases` | Real phase parsing |
| `@/agents/lib/parsing` | Real output parsing |
| `@/agents/lib/logging` | Real logging (writes to agent-logs/) |
| `@/agents/lib/playwright-mcp` | Real code (returns false — no Playwright available) |
| `@/apis/template/agent-decision/utils` | Real decision formatting and DB persistence |
| `@/agents/core-agents/prReviewAgent/createPrReviewerAgentPrompt` | Real prompt building |

### Key Files

```
src/agents/tests/e2e/
  feature-lifecycle.e2e.test.ts        — Feature request full lifecycle
  bug-lifecycle.e2e.test.ts            — Bug report full lifecycle
  multi-phase.e2e.test.ts              — Multi-phase implementation
  request-changes.e2e.test.ts          — Request changes flows
  clarification.e2e.test.ts            — Clarification flows
  multi-agent-flow.e2e.test.ts         — Concurrent agent processing
  workflow-service-actions.e2e.test.ts  — Direct service function tests
  design-approval-s3.e2e.test.ts       — S3-backed design approval flow
  design-mock-decision.e2e.test.ts     — Product design mock decision flow
  workflow-review.e2e.test.ts          — Workflow review agent lifecycle
  mocks/
    mock-project-adapter.ts        — In-memory ProjectManagementAdapter
    mock-run-agent.ts              — Canned AI responses per workflow
    mock-git-adapter.ts            — No-op GitAdapter with controllable state
    mock-notifications.ts          — Notification capture stubs
    mock-design-files.ts           — In-memory design docs
    mock-s3-sdk.ts                 — In-memory S3 storage
  testkit/
    setup-boundaries.ts            — setupBoundaries() / teardownBoundaries() — DI + MongoMemoryServer
    workflow-testkit.ts            — Fluent API for composing flows (available for future tests)
    agent-runners.ts               — Helpers to run each agent type
```

### DI Infrastructure

The DI pattern uses getter/setter/reset for each boundary:

| Boundary | Interface | Setter | Reset |
|----------|-----------|--------|-------|
| Git | `GitAdapter` in `src/agents/shared/git-adapter.ts` | `setGitAdapter()` | `resetGitAdapter()` |
| Project Management | `ProjectManagementAdapter` in `src/server/template/project-management/index.ts` | `setProjectManagementAdapter()` | `resetProjectManagementAdapter()` |
| MongoDB | Connection in `src/server/database/connection.ts` | `setMongoUri()` | `resetDbConnection()` |

Production code is unchanged — `getGitAdapter()` lazy-loads `DefaultGitAdapter`, `getProjectManagementAdapter()` creates the real adapter, and `getDb()` uses `MONGO_URI` from env. Tests inject mocks before any agent code runs.

## Adding New Tests

1. Create a new `*.e2e.test.ts` file in `src/agents/tests/e2e/`
2. Copy the 8 `vi.mock(...)` calls from an existing test — these must be before agent imports
3. Use `setupBoundaries()` in `beforeAll` and `teardownBoundaries()` in `afterAll`
4. Use `MockProjectAdapter` (from boundaries) to seed items and verify state transitions
5. Use `MockGitAdapter` (from boundaries) to control git behavior per test step
6. Use `agentCalls` from `mock-run-agent.ts` to verify which workflows were invoked
7. Add canned responses to `mock-run-agent.ts` if testing a new workflow type

### The `hasUncommittedChanges` Pattern

The `MockGitAdapter` uses a `setImplementationAgentRan()` method to simulate the implementation agent making file changes:

- **Before implementation runs**: `gitAdapter.reset()` — `hasUncommittedChanges()` returns `false` (clean working dir)
- **Set flag** right before calling `implementProcessItem()`: `gitAdapter.setImplementationAgentRan(true)`
- **After implementation, before PR review**: `gitAdapter.setImplementationAgentRan(false)` so PR review sees a clean working dir
- Calls with `excludePaths` (e.g., `hasUncommittedChanges(['agent-logs/'])`) always return `false`
