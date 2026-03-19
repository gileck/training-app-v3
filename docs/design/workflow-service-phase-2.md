# Workflow Service Phase 2: Complete Business Logic Migration

## Context

Phase 1 created `src/server/template/workflow-service/` with three operations: `approveWorkflowItem()`, `routeWorkflowItem()`, `deleteWorkflowItem()`. These handle the **entry** of items into the workflow pipeline.

However, 12 files still contain direct adapter calls, logging, and notifications for **mid-pipeline** operations: design review, PR merge, phase transitions, undo, agent completion, and decision routing. These operations are scattered across Telegram handlers, API endpoints, and agent code with the same category of bugs Phase 1 fixed: inconsistent logging, missing DB syncs, duplicated logic.

This document plans migrating ALL remaining workflow business logic into the workflow-service.

---

## Audit: Remaining Business Logic Outside workflow-service

### Telegram Webhook Handlers (5 files)

| File | Functions | Adapter Calls | Key Operations |
|------|-----------|---------------|----------------|
| `merge.ts` | `handleMergeCallback`, `handleMergeFinalPRCallback`, `createFinalPRToMain`, `handleRevertMerge`, `handleMergeRevertPR` | ~30 | PR merge, phase advancement, final PR creation, revert, branch cleanup, mark done |
| `design-review.ts` | `handleDesignReviewAction` | 6 | Design approval/changes/reject, auto-advance to next phase |
| `design-pr.ts` | `handleDesignPRApproval`, `handleDesignPRRequestChanges`, `handleRequestChangesCallback` | 15 | Design PR merge, status advancement, phase initialization, request changes |
| `undo.ts` | `handleUndoRequestChanges`, `handleUndoDesignChanges`, `handleUndoDesignReview` | 12 | Restore previous status/review within 5-min window, re-send notifications |
| `clarification.ts` | `handleClarificationReceived` | 4 | Update review status to "Clarification Received" |

### API Handlers (3 files)

| File | Functions | Adapter Calls | Key Operations |
|------|-----------|---------------|----------------|
| `workflow/handlers/updateStatus.ts` | `updateStatus` | 3 (fallback) | Falls back to direct adapter for non-routable statuses |
| `agent-decision/handlers/submitDecision.ts` | `submitDecision` | 7 | Route item based on admin fix selection, set review status |
| `clarification/handlers/submitAnswer.ts` | `submitAnswer` | 4 | Post answer comment, set review status to "Clarification Received" |

### Core Agents (3 files)

| File | Functions | Adapter Calls | Key Operations |
|------|-----------|---------------|----------------|
| `implementAgent/index.ts` | `processItem` | 7 | Set status to PR Review + Waiting for Review after PR creation |
| `bugInvestigatorAgent/index.ts` | `processItem` | 4 | Set review status or route to implementation (auto-submit) |
| `prReviewAgent/index.ts` | `processItem` | 11 | Set review status (approved/changes), generate commit message |

### Standalone Agents (1 file)

| File | Functions | Adapter Calls | Key Operations |
|------|-----------|---------------|----------------|
| `auto-advance.ts` | `advanceItem` | 2 | Advance approved items to next phase, clear review status |

---

## Design Principle: Business Logic vs Transport/Infrastructure

**Moves INTO workflow-service** (business logic):
- Status transitions (what status should an item be in?)
- Review status management (set/clear review status)
- Workflow DB sync (keep `workflow-items` collection in sync)
- Agent logging (`logWebhookAction`, `logWebhookPhaseStart/End`)
- Notifications (Telegram routing)
- Source document updates (feature request status, bug report status)
- Implementation phase management (advance/clear phases)

**Stays in transport/agent layer** (infrastructure):
- Telegram message editing (transport-specific UI)
- Token claiming (Telegram-specific double-click guard)
- Undo window validation (could be service, but tightly coupled to Telegram callback timestamps)
- PR merging mechanics (`adapter.mergePullRequest`, `adapter.createPullRequest`)
- Branch management (`adapter.deleteBranch`, `adapter.createBranch`)
- Git operations (checkout, commit, push)
- Claude agent execution
- Commit message generation/storage
- GitHub comment posting (issue/PR comments)
- Phase artifact management (reading design docs, parsing phases)

