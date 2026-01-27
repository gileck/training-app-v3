# GitHub Agents Workflow - Complete Process Guide

This document describes the complete workflow from feature request submission to merged PR.

## Unified Approval & Routing Flow

Both **feature requests** and **bug reports** follow the same approval and routing process.

### Step 1: User Submission

User submits via app UI → stored in MongoDB with status `pending`.

```typescript
// Feature request
{
  title: "Add dark mode",
  description: "...",
  status: "pending",
  type: "feature"
}

// Bug report
{
  title: "Login button not working",
  description: "...",
  status: "pending",
  type: "bug"
}
```

### Step 2: Admin Approval Notification

Admin receives Telegram message with inline keyboard:

```
📋 New Feature Request

Title: Add dark mode
Description: ...
Submitted by: user@example.com

[Approve] [Reject]
```

Or for bugs:

```
🐛 New Bug Report

Title: Login button not working
Description: ...
Submitted by: user@example.com
Steps to reproduce: ...

[Approve] [Reject]
```

### Step 3: Admin Decision

**If Rejected:**
- MongoDB status → `rejected`
- User notified (if configured)
- Workflow ends

**If Approved:**
1. MongoDB status → `approved`
2. Server creates GitHub Issue
3. Server adds issue to GitHub Projects (Backlog column)
4. Admin receives routing notification

### Step 4: Routing Decision

Admin receives second Telegram message:

```
🎯 Where should this start?

Feature: Add dark mode
Issue #123

Choose starting phase:

[📋 Product Dev]
[🎨 Product Design]
[🔧 Tech Design]
[⚡ Ready for Development]
[📋 Stay in Backlog]
```

**Routing Options:**

| Button | When to Use | Next Step |
|--------|-------------|-----------|
| 📋 **Product Dev** | Vague idea, needs product spec | Product Development Agent runs |
| 🎨 **Product Design** | Needs UX/UI design | Product Design Agent runs |
| 🔧 **Tech Design** | Needs architecture planning | Tech Design Agent runs |
| ⚡ **Ready for Dev** | Simple, clear requirements | Implementation Agent runs |
| 📋 **Stay in Backlog** | Defer for now | Stays in Backlog |

> **Note:** Product Development is **OPTIONAL** and only for features (not bugs). Use it when the feature idea is vague and needs to be transformed into concrete requirements before design work.

### Step 5: Item Moves to Selected Phase

Server updates GitHub Projects status to match selection:

```typescript
// Admin chose "Product Design"
await adapter.updateStatus(projectItemId, 'productDesign');

// Admin chose "Tech Design"
await adapter.updateStatus(projectItemId, 'techDesign');

// Admin chose "Ready for Development"
await adapter.updateStatus(projectItemId, 'readyForDev');

// Admin chose "Stay in Backlog"
await adapter.updateStatus(projectItemId, 'backlog');
```

### Step 6: Agent Processing

Based on the selected phase, the appropriate agent processes the item:

**Product Development Phase (OPTIONAL - Features Only):**
- Agent reads vague feature idea
- Explores codebase for context (READ-ONLY mode)
- Generates Product Development Document (PDD) with:
  - Size estimate (S/M/L/XL)
  - Problem statement
  - Target users
  - Requirements with acceptance criteria
  - Success metrics
  - Scope (in/out)
- Creates PR with PDD file at `design-docs/issue-{N}/product-development.md`
- Sets GitHub Projects status to "Product Development"
- On approval: auto-advances to Product Design

**Product Design Phase:**
- Agent reads feature/bug details (and PDD if exists from Product Development phase)
- Generates design document (markdown/screenshots)
- Creates PR with design file
- Sets GitHub Projects status to "Product Design"

**Tech Design Phase:**
- Agent reads requirements (and product design if exists)
- Generates technical design document
- Creates PR with tech design
- Sets status to "Technical Design"

**Ready for Development:**
- Agent implements the feature/fix
- Creates PR with code changes
- Sets status to "PR Review"

### Step 7: Design PR Approval

For design phases, admin receives Telegram notification:

```
📄 Design Ready for Review

Feature: Add dark mode
PR #124: Product design for dark mode

[View PR](https://github.com/...)

[Approve & Merge] [Request Changes]
```

**If Approved:**
1. PR auto-merges
2. Status advances to next phase
3. Next agent processes item

**If Changes Requested:**
- Admin comments on PR explaining needed changes
- Agent doesn't re-run automatically
- Manual intervention required

### Step 8: Implementation PR Review

When implementation is complete:

1. **Agent Creates PR:**
   - Code changes
   - Status → "Waiting for Review" (in Projects)
   - Sets Review Status field

2. **PR Review Agent (Cron):**
   - Runs every 6 hours
   - Finds PRs with Review Status = "Waiting for Review"
   - Reviews code against requirements
   - Posts review comment
   - Generates commit message
   - Sends admin notification

