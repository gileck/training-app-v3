# Open Questions and Design Decisions

Items that need decisions, clarification, or awareness before implementation begins.

---

## Decisions Needed

### 1. Merge Transition Resolution: Engine Logic vs Caller Logic

**Context:** When `admin_merge_pr` fires from PR Review, the engine must resolve which of three transitions to use: `merge-impl-pr` (single-phase → Done), `merge-impl-pr-next-phase` (multi-phase middle → Ready for dev), or `merge-impl-pr-final` (multi-phase final → Final Review). This logic currently lives in the 362-line `merge-pr.ts`.

**Question:** Should the engine resolve this internally by inspecting phase artifacts, or should the caller (Telegram handler / API handler) determine the transition ID and pass it explicitly?

- **Option A: Engine resolves** — The engine inspects `item.artifacts.phases` to pick the right transition when multiple transitions match the same `trigger + from`. Callers just say "merge this PR" and the engine figures out the variant. Cleaner caller code, but the engine needs merge-specific logic.
- **Option B: Caller resolves** — The caller inspects phase artifacts and passes the specific transition ID (`merge-impl-pr-next-phase`). Engine stays generic, but callers duplicate resolution logic.

**Decision: Generic multi-match resolution.** Neither Option A nor B — the engine uses a fully generic approach. When multiple transitions match the same `trigger + from`, the engine evaluates guards on each candidate in pipeline definition order and picks the first where all guards pass. Phase-inspection guards (`guard:is-single-phase`, `guard:is-middle-phase`, `guard:is-final-phase`) are added to the merge transitions. The engine has zero merge-specific logic — disambiguation is entirely declarative via pipeline definition guards.

---

### 2. Two Design Approval Paths: Keep Both?

**Context:** There are two ways to advance past a design phase:
1. **Review flow approve** (`reviewDesign('approve')`) — lightweight, sets review status to Approved, triggers `auto-advance-*` transition. No S3 read, no artifact save.
2. **S3 design approval** (`approveDesign()`) — reads design from S3, saves artifact to DB, initializes phases for tech design. Triggered by `approve-design-*` transitions.

**Question:** Are both paths needed long-term, or should one be deprecated?

- In the current codebase, `reviewDesign('approve')` is called from Telegram design review buttons, while `approveDesign()` is called from the design PR approval UI flow.
- Both advance to the same next status, but `approveDesign()` captures design artifacts.

**Decision: Merge into one path.** Remove the lightweight `auto-advance-*` design transitions. The review flow's `approve` action should trigger `approve-design-{type}` (with S3 read + artifact save + phase init) as the single approval path. This ensures artifacts are always captured and phase initialization always happens, regardless of whether admin uses Telegram or web UI. The `auto-advance-*` transitions for design phases are removed from pipeline definitions.

---

### 3. `setWorkflowStatus()` — Bypass or Validate?

**Context:** `setWorkflowStatus()` currently accepts any status string and writes it directly to the DB. The `updateStatus` API handler uses it as a last-resort fallback when routing and `advanceStatus()` don't apply. The pipeline engine validates transitions, so an arbitrary status set would need a special `manual-status-set` transition with `from: '*', to: '*'`.

**Question:** Should `manual-status-set` bypass all guards (except item-exists), or should it validate that the target status exists in the pipeline definition?

- **Option A: Bypass validation** — Matches current behavior. Allows admin to force any status. Risk: invalid states.
- **Option B: Validate target exists in pipeline** — Prevents invalid statuses but may break edge cases where admin needs to force a recovery.

**Decision: Option B.** Validate that the target status exists in the pipeline definition. Add a `force` flag in context that bypasses validation for manual recovery scenarios.

---

### 4. `pipelineId` Assignment Strategy

**Context:** `engine.md` states that new items get `pipelineId` set during the approve transition's after hook. But there is no `hook:set-pipeline-id` defined in the hook catalog or referenced in any pipeline JSON.

**Question:** How should `pipelineId` be assigned?

- **Option A: Dedicated hook** — Add `hook:set-pipeline-id` to the approve transition's after hooks.
- **Option B: Engine implicit behavior** — The engine automatically sets `pipelineId` on the first transition for any item that doesn't have one.
- **Option C: Part of approve hook** — The `hook:create-github-issue` hook (which already runs during approve) also sets `pipelineId`.

**Decision: One-time DB migration + set on approve.** Run a migration script to set `pipelineId` on all existing workflow items based on `item.type` (`'feature'` → `'feature'`, `'bug'` → `'bug'`, `'task'` → `'feature'` — tasks use the feature pipeline). For new items, the engine sets `pipelineId` during the approve transition as part of the dual-write. No fallback logic needed — engine requires `pipelineId` and throws if missing. Add the migration script as a Phase 1 task.

---

### 5. Integration Tests: Where and When?

**Context:** `testing.md` defines integration test scenarios (feature pipeline end-to-end, bug pipeline, multi-phase, undo, revert). These use real pipeline definitions but mock the adapter and DB. However, no implementation phase has a task for creating these tests.

**Question:** Which phase should create integration tests?

