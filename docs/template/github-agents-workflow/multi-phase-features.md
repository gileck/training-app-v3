# GitHub Agents Workflow - Multi-Phase Features

This document explains how large (L/XL) features are split into multiple implementation phases, with each phase implemented and merged as a separate PR.

## Overview

Large features require multiple PRs to implement completely. The Tech Design Agent identifies these features and breaks them into 2-5 sequential phases, where:

- Each phase is independently mergeable (S or M size)
- Phases build upon each other sequentially
- Each phase goes through the full PR review and merge cycle
- PR Review Agent is phase-aware and only reviews the specified phase

## Multi-PR Workflow

### Phase 1: Feature Size Determination

When a feature enters the Technical Design phase:

1. **Tech Design Agent analyzes complexity:**
   - Code changes required
   - Dependencies and integrations
   - Testing requirements
   - Risk factors

2. **Agent determines size:**
   - **XS/S/M**: Single PR, standard workflow
   - **L/XL**: Multi-phase, generates phase breakdown

### Phase 2: Phase Planning (L/XL Features)

For L/XL features, Tech Design Agent:

1. **Creates technical design document** (`docs/design/tech/issue-N.md`)
   - Architecture overview
   - Implementation approach
   - Testing strategy

2. **Generates phase breakdown:**
   - 2-5 phases total
   - Each phase is S or M size
   - Sequential dependencies
   - Clear acceptance criteria

3. **Posts phases as GitHub issue comment:**
   - Deterministic format (not LLM-generated)
   - Includes marker: `<!-- AGENT_PHASES_V1 -->`
   - Each phase has title, size, and description

### Phase 3: Implementation (One Phase at a Time)

Implementation Agent processes one phase at a time:

1. **Reads phase comment from GitHub issue**
   - Parses deterministic format
   - Identifies current phase number

2. **Implements specified phase only:**
   - Follows phase requirements
   - Does NOT implement future phases
   - Creates branch: `feature/issue-N-phase-1`

3. **Creates PR with phase metadata:**
   - Title: `feat: [Phase 1/3] Feature Title`
   - Body includes: `**Phase:** 1 of 3`
   - Description of what THIS phase implements

4. **Sets review status:**
   - GitHub Projects: Review Status = "Waiting for Review"
   - Item stays in "PR Review" column

### Phase 4: Phase-Aware PR Review

PR Review Agent verifies implementation matches specified phase:

1. **Reads PR metadata:**
   - Extracts phase number from description
   - Example: `**Phase:** 2 of 3`

2. **Reads phase requirements:**
   - Gets phase comment from GitHub issue
   - Extracts requirements for THIS phase only

3. **Reviews against phase scope:**
   - Verifies PR implements ONLY this phase
   - Checks for scope creep (future phases)
   - Ensures phase is complete

4. **Generates commit message:**
   - Includes phase information
   - Saved to PR comment for merge

### Phase 5: Phase Merge & Next Phase

When admin merges a phase PR:

1. **PR merges (squash merge):**
   - Uses commit message from review agent
   - GitHub webhook triggers

2. **Check for remaining phases:**
   - If more phases exist: Implementation Agent auto-triggers
   - If final phase: Mark item as Done

3. **Implementation Agent starts next phase:**
   - Reads next phase from comment
   - Creates new branch: `feature/issue-N-phase-2`
   - Implements next phase
   - Creates new PR

4. **Cycle repeats** until all phases complete

## Phase Comment Format

Tech Design Agent posts phases in deterministic format:

```markdown
## Implementation Phases

<!-- AGENT_PHASES_V1 -->

### Phase 1: Database Schema & Models (Size: S)

Create MongoDB collections and TypeScript types for the feature.

**Deliverables:**
- Add `widgets` collection in `src/server/database/collections/`
- Define `Widget` type in `src/apis/widgets/types.ts`
- Create basic CRUD functions

**Dependencies:** None

**Acceptance Criteria:**
- [ ] Collection created with proper indexes
- [ ] Types exported and used in API
- [ ] Basic unit tests pass

---

### Phase 2: API Endpoints (Size: M)

Implement backend API handlers for widget operations.

**Deliverables:**
- Create API handlers in `src/apis/widgets/handlers/`
- Add route registration in `src/apis/widgets/index.ts`
- Server-side validation

**Dependencies:** Phase 1 (database layer)

**Acceptance Criteria:**
- [ ] All CRUD endpoints implemented
- [ ] Input validation working
- [ ] API tests pass

---

### Phase 3: Frontend UI (Size: M)

Build React components and integrate with API.

**Deliverables:**
- Widget list component
- Widget form component
- React Query hooks
- Route registration

**Dependencies:** Phase 2 (API endpoints)

**Acceptance Criteria:**
- [ ] Components render correctly
- [ ] API integration working
- [ ] Optimistic updates functional
- [ ] Offline support working
```