3. **Admin Receives Telegram:**
   ```
   ✅ PR Review Complete

   Feature: Add dark mode
   PR #125

   Result: Approved
   [View Review](https://github.com/...)

   [Merge PR] [Request Changes]
   ```

### Step 9: PR Merge

**If Admin Merges:**
1. Server merges PR (squash merge)
2. GitHub webhook triggers
3. Server marks item as Done in Projects
4. MongoDB status → `done`
5. Admin notified of completion

**If Changes Requested:**
- Admin comments on PR
- Status → "Waiting for Changes"
- Agent re-implements when status returns to "Waiting for Review"

## Visual Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED SUBMISSION FLOW                          │
│                    (Features & Bugs - Same Process)                     │
└─────────────────────────────────────────────────────────────────────────┘

                              User Submits
                          (Feature or Bug Report)
                                   │
                                   ↓
                           MongoDB: "pending"
                                   │
                                   ↓
                       ┌───────────────────────┐
                       │  Admin Notification   │
                       │  [Approve] [Reject]   │
                       └───────────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  ↓                                 ↓
            [Rejected]                         [Approved]
                  │                                 │
        MongoDB: "rejected"              MongoDB: "approved"
                  │                                 │
              Workflow Ends              Create GitHub Issue
                                                   │
                                          Add to Projects (Backlog)
                                                   │
                                                   ↓
                                    ┌──────────────────────────┐
                                    │   Routing Notification   │
                                    │ Where should this start? │
                                    └──────────────────────────┘
                                              │
            ┌──────────────┬──────────────────┼──────────────────┬──────────────┐
            ↓              ↓                  ↓                  ↓              ↓
      [Product Design] [Tech Design] [Ready for Dev]     [Stay in Backlog]
            │              │                  │                  │
            ↓              ↓                  ↓                  ↓
   Status: Product    Status: Tech     Status: Ready      Status: Backlog
        Design           Design          for Dev
            │              │                  │                  │
            ↓              ↓                  ↓                  │
   ┌────────────────────────────────────────────────────┐       │
   │              AGENT PROCESSING                      │       │
   └────────────────────────────────────────────────────┘       │
            │              │                  │                  │
            ↓              ↓                  │                  │
   Product Design    Tech Design              │                  │
      Agent            Agent                  │                  │
            │              │                  │                  │
            ↓              ↓                  │                  │
      Create PR       Create PR               │                  │
   (design file)   (tech design)              │                  │
            │              │                  │                  │
            ↓              ↓                  │                  │
   ┌────────────────────────────────┐        │                  │
   │  Design PR Approval            │        │                  │
   │  [Approve & Merge] [Changes]   │        │                  │
   └────────────────────────────────┘        │                  │
            │                                 │                  │
      [If Approved]                           │                  │
            │                                 │                  │
            ↓                                 │                  │
      PR Auto-Merges                          │                  │
            │                                 │                  │
   Status: Next Phase                         │                  │
            │                                 │                  │
            ├─────────────────────────────────┤                  │
            ↓                                 ↓                  │
   ┌─────────────────────────────────────────────────┐          │
   │         Status: Ready for Development           │          │
   └─────────────────────────────────────────────────┘          │
                        │                                        │
                        ↓                                        │
              Implementation Agent                               │
                        │                                        │
                        ↓                                        │
              Create PR (code changes)                           │
                        │                                        │
                        ↓                                        │
          Status: PR Review (Waiting for Review)                │
                        │                                        │
                        ↓                                        │
   ┌────────────────────────────────────────────────┐           │
   │          PR REVIEW (Cron Every 6h)             │           │
   │  1. Review code against requirements           │           │
   │  2. Generate commit message                    │           │
   │  3. Notify admin with [Merge] [Changes]        │           │
   └────────────────────────────────────────────────┘           │
                        │                                        │
            ┌───────────┴───────────┐                            │
            ↓                       ↓                            │
       [Merge PR]           [Request Changes]                    │
            │                       │                            │
            ↓                       ↓                            │
     Squash Merge          Status: Waiting for Changes          │
            │                       │                            │
            ↓                       └──> Manual Intervention     │
   GitHub Webhook                                                │
            │                                                    │
            ↓                                                    │
   Mark as Done (Projects)                                       │
            │                                                    │
   MongoDB: "done"                                               │
            │                                                    │
            ↓                                                    │
   Admin Notification                                            │
            │                                                    │
            ↓                                                    │
      Workflow Complete ←───────────────────────────────────────┘