- **Option A: Phase 4** — alongside engine unit tests. Pro: validates engine + definitions together early. Con: Phase 4 is already the engine implementation phase.
- **Option B: Phase 5** — after internal migration. Pro: validates the wrappers work end-to-end. Con: adds to the already highest-risk phase.
- **Option C: New Phase 4.5** — dedicated integration test phase between engine core and migration. Pro: clean separation. Con: adds a phase.

**Decision: Phase 4.** Add the integration tests as task 4.10, since they're closely related to engine validation and can catch issues before the risky Phase 5 begins.

---

## Awareness Items

### 6. Partial Dual-Write Failure

**Context:** `engine.transition()` performs a dual-write: GitHub Projects adapter + MongoDB. If one succeeds and the other fails, the system is in an inconsistent state.

**Current behavior:** No handling — if one write fails, the function throws and the other write remains. The periodic `syncWorkflowStatus` call reconciles drift.

**Engine behavior:** Same approach — if the adapter write succeeds but the DB write fails (or vice versa), after-hooks still run but the result includes an error. The existing `syncWorkflowStatus` reconciliation remains the safety net.

**No decision needed** — documenting for awareness. The engine doesn't solve this problem, and solving it properly would require distributed transactions which is out of scope. **Verified in Phase 8 (tasks 8.1, 8.2).**

---

### 7. Backward Compatibility During Migration

**Context:** During Phase 5, functions are migrated one at a time. Some functions call other functions internally (e.g., `mergeFinalPR()` calls `markDone()`, `chooseRecommendedOption()` calls `submitDecisionRouting()`). If `markDone()` is migrated before `mergeFinalPR()`, the old `mergeFinalPR()` code will call the new wrapper `markDone()` which calls the engine.

**Risk:** Low. The wrapper `markDone()` preserves the same signature and return type. The engine-based implementation should produce identical side effects. But if a hook fails that the old code handled differently, behavior could diverge.

**Mitigation:** Migrate callee functions before their callers. The Phase 5 task ordering already does this (`markDone` at 5.8, `mergeFinalPR` at 5.21). Run E2E after each migration to catch divergence early. **Verified in Phase 8 (task 8.3).**

---

### 8. `mergeDesignPR()` Deprecation

**Context:** `mergeDesignPR()` is already marked DEPRECATED in the current codebase. It was replaced by `approveDesign()` when the S3 design flow was introduced. Phase 5 has no migration task for it. Phase 7 removes it entirely.

**Risk:** If any caller still uses `mergeDesignPR()`, it will stop working after Phase 7 cleanup. The E2E tests for `design-pr.e2e.test.ts` test the legacy PR-based flow.

**Mitigation:** Before Phase 7, grep the codebase for `mergeDesignPR` callers. If any exist, either migrate them to `approveDesign()` or add a thin wrapper. The `design-pr.e2e.test.ts` test should be updated to use `approveDesign()` if it hasn't been already. **Verified in Phase 8 (task 8.4).**

---

### 9. Review Status as Engine Method vs Transition

**Context:** Review status changes (Waiting for Review → Approved, Request Changes, etc.) are handled by `engine.updateReviewStatus()`, not by `engine.transition()`. This means review status changes don't go through the full transition pipeline (guards, hooks, history).

**Trade-off:** This keeps the engine simpler — review status is truly a sub-state, not a pipeline state. But it means review status changes have fewer guardrails. The `ReviewFlowDefinition` validates that the action is valid for the current status, and a `triggersTransition` field can fire a real transition when needed (e.g., approve triggers `approve-design-{type}`).

**No decision needed** — the design is intentional and matches the current codebase where review status updates are lightweight operations. Documenting for awareness. **Verified in Phase 8 (task 8.5).**

---

### 10. Guard Count: 14 → 19

**Context:** The original plan specified 14 guards. During review, guards were added: `guard:has-approved-review-status` (extracted from `auto-advance.ts`), plus 5 new guards for multi-match resolution and concurrency control. The guard catalog in `guards-and-hooks.md` now lists 19 guards across 5 files: 11 item guards, 4 PR guards, 1 undo guard, 2 decision guards, 1 concurrency guard.

**No decision needed** — the count was corrected during review. The item-guards.ts file now has 11 guards (the largest). **Verified in Phase 8 (task 8.6).**

---

### 11. JSON Examples Are JSONC (JSON with Comments)

**Context:** The two example pipeline files (`feature-pipeline.json`, `bug-pipeline.json`) use JSON with inline `//` comments. Standard JSON doesn't support comments.

**Impact:** These files are documentation, not runtime code. The actual pipeline definitions will be TypeScript const objects. The JSONC format is intentional for readability. These files should not be parsed as JSON by any tooling. **Verified in Phase 8 (task 8.7).**

---

### 12. `routeWorkflowItemByWorkflowId()` — Wrapper or Separate Path?

**Context:** `routeWorkflowItemByWorkflowId()` is a variant of `routeWorkflowItem()` that accepts a workflow-item MongoDB ID instead of a source document reference. It's used by the `updateStatus` API handler. The function internally looks up the item and delegates to `routeWorkflowItem()`.

**Question:** Should this remain a separate exported function, or should it be absorbed into the engine?

**Recommendation:** Keep as a thin wrapper that resolves the issue number from the workflow-item ID and calls the `routeWorkflowItem()` wrapper. No engine changes needed — this is a convenience function for a specific caller. **Verified in Phase 8 (task 8.8).**