### Key Elements:

1. **Marker:** `<!-- AGENT_PHASES_V1 -->` enables reliable parsing
2. **Phase Header:** `### Phase N: Title (Size: S/M)`
3. **Description:** What this phase accomplishes
4. **Deliverables:** Specific files/changes
5. **Dependencies:** Which phases must complete first
6. **Acceptance Criteria:** Checkboxes for completion

## Pull Request Format

Each phase PR follows this format:

### PR Title

```
feat: [Phase 1/3] Add widget management - database layer
```

Format: `<type>: [Phase N/Total] <feature> - <phase focus>`

### PR Description

```markdown
**Related Issue:** #123
**Phase:** 1 of 3
**Size:** S

<!-- feature-id: 507f1f77bcf86cd799439011 -->

## Summary

Implements Phase 1 of the widget management feature, focusing on the database layer.

## Changes

- Added `widgets` collection with proper indexes
- Defined TypeScript types in `src/apis/widgets/types.ts`
- Created CRUD functions for widget operations
- Added unit tests for database operations

## Phase Plan

This is Phase 1 of 3:
- **Phase 1 (this PR)**: Database schema & models ✅
- **Phase 2 (next)**: API endpoints
- **Phase 3 (future)**: Frontend UI

## Testing

- [x] Unit tests pass
- [x] TypeScript compiles
- [x] Database indexes created

## Review Focus

Please focus on:
- Database schema design
- Type definitions
- Index strategy
```

### Key Metadata

1. **Phase indicator:** `**Phase:** 1 of 3`
   - Used by PR Review Agent
   - Must be exact format

2. **Feature ID:** `<!-- feature-id: 507f1f77bcf86cd799439011 -->`
   - Links PR to original request
   - Used by webhooks

3. **Phase plan:** Shows all phases
   - Current phase marked with ✅
   - Provides context for reviewers

## Issue Status Comments

As phases progress, the GitHub issue gets status updates:

### After Phase 1 Merge

```markdown
## Phase 1 Status: ✅ Complete

**PR:** #125 (merged)
**Completed:** 2024-01-15

Database schema and models implemented. Ready for Phase 2 (API endpoints).
```

### After Phase 2 Merge

```markdown
## Phase 2 Status: ✅ Complete

**PR:** #126 (merged)
**Completed:** 2024-01-16

API endpoints implemented. Ready for Phase 3 (Frontend UI).
```

### After Final Phase

```markdown
## All Phases Complete ✅

**Phase 1:** Database layer - #125 (merged)
**Phase 2:** API endpoints - #126 (merged)
**Phase 3:** Frontend UI - #127 (merged)

Widget management feature fully implemented and deployed.
```

## Phase Management

### Viewing Phase Status

1. **GitHub Issue:**
   - Look for `<!-- AGENT_PHASES_V1 -->` comment
   - Check phase status updates

2. **GitHub Projects:**
   - Item stays in "PR Review" until final phase
   - Review Status updates for each phase PR

3. **PR Descriptions:**
   - Each PR shows `**Phase:** N of Total`
   - Phase plan shows progress

### Modifying Phases

If phase requirements change:

1. **Edit phase comment** in GitHub issue
   - Maintain deterministic format
   - Update description/acceptance criteria

2. **Implementation Agent** reads updated comment
   - Gets latest requirements
   - Implements based on current version

3. **PR Review Agent** uses updated requirements
   - Reviews against latest phase definition

### Skipping Phases

To skip a phase:

1. **Edit phase comment** to mark as "Skipped"
2. **Manual intervention:** Create PR that spans multiple phases
3. **Update phase plan** in PR description

## Agent Phase Awareness

### Implementation Agent