**Key insight**: The adapter is used for TWO distinct purposes:
1. **Status management** (updateItemStatus, updateItemReviewStatus, clearItemReviewStatus, setImplementationPhase) — this is workflow business logic
2. **GitHub operations** (mergePullRequest, createPullRequest, deleteBranch, addIssueComment, etc.) — this is infrastructure

The workflow-service should own #1. Callers keep using the adapter directly for #2.

---

## New Service Functions

### Group 1: Review Status Management

#### `updateReviewStatus(issueNumber, reviewStatus, options?)`

Centralized review status update. Currently duplicated across 8+ files.

```typescript
interface UpdateReviewStatusOptions {
    source?: string;           // 'telegram' | 'ui' | 'agent' | 'auto-advance'
    logAction?: string;        // e.g., 'design_approve', 'clarification_received'
    logDescription?: string;   // Human-readable description for agent log
    logMetadata?: Record<string, unknown>;
}

interface UpdateReviewStatusResult {
    success: boolean;
    error?: string;
    itemId?: string;           // Project item ID (for callers that need it)
}
```

Operations:
1. Find project item by issue number (via `findItemByIssueNumber`)
2. Update review status via adapter
3. Sync to workflow-items DB
4. Agent logging
5. Return item ID for callers that need to chain further operations

Used by: `design-review.ts`, `design-pr.ts`, `clarification.ts`, `submitAnswer.ts`, `submitDecision.ts`, `prReviewAgent`, `bugInvestigatorAgent`, `implementAgent`

#### `clearReviewStatus(issueNumber, options?)`

Convenience wrapper that calls `updateReviewStatus(issueNumber, '', options)` with the clear semantics.

Used by: `design-review.ts` (after auto-advance), `design-pr.ts` (after advancement), `undo.ts` (restore), `merge.ts` (after merge), `auto-advance.ts`

### Group 2: Status Transitions

#### `advanceStatus(issueNumber, toStatus, options?)`

Move an item to a new workflow status. More general than `routeWorkflowItem` (which is for initial routing with routing destination validation).

```typescript
interface AdvanceStatusOptions {
    clearReviewStatus?: boolean;  // Default: true
    clearImplementationPhase?: boolean;
    source?: string;
    logAction?: string;
    logDescription?: string;
    logMetadata?: Record<string, unknown>;
}

interface AdvanceStatusResult {
    success: boolean;
    error?: string;
    itemId?: string;
    previousStatus?: string;
}
```

Operations:
1. Find project item by issue number
2. Update status via adapter
3. Optionally clear review status
4. Optionally clear implementation phase
5. Sync to workflow-items DB
6. Agent logging
7. Return previous status for undo support

Used by: `design-review.ts` (auto-advance), `design-pr.ts` (advance after merge), `merge.ts` (set to Done, set to Final Review, set to Implementation for next phase), `auto-advance.ts`, `handleRequestChangesCallback` (set to Implementation), `handleRevertMerge` (restore to Implementation)

**Why not extend `routeWorkflowItem`?** Route validates against a routing map and is designed for initial routing. Mid-pipeline transitions (e.g., "move from Tech Design to Implementation after design PR merge") don't go through routing validation — they follow fixed state machine rules.

#### `markDone(issueNumber, options?)`

Specialized status transition that also updates source documents.

```typescript
interface MarkDoneOptions {
    source?: string;
    logAction?: string;
    logDescription?: string;
    logMetadata?: Record<string, unknown>;
}

interface MarkDoneResult {
    success: boolean;
    error?: string;
    itemType?: 'feature' | 'bug';
}
```

Operations:
1. Find project item by issue number
2. Set status to Done
3. Clear review status
4. Clear implementation phase
5. Update source document: feature → `status: 'done'`, bug → `status: 'resolved'`
6. Sync to workflow-items DB
7. Agent logging

Used by: `merge.ts` (`handleMergeCallback` single-phase done, `handleMergeFinalPRCallback` final merge done)

**Why a separate function?** Marking done has side effects (source doc update) that other status transitions don't have. It also always clears both review status and implementation phase. Making it a dedicated function avoids forgetting these steps.

### Group 3: Implementation Phase Management

#### `advanceImplementationPhase(issueNumber, nextPhase, options?)`

