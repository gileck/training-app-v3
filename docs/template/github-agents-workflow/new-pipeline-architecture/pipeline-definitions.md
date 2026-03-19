---
title: Pipeline Definitions
summary: Design notes for the two pipeline definitions (feature, bug) including status maps, transition overviews, multi-phase handling, and undo semantics.
---

# Pipeline Definitions

Two pipeline types cover all workflow item variants. Each is a TypeScript const object implementing `PipelineDefinition`. See [examples/](./examples/) for full annotated JSON representations.

Items with `type: 'task'` use the **feature pipeline** — tasks are features that skip design phases and go straight to implementation. The `pipelineId` determines which pipeline definition governs the item, while `type` is purely a UI label.

## Feature Pipeline

The most complex pipeline, covering the full lifecycle from backlog through design phases, implementation, review, and completion.

### Statuses (8)

| Status | Agent Phase | Design Phase | Requires Decision |
|--------|------------|-------------|-------------------|
| Backlog | — | No | No |
| Product Development | product-dev | Yes | No |
| Product Design | product-design | Yes | No |
| Technical Design | tech-design | Yes | No |
| Ready for development | implementation | No | No |
| PR Review | pr-review | No | No |
| Final Review | — | No | No |
| Done | — | No | No |

Note: "Ready for development" is the single implementation status in the adapter (`STATUSES.implementation`). The implementation agent picks up items from this column.

### Transitions (~23)

**Entry and Routing:**
- `approve` — System approves item, creates GitHub issue → Backlog
- `route-to-product-dev` — Admin routes → Product Development
- `route-to-product-design` — Admin routes → Product Design
- `route-to-tech-design` — Admin routes → Technical Design
- `route-to-implementation` — Admin routes → Ready for development
- `route-to-backlog` — Admin routes back → Backlog

**Design Phase Flow:**
- Design review actions (approve/changes/reject) are handled via `engine.updateReviewStatus()` using the `ReviewFlowDefinition` for each design phase. Approve triggers `approve-design-{type}` transition (reads from S3, saves artifact, advances); changes/reject set review status only.
- `approve-design-product-dev` — Admin approves Product Dev design via S3 → Product Design
- `approve-design-product` — Admin approves Product Design → Technical Design
- `approve-design-tech` — Admin approves Tech Design → Ready for development (+ initialize phases)
- `design-pr-request-changes` — Admin requests changes on design PR → review = Request Changes

**Implementation and Review:**
- `agent-complete-implementation` — Implementation agent creates PR → PR Review
- `pr-request-changes` — Admin requests changes → Ready for development, review = Request Changes

**Merge Transitions:**
- `merge-impl-pr` — Single-phase merge → Done
- `merge-impl-pr-next-phase` — Multi-phase middle merge → Ready for development (next phase)
- `merge-impl-pr-final` — Multi-phase final merge → Final Review (creates final PR)
- `merge-final-pr` — Final PR merge → Done

**Revert:**
- `revert-merge` — Creates revert PR → Ready for development, review = Request Changes
- `merge-revert-pr` — Merges revert PR (cleanup only, no status change)

**Global (from: '*'):**
- `manual-mark-done` — Admin marks done from any status → Done
- `manual-status-set` — UI fallback for setting arbitrary status
- `undo-action` — Admin undoes within 5-min window → restores previous status
- `clarification-received` — Admin marks clarification received (review status change)
- `delete` — Admin deletes item (removes from pipeline)

### Review Flows

| Status | On Agent Complete | Review Actions |
|--------|------------------|----------------|
| Product Development | review = Waiting for Review | approve → `approve-design-product-dev`, changes → Request Changes, reject → Rejected |
| Product Design | review = Waiting for Review | approve → `approve-design-product`, changes → Request Changes, reject → Rejected |
| Technical Design | review = Waiting for Review | approve → `approve-design-tech`, changes → Request Changes, reject → Rejected |
| PR Review | review = Waiting for Review | approve → Approved, changes → Request Changes |

### Multi-Phase Handling

Multi-phase is **not** a separate pipeline. It's a dynamic behavior within the feature pipeline:

1. When Tech Design is approved, the `hook:initialize-phases` hook parses phases from the design document and sets `implementationPhase: "1/N"`
2. The implementation agent creates a PR for the current phase
3. On merge, the engine uses **multi-match resolution** — three transitions share `trigger: admin_merge_pr` and `from: PR Review`, each with a phase-inspection guard:
   - `merge-impl-pr` → `guard:is-single-phase` (no phases or single phase) → Done
   - `merge-impl-pr-next-phase` → `guard:is-middle-phase` (more phases remaining) → Ready for development (next phase)
   - `merge-impl-pr-final` → `guard:is-final-phase` (last phase) → Final Review (creates final PR)