```

## Admin Actions Reference

| Scenario | Action | Result |
|----------|--------|--------|
| New submission received | Click **Approve** | Creates GitHub Issue + routing notification |
| New submission received | Click **Reject** | MongoDB status → `rejected`, workflow ends |
| Routing notification | Click **📋 Product Dev** | Status → Product Development, agent runs (features only) |
| Routing notification | Click **🎨 Product Design** | Status → Product Design, agent runs |
| Routing notification | Click **🔧 Tech Design** | Status → Tech Design, agent runs |
| Routing notification | Click **⚡ Ready for Dev** | Status → Ready for Dev, agent runs |
| Routing notification | Click **📋 Stay in Backlog** | Status → Backlog, workflow pauses |
| Design PR notification | Click **Approve & Merge** | PR auto-merges, advances to next phase |
| Design PR notification | Click **Request Changes** | Workflow pauses, manual intervention needed |
| Implementation PR created | Click **View PR** (notification) | PR Review Agent will review automatically (cron) |
| PR review approved | Click **Merge** | Squash merge → marks Done |
| PR review approved | Click **Request Changes** | Admin comments explaining changes needed |
| Item in Backlog | Manually move in Projects | Status updates, agent may trigger |

## Alternative Workflows

The system supports several workflow variations:

### 1. Skip Design Phases

For simple features/bugs that don't need design:

```
User Submits
    ↓
Admin Approves
    ↓
Admin Routes → [⚡ Ready for Dev]
    ↓
Implementation Agent
    ↓
PR Review
    ↓
Merge → Done
```

### 2. Design-Only Features

For items that only need design documentation:

```
User Submits
    ↓
Admin Approves
    ↓
Admin Routes → [🎨 Product Design]
    ↓
Product Design Agent
    ↓
Design PR Approved
    ↓
Manually mark as Done
```

### 3. Backlog Management

For items to handle later:

```
User Submits
    ↓
Admin Approves
    ↓
Admin Routes → [📋 Stay in Backlog]
    ↓
(Item sits in Backlog)
    ↓
Admin manually moves in Projects
    ↓
Agent processes based on new status
```

### 4. Manual Implementation

For items admin wants to implement manually:

```
User Submits
    ↓
Admin Approves
    ↓
Admin Routes → [📋 Stay in Backlog]
    ↓
Developer creates PR manually
    ↓
Include in PR description:
<!-- feature-id: 507f1f77bcf86cd799439011 -->
    ↓
Merge PR
    ↓
Webhook marks as Done
```

## Bug Handling

Bugs follow the same workflow but with type-specific prompts:

### Type Detection

Agents detect bug vs feature from MongoDB:

```typescript
const item = await db.features.findById(itemId);

if (item.type === 'bug') {
  // Use bug-specific prompt
  prompt = bugPromptTemplate;
} else {
  // Use feature-specific prompt
  prompt = featurePromptTemplate;
}
```

### Bug Prompt Differences

**Feature Prompt Focus:**
- Product design
- User experience
- Feature completeness

**Bug Prompt Focus:**
- Root cause analysis
- Minimal changes
- Regression prevention
- Test coverage

### Bug-Specific Fields

Bug reports include additional context:

```typescript
{
  type: "bug",
  title: "Login button not working",
  description: "...",
  stepsToReproduce: "1. Go to login page...",
  expectedBehavior: "Should log in",
  actualBehavior: "Nothing happens",
  environment: "iOS Safari PWA"
}
```

### Bug Routing Decisions

| Complexity | Recommended Route |
|------------|-------------------|
| Simple fix (typo, minor logic) | ⚡ Ready for Dev |
| UI/UX related | 🎨 Product Design |
| Architecture/performance issue | 🔧 Tech Design |
| Unclear root cause | 🔧 Tech Design (analysis) |

## Key Implementation Details

### 1. Feature/Bug ID Embedding

All PRs must include item ID in description:

```markdown
<!-- feature-id: 507f1f77bcf86cd799439011 -->
```

This enables:
- Automatic status updates
- PR → Item linking
- Webhook processing

### 2. Review Status Tracking

GitHub Projects has separate field for PR review tracking:

| Field | Purpose | Values |
|-------|---------|--------|
| Status | Overall phase | Backlog, Product Design, etc. |
| Review Status | PR review state | Waiting for Review, Approved, Changes Requested |

### 3. Commit Message Format

PR Review Agent generates standardized commit messages:

```
feat: add dark mode toggle

Implements dark mode with system preference detection and manual toggle.

Changes:
- Add theme context provider
- Implement toggle in settings
- Update all components for theme support

Closes #123

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Format follows [Conventional Commits](https://www.conventionalcommits.org/).

### 4. Telegram Callback Data Limits

Telegram callback data limited to 64 bytes. Use short IDs:

```typescript
// Wrong - too long
callback_data: `approve_feature_507f1f77bcf86cd799439011`

// Correct - short ID
const shortId = itemId.substring(0, 8);
callback_data: `approve_${shortId}_feature`
```

### 5. Webhook Idempotency

Webhooks may be called multiple times. Ensure handlers are idempotent:

```typescript
// Check current status before updating
const currentStatus = await adapter.getStatus(projectItemId);
if (currentStatus === 'done') {
  // Already processed, skip
  return;
}

// Update status
await adapter.markAsDone(projectItemId);
```

## Next Steps

- For technical implementation details, see [reference.md](./reference.md)
- For handling multi-phase features, see [multi-phase-features.md](./multi-phase-features.md)
- For troubleshooting, see [troubleshooting.md](./troubleshooting.md)