Set the implementation phase field and update status for multi-phase workflows.

```typescript
interface AdvancePhaseOptions {
    status?: string;  // Status to set (default: STATUSES.implementation)
    source?: string;
    logAction?: string;
    logDescription?: string;
    logMetadata?: Record<string, unknown>;
}

interface AdvancePhaseResult {
    success: boolean;
    error?: string;
    itemId?: string;
}
```

Operations:
1. Find project item by issue number
2. Set implementation phase (e.g., "2/3")
3. Update status (usually back to Implementation for next phase)
4. Clear review status
5. Agent logging

Used by: `merge.ts` (`handleMergeCallback` multi-phase middle)

#### `clearImplementationPhase(issueNumber, options?)`

Clear the phase field (after all phases complete or on done).

Used by: `merge.ts` (`handleMergeFinalPRCallback`, `handleMergeCallback` single-phase completion)

### Group 4: Agent Completion

#### `completeAgentRun(issueNumber, agentType, result, options?)`

Agents call this when they finish processing an item. Centralizes the status/review transition at agent completion.

```typescript
type AgentType = 'implementation' | 'bug-investigation' | 'pr-review';

interface AgentRunResult {
    status?: string;                // New status to set (e.g., STATUSES.prReview)
    reviewStatus?: string;          // New review status (e.g., REVIEW_STATUSES.waitingForReview)
    clearReviewStatus?: boolean;    // Clear instead of set
}

interface CompleteAgentRunOptions {
    source?: string;
    logAction?: string;
    logDescription?: string;
    logMetadata?: Record<string, unknown>;
}

interface CompleteAgentRunResult {
    success: boolean;
    error?: string;
    itemId?: string;
}
```

Operations:
1. Find project item by issue number
2. If `result.status`: update status
3. If `result.reviewStatus`: update review status; if `result.clearReviewStatus`: clear review status
4. Sync to workflow-items DB
5. Agent logging

Used by:
- `implementAgent`: `completeAgentRun(issueNumber, 'implementation', { status: STATUSES.prReview, reviewStatus: REVIEW_STATUSES.waitingForReview })`
- `bugInvestigatorAgent` (auto-submit): `completeAgentRun(issueNumber, 'bug-investigation', { status: 'Ready for development', clearReviewStatus: true })`
- `bugInvestigatorAgent` (manual): `completeAgentRun(issueNumber, 'bug-investigation', { reviewStatus: REVIEW_STATUSES.waitingForReview })`
- `prReviewAgent` (approved): `completeAgentRun(issueNumber, 'pr-review', { reviewStatus: REVIEW_STATUSES.approved })`
- `prReviewAgent` (changes): `completeAgentRun(issueNumber, 'pr-review', { reviewStatus: REVIEW_STATUSES.requestChanges })`

### Group 5: Decision Routing

#### `submitDecisionRouting(issueNumber, targetStatus, options?)`

Route an item based on an admin decision (fix selection). Different from `routeWorkflowItem` because it works with raw status strings and issue numbers, not source doc IDs and routing destinations.

```typescript
interface SubmitDecisionRoutingOptions {
    clearReviewStatus?: boolean;  // Default: true when routing
    reviewStatus?: string;        // Set specific review status instead of routing
    source?: string;
    logAction?: string;
    logDescription?: string;
    logMetadata?: Record<string, unknown>;
}

interface SubmitDecisionRoutingResult {
    success: boolean;
    error?: string;
    itemId?: string;
}
```

Operations:
1. Find project item by issue number (caller provides `itemId` from verification, but we find by issue number for consistency)
2. If `targetStatus`: update status + clear review status
3. If `reviewStatus`: set review status (for cases where no routing, just approval for agent pickup)
4. Sync to workflow-items DB
5. Agent logging

Used by: `submitDecision.ts`

**Alternative**: Could reuse `advanceStatus` + `updateReviewStatus`. But `submitDecision` has a unique pattern where it either routes OR sets review status, never both. A dedicated function makes the intent clear.

### Group 6: Auto-Advance

#### `autoAdvanceApproved(options?)`

Batch operation: find all approved items and advance them to the next phase.