The engine has no phase-specific logic — it simply evaluates guards on each candidate transition in order and picks the first pass. The guards inspect `item.artifacts.phases` to determine which transition applies. This replaces the hardcoded 362-line `merge-pr.ts` resolution logic with declarative pipeline definition data.

## Bug Pipeline

Similar to features but with an investigation phase instead of Product Development, and a decision routing step.

### Statuses (8)

| Status | Agent Phase | Design Phase | Requires Decision |
|--------|------------|-------------|-------------------|
| Backlog | — | No | No |
| Bug Investigation | bug-investigation | Yes | Yes |
| Product Design | product-design | Yes | No |
| Technical Design | tech-design | Yes | No |
| Ready for development | — | No | No |
| PR Review | pr-review | No | No |
| Final Review | — | No | No |
| Done | — | No | No |

### Transitions (~23)

**Entry (auto-route on approval):**
- `approve-and-route-to-investigation` — System approves bug → Bug Investigation (auto-route, no routing message)

**Investigation Decision Flow:**
- `agent-complete-investigation` — Bug Investigator finishes → review = Waiting for Review (or Waiting for Decision)
- `agent-auto-submit-investigation` — Bug Investigator auto-submits (high confidence, S complexity) → Ready for development
- `bug-decision-to-implementation` — Admin selects fix → Ready for development
- `bug-decision-to-tech-design` — Admin selects fix → Technical Design
- `bug-decision-to-product-design` — Admin selects fix → Product Design
- `choose-recommended` — Admin accepts recommended fix → routes per recommendation

**Shared with Feature Pipeline:**
- Design phase approvals (same transitions as feature)
- Implementation, PR Review, merge, revert, undo, delete, manual-mark-done

### Review Flows

| Status | On Agent Complete | Review Actions |
|--------|------------------|----------------|
| Bug Investigation | review = Waiting for Review or Waiting for Decision | approve → advance, changes → Request Changes, choose_recommended → auto-select |
| Product Design | review = Waiting for Review | approve → `approve-design-product`, changes → Request Changes |
| Technical Design | review = Waiting for Review | approve → `approve-design-tech`, changes → Request Changes |
| PR Review | review = Waiting for Review | approve → Approved, changes → Request Changes |

### Auto-Submit Logic

The Bug Investigator agent can auto-submit when all conditions are met:
- `autoSubmit: true` on the recommended option
- High confidence rating
- S complexity
- Destination is `implement`
- A recommended option exists

When auto-submit fires, the agent calls `engine.completeAgent()` which uses **multi-match resolution**. Two transitions share `trigger: agent_complete` and `from: Bug Investigation`:

- `agent-auto-submit-investigation` (listed first) → `guard:auto-submit-conditions-met` checks all auto-submit criteria
- `agent-complete-investigation` (fallback) → no special guards

The engine evaluates the auto-submit guard first. If it passes, the item routes directly to Implementation. If not, the normal completion transition fires and the item waits for admin decision. The engine has no bug-investigator-specific logic — all disambiguation is declarative via guards in the pipeline definition.

## Cross-Pipeline Design Notes

### Undo Semantics

Both pipelines share the same undo transition: `from: '*', to: '*'` with `admin_undo` trigger. The target status comes from `context.restoreStatus`, and the `guard:undo-window-valid` guard enforces the 5-minute window.

The undo transition currently supports three scenarios:
1. **Undo Request Changes on PR** — restores to PR Review, clears review status
2. **Undo Request Changes on Design PR** — clears review status (status unchanged)
3. **Undo Design Review** — clears review status (status unchanged)

Each scenario re-sends the original notification (PR Ready, Design PR Ready, or Design Review with buttons) so the admin can make a new decision.

### Clarification Flow

Clarification is a review status sub-state, not a pipeline transition. When an agent requests clarification:
1. Agent sets review status to `Waiting for Clarification` via `completeAgent()`
2. Admin answers on GitHub
3. Admin clicks "Clarification Received" → `engine.updateReviewStatus('Clarification Received')`
4. Next agent cycle picks up the item and continues work

### Status Constants

Pipeline definitions reference `STATUSES` and `REVIEW_STATUSES` from `src/server/template/project-management/config.ts`. This ensures pipeline definitions stay in sync with the adapter's status field values:

```typescript
import { STATUSES, REVIEW_STATUSES } from '@/server/template/project-management/config';

const FEATURE_PIPELINE: PipelineDefinition = {
  statuses: [
    { id: STATUSES.backlog, label: 'Backlog' },
    { id: STATUSES.productDevelopment, label: 'Product Development', isDesignPhase: true },
    // ...
  ],
  // ...
};
```

### Task Items

Items with `type: 'task'` use the feature pipeline (`pipelineId: 'feature'`). Tasks are routed directly to implementation, skipping design phases. The pipeline supports this natively — routing to any status (including directly to Ready for Development) is already a feature pipeline capability. No separate task pipeline is needed.