```typescript
// Read phase comment from GitHub issue
const phaseComment = await getPhaseComment(issueNumber);

// Parse phases
const phases = parsePhases(phaseComment);

// Find next phase to implement
const nextPhase = findNextIncompletePhase(phases);

// Implement only this phase
await implementPhase(nextPhase);

// Create PR with phase metadata
await createPR({
  title: `feat: [Phase ${nextPhase.number}/${phases.length}] ${feature.title}`,
  body: generatePRDescription(nextPhase, phases),
});
```

### PR Review Agent

```typescript
// Extract phase from PR description
const prPhase = extractPhaseNumber(pr.body); // e.g., 1

// Read phase requirements
const phaseComment = await getPhaseComment(issueNumber);
const phases = parsePhases(phaseComment);
const currentPhase = phases[prPhase - 1];

// Review ONLY against this phase's requirements
const review = await reviewPhase({
  pr: pr,
  requirements: currentPhase.acceptanceCriteria,
  scope: currentPhase.deliverables,
});

// Ensure no scope creep
if (review.implementsFuturePhases) {
  return {
    approved: false,
    comment: "PR implements features from future phases. Please limit to Phase N scope.",
  };
}
```

## Benefits of Multi-Phase Approach

### 1. Smaller, Reviewable PRs

- Each PR is S or M size
- Easier to review thoroughly
- Faster feedback cycles

### 2. Incremental Progress

- Each phase is independently valuable
- Can deploy after each merge
- Reduces work-in-progress

### 3. Clear Scope

- Phase boundaries prevent scope creep
- PR Review Agent enforces phase scope
- Easier to estimate completion

### 4. Reduced Risk

- Problems detected early
- Easier to rollback if needed
- Each phase is fully tested

### 5. Better Collaboration

- Admin can provide feedback per phase
- Can adjust future phases based on learnings
- Clear progress tracking

## Example: Real-Time Collaboration Feature

**Original Request:** "Add real-time collaboration with presence indicators and live cursors"

**Size:** XL (Tech Design Agent determines)

### Tech Design Output

**Tech Design Doc:** `docs/design/tech/issue-42.md`
- WebSocket architecture
- State synchronization approach
- Conflict resolution strategy
- Testing plan

**Phase Breakdown:**

```markdown
<!-- AGENT_PHASES_V1 -->

### Phase 1: WebSocket Infrastructure (Size: M)
Set up WebSocket server and client connection management.

### Phase 2: Presence System (Size: S)
Implement user presence tracking (online/offline/idle).

### Phase 3: Cursor Tracking (Size: M)
Add real-time cursor position sharing and rendering.

### Phase 4: Document Sync (Size: M)
Implement operational transformation for text synchronization.

### Phase 5: UI Polish & Testing (Size: S)
Add animations, error handling, and comprehensive tests.
```

### Implementation Flow

1. **Admin approves tech design** → PR merged
2. **Phase 1 PR:** WebSocket infrastructure → Reviewed → Merged
3. **Phase 2 PR:** Presence system → Reviewed → Merged
4. **Phase 3 PR:** Cursor tracking → Reviewed → Merged
5. **Phase 4 PR:** Document sync → Reviewed → Merged
6. **Phase 5 PR:** UI polish → Reviewed → Merged
7. **All phases complete** → Issue marked as Done

Each phase takes 1-3 days instead of one massive 2-week PR.

## Troubleshooting

### Phase Comment Not Found

**Problem:** Agent can't find `<!-- AGENT_PHASES_V1 -->` comment

**Solutions:**
- Verify tech design PR was merged
- Check GitHub issue for phase comment
- Manually post phase comment in correct format

### Wrong Phase Implemented

**Problem:** PR implements wrong phase or multiple phases

**Solutions:**
- PR Review Agent will catch and reject
- Update PR to match specified phase only
- Split PR if it spans multiple phases

### Phase Requirements Changed

**Problem:** Requirements evolved, phase comment outdated

**Solutions:**
- Edit phase comment in GitHub issue
- Keep deterministic format
- Agents will use updated requirements

### Phases Not Sequential

**Problem:** Want to implement phases out of order

**Solutions:**
- Update phase dependencies in comment
- Implementation Agent follows dependency order
- Or manually create PRs with phase metadata

## Next Steps

- For complete workflow, see [workflow-guide.md](./workflow-guide.md)
- For technical implementation, see [reference.md](./reference.md)
- For troubleshooting, see [troubleshooting.md](./troubleshooting.md)