```typescript
interface AutoAdvanceOptions {
    dryRun?: boolean;
}

interface AutoAdvanceResult {
    total: number;
    advanced: number;
    failed: number;
    details: Array<{
        issueNumber?: number;
        title?: string;
        from: string;
        to: string;
        success: boolean;
        error?: string;
    }>;
}
```

Operations:
1. List all items with reviewStatus = "Approved"
2. For each, look up next status from STATUS_TRANSITIONS map
3. Skip PR Review items (handled by merge flow)
4. Call `advanceStatus()` for each
5. Send notification per transition
6. Return batch results

Used by: `auto-advance.ts` (becomes a thin CLI wrapper)

### Group 7: Undo Operations

#### `undoStatusChange(issueNumber, restoreStatus, restoreReviewStatus?, options?)`

Restore an item to a previous state within an undo window.

```typescript
interface UndoOptions {
    timestamp: number;           // Original action timestamp for window validation
    undoWindowMinutes?: number;  // Default: 5
    source?: string;
    logAction?: string;
    logDescription?: string;
    logMetadata?: Record<string, unknown>;
}

interface UndoResult {
    success: boolean;
    error?: string;
    expired?: boolean;   // True if undo window expired
    alreadyDone?: boolean; // True if already in target state (idempotent)
    itemId?: string;
}
```

Operations:
1. Validate undo window (current time - timestamp < windowMinutes)
2. Find project item by issue number
3. Check idempotency (already in target state?)
4. Update status and/or review status
5. Agent logging

Used by: `undo.ts` (all 3 handlers)

**Note**: The undo window validation could be in the Telegram handler or the service. Putting it in the service makes it available to future transports (e.g., a "undo" button in the UI). The Telegram handler still handles message editing (transport concern).

---

## Shared Infrastructure: `findItemByIssueNumber`

Currently lives in `src/pages/api/telegram-webhook/utils.ts`. Multiple service functions need to resolve an issue number to a project item ID. This should move into the workflow-service as a shared utility.

```typescript
// src/server/template/workflow-service/utils.ts
export async function findItemByIssueNumber(
    issueNumber: number
): Promise<ProjectItem | null>
```

Difference from current: the current function takes an `adapter` parameter (caller initializes). The service version initializes the adapter internally (or uses a shared singleton pattern).

### Adapter Initialization

Currently every function does:
```typescript
const adapter = getProjectManagementAdapter();
await adapter.init();
```

For the service layer, we should either:
- **Option A**: Each service function initializes its own adapter (current pattern, simple)
- **Option B**: Service functions accept an optional pre-initialized adapter, or use a module-level lazy singleton

**Recommendation**: Option A for simplicity. The adapter's `init()` is cheap (cached after first call). If performance becomes an issue, we can add singleton caching later.

---

## Migration Plan

### Step 1: Create shared utilities

Create `src/server/template/workflow-service/utils.ts`:
- `findItemByIssueNumber(issueNumber)` — moved from telegram-webhook utils
- `findSourceDocByIssueNumber(issueNumber)` — looks up feature request or bug report by github issue number
- `getInitializedAdapter()` — convenience wrapper for `getProjectManagementAdapter() + init()`
- `syncWorkflowStatus(issueNumber, status)` — sync status to workflow-items DB by looking up via source ref

### Step 2: Create review status service

Create `src/server/template/workflow-service/review-status.ts`:
- `updateReviewStatus(issueNumber, reviewStatus, options?)`
- `clearReviewStatus(issueNumber, options?)`

### Step 3: Create status transition service

Create `src/server/template/workflow-service/advance.ts`:
- `advanceStatus(issueNumber, toStatus, options?)`
- `markDone(issueNumber, options?)`

### Step 4: Create phase management service

Create `src/server/template/workflow-service/phase.ts`:
- `advanceImplementationPhase(issueNumber, nextPhase, options?)`
- `clearImplementationPhase(issueNumber, options?)`

### Step 5: Create agent completion service

Create `src/server/template/workflow-service/agent-complete.ts`:
- `completeAgentRun(issueNumber, agentType, result, options?)`

### Step 6: Create decision routing service

Create `src/server/template/workflow-service/decision.ts`:
- `submitDecisionRouting(issueNumber, targetStatus, options?)`

### Step 7: Create undo service

Create `src/server/template/workflow-service/undo.ts`:
- `undoStatusChange(issueNumber, restoreStatus, restoreReviewStatus?, options?)`

### Step 8: Create auto-advance service

Create `src/server/template/workflow-service/auto-advance.ts`:
- `autoAdvanceApproved(options?)`

### Step 9: Update index.ts exports

Add all new functions to `src/server/template/workflow-service/index.ts`.

### Step 10: Migrate Telegram handlers

#### `design-review.ts`
- Replace `adapter.updateItemReviewStatus()` → `updateReviewStatus()`
- Replace `adapter.updateItemStatus()` + `adapter.clearItemReviewStatus()` (auto-advance) → `advanceStatus()`
- Remove: adapter init, `findItemByIssueNumber`, logging calls
- Keep: Telegram message editing, undo button generation

#### `design-pr.ts`
- `handleDesignPRApproval`: Replace status advancement → `advanceStatus()`, replace review status clear → `clearReviewStatus()`
- `handleDesignPRRequestChanges`: Replace → `updateReviewStatus()`
- `handleRequestChangesCallback`: Replace → `advanceStatus()` + `updateReviewStatus()`
- Keep: PR merging, branch deletion, phase initialization, design artifact storage, message editing

#### `merge.ts`
- `handleMergeCallback`:
  - Multi-phase middle: Replace → `advanceImplementationPhase()`
  - Single-phase/final-phase done: Replace → `markDone()`
  - Replace review status clears → `clearReviewStatus()`
- `handleMergeFinalPRCallback`: Replace done logic → `markDone()`
- `handleRevertMerge`: Replace status restore → `advanceStatus()` + `updateReviewStatus()`
- `handleMergeRevertPR`: No status changes, only PR merge — **no migration needed**
- Keep: PR merging, branch deletion, final PR creation, commit message retrieval, message editing, source doc updates (in markDone)

#### `undo.ts`
- All 3 handlers: Replace status/review restoration → `undoStatusChange()`
- Keep: Undo window validation (or move to service), message editing, re-notification sending

#### `clarification.ts`
- Replace → `updateReviewStatus()`
- Keep: Message editing, validation that item is waiting for clarification

### Step 11: Migrate API handlers

#### `updateStatus.ts`
- Replace fallback direct adapter calls → `advanceStatus()`
- The primary path already uses `routeWorkflowItemByWorkflowId()`
- Fallback for non-routable statuses (PR Review, Done, Final Review, Bug Investigation) should use `advanceStatus()` instead of direct adapter

#### `submitDecision.ts`
- Replace `adapter.updateItemStatus()` + `adapter.updateItemReviewStatus()` → `submitDecisionRouting()` or `advanceStatus()` + `updateReviewStatus()`
- Keep: Token validation, decision data loading, comment posting, selection persistence, notification

#### `submitAnswer.ts`
- Replace `adapter.updateItemReviewStatus()` → `updateReviewStatus()`
- Keep: Token validation, answer formatting, comment posting

### Step 12: Migrate core agents

#### `implementAgent/index.ts`
- Replace `adapter.updateItemStatus(item.id, STATUSES.prReview)` + `adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForReview)` → `completeAgentRun(issueNumber, 'implementation', { status: STATUSES.prReview, reviewStatus: REVIEW_STATUSES.waitingForReview })`
- Keep: Everything else (git operations, Claude agent execution, PR creation, branch management, all 30+ other adapter calls for GitHub operations)

#### `bugInvestigatorAgent/index.ts`
- Auto-submit path: Replace `adapter.updateItemStatus()` + clear review → `completeAgentRun(issueNumber, 'bug-investigation', { status: 'Ready for development', clearReviewStatus: true })`
- Manual path: Replace `adapter.updateItemReviewStatus()` → `completeAgentRun(issueNumber, 'bug-investigation', { reviewStatus: REVIEW_STATUSES.waitingForReview })`
- Keep: Investigation execution, comment posting, decision DB persistence, notification

#### `prReviewAgent/index.ts`
- Replace `adapter.updateItemReviewStatus()` → `completeAgentRun(issueNumber, 'pr-review', { reviewStatus })`
- Keep: PR review execution, commit message generation, GitHub review submission, phase status persistence, all other PR-related adapter calls

### Step 13: Migrate auto-advance

- `auto-advance.ts` becomes a thin wrapper calling `autoAdvanceApproved()`
- Or: Replace `advanceItem()` internals with `advanceStatus()` calls (simpler, keeps the batch orchestration in the standalone agent)

### Step 14: Cleanup

- Remove `findItemByIssueNumber` from `telegram-webhook/utils.ts` (replaced by service utility)
- Remove direct `logWebhookAction` imports from migrated handlers
- Remove direct `getProjectManagementAdapter` imports from migrated handlers (for status operations only — keep for GitHub operations)
- Update `telegram-webhook/constants.ts` if any status maps moved

### Step 15: Documentation

- Update `docs/template/github-agents-workflow/workflow-service.md` with new service functions
- Run `yarn build:claude`

### Step 16: Verification

- `yarn checks` must pass
- Test each migrated flow:
  - Design review (approve/changes/reject) via Telegram
  - Design PR merge via Telegram
  - Implementation PR merge (single-phase and multi-phase) via Telegram
  - Request changes on implementation PR via Telegram
  - Undo operations (all 3 types) via Telegram
  - Auto-advance script
  - Bug investigation agent completion (auto-submit and manual)
  - Implementation agent PR creation
  - PR review agent decision
  - Decision submission via UI
  - Clarification answer submission via UI
  - Status update via UI dropdown

---

## Files Modified

### New Files

| File | Description |
|------|-------------|
| `src/server/template/workflow-service/utils.ts` | Shared utilities: findItemByIssueNumber, getInitializedAdapter, syncWorkflowStatus |
| `src/server/template/workflow-service/review-status.ts` | Review status management |
| `src/server/template/workflow-service/advance.ts` | Status transitions + markDone |
| `src/server/template/workflow-service/phase.ts` | Implementation phase management |
| `src/server/template/workflow-service/agent-complete.ts` | Agent completion status updates |
| `src/server/template/workflow-service/decision.ts` | Decision routing |
| `src/server/template/workflow-service/undo.ts` | Undo with time window |
| `src/server/template/workflow-service/auto-advance.ts` | Batch auto-advance for approved items |

### Modified Files

| File | Change |
|------|--------|
| `src/server/template/workflow-service/index.ts` | Add all new exports |
| `src/pages/api/telegram-webhook/handlers/design-review.ts` | Replace adapter calls with service |
| `src/pages/api/telegram-webhook/handlers/design-pr.ts` | Replace status/review adapter calls with service |
| `src/pages/api/telegram-webhook/handlers/merge.ts` | Replace status/review/phase adapter calls with service |
| `src/pages/api/telegram-webhook/handlers/undo.ts` | Replace status/review adapter calls with service |
| `src/pages/api/telegram-webhook/handlers/clarification.ts` | Replace adapter calls with service |
| `src/pages/api/telegram-webhook/utils.ts` | Remove findItemByIssueNumber (moved to service) |
| `src/apis/template/workflow/handlers/updateStatus.ts` | Replace fallback direct adapter with advanceStatus |
| `src/apis/template/agent-decision/handlers/submitDecision.ts` | Replace adapter calls with service |
| `src/apis/template/clarification/handlers/submitAnswer.ts` | Replace adapter calls with service |
| `src/agents/core-agents/implementAgent/index.ts` | Replace completion status calls with completeAgentRun |
| `src/agents/core-agents/bugInvestigatorAgent/index.ts` | Replace completion status calls with completeAgentRun |
| `src/agents/core-agents/prReviewAgent/index.ts` | Replace completion status calls with completeAgentRun |
| `src/agents/auto-advance.ts` | Replace with autoAdvanceApproved or use advanceStatus |
| `docs/template/github-agents-workflow/workflow-service.md` | Document new service functions |

---

## Architecture After Phase 2

```
TRANSPORT / AGENT LAYER
(parse input, call service for status, use adapter for GitHub ops, format output)

┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Telegram    │ │  UI API      │ │  CLI         │ │  Agents      │
│  handlers    │ │  handlers    │ │  commands    │ │              │
│             │ │              │ │              │ │ • implement  │
│ • msg edit  │ │ • admin      │ │ • arg parse  │ │ • bug invest │
│ • token     │ │   validation │ │ • dry-run    │ │ • pr review  │
│ • PR merge  │ │ • JSON resp  │ │ • console    │ │ • Claude run │
│ • branch    │ │ • comments   │ │              │ │ • git ops    │
│   cleanup   │ │              │ │              │ │              │
└──────┬──────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │               │                │                │
       ▼               ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   WORKFLOW SERVICE LAYER                         │
│  src/server/template/workflow-service/                                    │
│                                                                  │
│  ENTRY:                                                          │
│    approveWorkflowItem()   routeWorkflowItem()                  │
│    deleteWorkflowItem()                                          │
│                                                                  │
│  MID-PIPELINE:                                                   │
│    updateReviewStatus()    clearReviewStatus()                  │
│    advanceStatus()         markDone()                            │
│    advanceImplementationPhase()  clearImplementationPhase()     │
│    completeAgentRun()      submitDecisionRouting()              │
│    undoStatusChange()      autoAdvanceApproved()                │
│                                                                  │
│  UTILITIES:                                                      │
│    findItemByIssueNumber()  getInitializedAdapter()             │
│    syncWorkflowStatus()                                          │
│                                                                  │
│  CONSTANTS:                                                      │
│    STATUS_TRANSITIONS      ROUTING_DESTINATION_LABELS           │
│    FEATURE_ROUTING_STATUS_MAP  BUG_ROUTING_STATUS_MAP           │
│                                                                  │
│  Every function handles:                                         │
│    ✓ Adapter status/review updates                              │
│    ✓ Workflow-items DB sync                                      │
│    ✓ Agent logging                                               │
│    ✓ Notifications (where applicable)                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                           │
│                                                                  │
│  project-mgmt/       github-sync/      database/    telegram/   │
│  (adapter for        (issue creation   (MongoDB     (message    │
│   status + GitHub    on approval)      collections) sending)    │
│   operations)                                                    │
└─────────────────────────────────────────────────────────────────┘
```

**After Phase 2, the adapter is used by transport/agents ONLY for GitHub operations:**
- PR merging, creation, review submission
- Branch management
- Issue/PR comments
- File operations

**All status/review/phase management goes through workflow-service.**

---

## What Does NOT Move

These stay in their current locations because they're infrastructure or agent-specific:

1. **PR merge mechanics** (`adapter.mergePullRequest`) — GitHub operation, not status logic
2. **Branch management** (`adapter.deleteBranch`, `adapter.createBranch`) — Git infrastructure
3. **Issue/PR comments** (`adapter.addIssueComment`, `adapter.submitPRReview`) — GitHub communication
4. **Commit message generation** — PR review agent-specific logic
5. **Phase artifact management** (reading design docs, parsing phases) — Agent-specific
6. **Design artifact storage** — Domain-specific persistence
7. **Claude agent execution** — Agent infrastructure
8. **Git operations** (checkout, commit, push) — Agent infrastructure
9. **Telegram message editing** — Transport-specific UI
10. **Token claiming** — Telegram-specific double-click guard
11. **Notification re-sending after undo** — Transport-specific (re-sends the original notification format)

---

## Edge Cases

### Adapter calls that chain: merge then status update
`merge.ts` often does: merge PR → update status → clear review → clean up branches. The service handles the status/review part. The caller handles merge and branch cleanup. The order is: merge first (can fail), then call service for status (idempotent), then cleanup (best-effort).

### Agent processes that need `item.id` for adapter GitHub operations
Agents like `implementAgent` use `item.id` (project item ID) for both status updates AND GitHub operations (e.g., finding open PRs). After migration, the agent still gets the item ID from the adapter for GitHub operations. The service function returns `itemId` in its result so the agent can chain further adapter calls if needed.

### Multiple status changes in one flow
Some flows change both status AND review status (e.g., merge → Done + clear review + clear phase). The service functions handle this atomically. `markDone()` does all three in one call. For other combinations, callers chain service functions (e.g., `advanceStatus()` then `updateReviewStatus()`).

### Undo needs to know "previous state"
Undo handlers receive the previous state via Telegram callback data (encoded in the button). The service's `undoStatusChange()` doesn't need to know what the "correct" previous state was — it just applies whatever the caller says to restore. The caller (Telegram handler) is responsible for encoding and decoding the previous state.
