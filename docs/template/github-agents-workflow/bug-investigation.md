---
title: Bug Investigation Workflow
description: Complete documentation for the Bug Investigator agent and bug fix selection flow.
summary: "Bugs are auto-routed to Bug Investigation on approval. The Bug Investigator agent performs read-only investigation, posts root cause analysis with fix options. For obvious simple fixes (high confidence, S complexity), the agent auto-submits the fix. Otherwise, admin selects a fix approach via web UI to route to Tech Design or Implementation. Telegram notifications are sent for both auto-submitted and manually selected decisions."
priority: 5
key_points:
  - "Bugs auto-route to Bug Investigation on approval (no routing message)"
  - "Bug Investigator agent uses read-only tools (Glob, Grep, Read, WebFetch)"
  - "Investigation posted as GitHub issue comment with fix options"
  - "Obvious fixes auto-submit when all conditions met: autoSubmit=true, high confidence, S complexity, destination=implement, and a recommended option exists"
  - "Admin selects fix approach via /decision/:issueNumber web UI (when not auto-submitted)"
  - "Routes to Tech Design (complex fixes) or Implementation (simple fixes)"
  - "Telegram notifications sent for auto-submits and manual submissions"
related_docs:
  - overview.md
  - workflow-e2e.md
  - setup-guide.md
---

# Bug Investigation Workflow

This document describes the complete bug investigation flow, from bug report submission through fix selection and routing.

## Overview

When a bug report is approved, it is **automatically routed** to the "Bug Investigation" column (no routing message is shown to the admin). The Bug Investigator agent then:

1. Investigates the bug using **read-only** tools (no code changes)
2. Saves investigation results to MongoDB `artifacts.decision` and posts a comment on the GitHub issue with root cause analysis and fix options
3. **If obvious fix** (all conditions met: `autoSubmit=true`, `confidence=high`, recommended option has `complexity=S` and `destination=implement`): Auto-submits the recommended option, routes directly to "Ready for development", and sends a Telegram confirmation
4. **Otherwise**: Sends a Telegram notification with links to view the investigation and select a fix approach
5. Admin selects a fix option via the `/decision/:issueNumber` web UI
6. The bug is routed to **Technical Design** or **Implementation** based on the selected option
7. A Telegram confirmation is sent after submission with the selected option and next steps

## Auto-Routing on Approval

Unlike feature requests (which show a routing message), bug reports are automatically routed:

- **Feature requests**: Approval creates GitHub issue in "Backlog" + shows routing buttons
- **Bug reports**: Approval creates GitHub issue directly in "Bug Investigation" (no routing buttons)

This is configured via `initialStatus: STATUSES.bugInvestigation` in the bug report sync config (`src/server/template/github-sync/index.ts`).

## Bug Investigator Agent

### Agent Details

| Property | Value |
|----------|-------|
| **Command** | `yarn agent:bug-investigator` |
| **Status Column** | Bug Investigation |
| **Identity** | Bug Investigator Agent |
| **Tools** | Read-only: `Read`, `Glob`, `Grep`, `WebFetch` |
| **Output** | Structured JSON (`BugInvestigationOutput`) |

### Agent Modes

| Mode | Trigger | Description |
|------|---------|-------------|
| **New** | Status = Bug Investigation, Review Status = empty | Fresh investigation |
| **Feedback** | Status = Bug Investigation, Review Status = Request Changes | Revise based on admin feedback |
| **Clarification** | Status = Bug Investigation, Review Status = Clarification Received | Continue after admin answers question |

### CLI Options

```bash
yarn agent:bug-investigator                    # Process all pending
yarn agent:bug-investigator --id <item-id>    # Process specific item
yarn agent:bug-investigator --dry-run         # Preview without saving
yarn agent:bug-investigator --stream          # Stream Claude output
```

### Output Schema

The agent outputs structured JSON with this format:

```typescript
interface FixOption {
  id: string;                              // "opt1", "opt2", etc.
  title: string;                           // Free text title
  description: string;                     // Detailed description
  destination: 'implement' | 'tech-design'; // Where to route
  complexity: 'S' | 'M' | 'L' | 'XL';    // Estimated size
  filesAffected: string[];                 // Files to modify
  tradeoffs?: string;                      // Trade-off analysis
  isRecommended: boolean;                  // Agent's recommendation
}

interface BugInvestigationOutput {
  rootCauseFound: boolean;
  confidence: 'low' | 'medium' | 'high';
  rootCauseAnalysis: string;
  fixOptions: FixOption[];     // 1-N options
  filesExamined: string[];
  additionalLogsNeeded?: string;
  summary: string;
  autoSubmit?: boolean;        // Skip admin selection for obvious fixes
}
```

### Auto-Submit Conditions

The agent can skip admin selection and auto-submit the recommended fix when **all five** of the following conditions are true:

1. `output.autoSubmit === true` — the agent explicitly flagged this as an obvious fix
2. A recommended option exists — at least one fix option has `isRecommended: true`
3. `output.confidence === 'high'` — the agent is highly confident in its root cause analysis
4. `recommendedOption.complexity === 'S'` — the recommended fix is small
5. `recommendedOption.destination === 'implement'` — the recommended fix routes directly to implementation (not tech design)

When auto-submit triggers, the agent:
- Posts a selection comment on the GitHub issue (same format as manual selection)
- Calls `completeAgentRun()` to route the item to "Ready for development" and clear Review Status
- Sends a `notifyDecisionAutoSubmitted` Telegram notification

If any condition is not met, the normal flow applies: Review Status is set to "Waiting for Review" and a Telegram notification is sent with the `/decision/:issueNumber` link for admin selection.

### Decision Flow Connection

After the agent posts its investigation, the decision lifecycle works as follows:

1. **Decision saved to MongoDB**: The agent calls `saveDecisionToDB()` with the fix options, metadata schema, and routing config. This persists the decision at `artifacts.decision` on the workflow item.
2. **Admin opens `/decision/:issueNumber`**: The web UI loads decision data from MongoDB (with GitHub comment fallback). The token in the URL is validated against the issue number.
3. **Admin submits selection**: The `submitDecision` API handler reads the `routing` config from the saved decision, resolves the target status from the selected option's metadata, updates the item status, and clears Review Status so the next agent picks it up.
4. **Workflow advances**: The item moves to either "Technical Design" or "Ready for development" depending on the selected option's destination metadata.

### Investigation Comment

The agent posts a formatted comment on the GitHub issue using the generic Agent Decision format:

```markdown
<!-- AGENT_DECISION_V1:bug-investigator -->
<!-- DECISION_META:{"type":"bug-fix","metadataSchema":[...],"routing":{...}} -->

## Decision Context

**Root Cause Found:** Yes
**Confidence:** High

### Root Cause Analysis
[Detailed analysis...]

### Options

#### opt1: Add null check **Recommended**
- **Complexity:** S
- **Destination:** Direct Implementation
- **Files Affected:** `src/hooks/useAuth.ts`
[Description...]

#### opt2: Refactor auth flow
- **Complexity:** M
- **Destination:** Technical Design
- **Files Affected:** `src/hooks/useAuth.ts`, `src/server/auth.ts`
[Description...]
```

The `DECISION_META` includes a `routing` config that tells the submit handler how to auto-route the item based on the selected option's metadata.

## Fix Selection UI

After the investigation is posted, the admin selects a fix approach via the generic decision web UI.

### URL Format

```
/decision/:issueNumber?token=<generated-token>
```

The token is generated using `generateDecisionToken(issueNumber)` and included in the Telegram notification URL. Legacy `/bug-fix/:issueNumber` URLs redirect to `/decision/:issueNumber`.

### UI Flow

1. Page loads decision data from MongoDB (with GitHub issue comment fallback)
2. Displays root cause analysis context and fix options with metadata (complexity badges, file lists, etc.)
3. Admin selects a predefined option OR provides a custom solution
4. For custom solutions, admin also selects the routing destination
5. On submit, the selection is posted to the API

### API Endpoint

`POST /api/process/agent-decision/submitDecision`

**Request:**
```typescript
{
  issueNumber: number;
  token: string;
  selection: {
    selectedOptionId: string;      // "opt1", "opt2", or "custom"
    customSolution?: string;       // If custom
    customDestination?: string;    // If custom: "implement" | "tech-design"
    notes?: string;                // Optional additional notes
  }
}
```

**Response:**
```typescript
{
  success?: boolean;
  routedTo?: string;    // Status the item was routed to
  error?: string;
}
```

### What Happens on Submit

1. Validates the token
2. Saves selection to MongoDB `artifacts.decision.selection` and posts a **selection comment** on the GitHub issue (for display)
3. Reads the `routing` config from MongoDB decision (with comment fallback)
4. Resolves the target status from the selected option's metadata
5. Updates the item status to the destination:
   - `"Direct Implementation"` → "Ready for development"
   - `"Technical Design"` → "Technical Design"
6. Clears the Review Status (so the next agent picks it up)

If routing config is missing, the submit handler sets Review Status to "Approved" instead (for agents that handle their own post-decision logic).

## Telegram Notifications

### Investigation Ready (Manual Selection)

Sent when the Bug Investigator agent completes its investigation and admin selection is needed:

```
Agent (Bug Investigation): Decision Ready
Bug

Issue #60: "Login fails on Safari"
Options: 3

Summary:
[investigation summary]

[Choose Recommended] [Choose Option] [View Issue] [Request Changes]
```

- **Choose Recommended**: One-click shortcut that selects the agent's recommended option via `chooseRecommendedOption()` -- available in both Telegram and UI
- **Choose Option**: Opens `/decision/:issueNumber` web UI for manual selection
- **View Issue**: Opens the GitHub issue
- **Request Changes**: Sets Review Status to "Request Changes" (triggers feedback mode)

### Auto-Submitted (Obvious Fix)

Sent when the agent auto-submits an obvious fix without requiring admin selection:

```
Agent (Bug Investigation): Auto-Submitted
Bug

Issue #60: "Login fails on Safari"

Selected: Add null check for auth token
Routed to: Ready for development

Obvious fix auto-submitted. The implementation agent will pick this up next.
```

### Submission Confirmed

Sent after the admin submits a fix selection via the web UI:

```
Decision Submitted: Confirmed
Bug

Issue #60: "Login fails on Safari"

Selected: Add null check for auth token
Routed to: Ready for development

The next agent will pick this up automatically.
```

## E2E Flow Diagram

```
1. Bug enters "Bug Investigation" status (auto-routed on approval)
   |
2. Bug Investigator agent runs
   |- Investigates codebase (read-only)
   |- Posts investigation comment on GitHub issue (Agent Decision format)
   |
   +--> [Auto-Submit Path] (all 5 conditions met — see below)
   |    |- Posts selection comment on issue
   |    |- Routes directly to "Ready for development"
   |    '- Sends Telegram: "Auto-Submitted" confirmation
   |    |
   |    '--> 6. Implementation agent picks up
   |
   +--> [Manual Selection Path] (normal flow)
        |- Sends Telegram: [Choose Option] [View Issue] [Request Changes]
        |
        3. Admin clicks "Choose Option" -> Opens /decision/:issueNumber UI
        |
        4. Admin selects option (or provides custom) -> Submits
        |
        5. API processes submission
        |- Posts selection comment on issue
        |- Reads routing config from DECISION_META
        |- Routes to destination (Tech Design or Implementation)
        |- Clears Review Status
        '- Sends Telegram: submission confirmation with next steps
        |
        6. Next agent picks up with full context from issue comments
```

## Status Transitions

| Starting State | Event | Ending State | Actor |
|----------------|-------|--------------|-------|
| Bug Investigation, Review: empty | Agent investigates (normal) | Bug Investigation, Review: Waiting for Review | Agent |
| Bug Investigation, Review: empty | Agent investigates (auto-submit) | Ready for development, Review: empty | Agent |
| Bug Investigation, Review: Waiting for Review | Admin selects fix -> Implementation | Ready for development, Review: empty | Admin (UI) |
| Bug Investigation, Review: Waiting for Review | Admin selects fix -> Tech Design | Technical Design, Review: empty | Admin (UI) |
| Bug Investigation, Review: Waiting for Review | Admin requests changes | Bug Investigation, Review: Request Changes | Admin (Telegram) |
| Bug Investigation, Review: Request Changes | Agent revises investigation | Bug Investigation, Review: Waiting for Review | Agent |
| Bug Investigation, Review: Waiting for Clarification | Admin answers + clicks received | Bug Investigation, Review: Clarification Received | Admin |
| Bug Investigation, Review: Clarification Received | Agent continues investigation | Bug Investigation, Review: Waiting for Review | Agent |

## Key Files

| File | Purpose |
|------|---------|
| `src/agents/core-agents/bugInvestigatorAgent/index.ts` | Main agent |
| `src/agents/shared/prompts/bug-investigation.ts` | Prompt builders |
| `src/agents/shared/output-schemas.ts` | `BUG_INVESTIGATION_OUTPUT_FORMAT` |
| `src/agents/shared/notifications/` | `notifyDecisionNeeded()`, `notifyDecisionAutoSubmitted()`, `notifyDecisionSubmitted()` |
| `src/client/routes/template/Decision/` | Decision selection UI (generic) |
| `src/client/routes/template/BugFix/` | Legacy redirect to `/decision/` |
| `src/apis/template/agent-decision/` | Agent decision API handlers |
| `src/server/template/workflow-service/choose-recommended.ts` | `chooseRecommendedOption()` -- one-click recommended selection |
| `src/server/template/github-sync/index.ts` | `bugReportSyncConfig` with `initialStatus` |
| `src/server/template/project-management/config.ts` | `STATUSES.bugInvestigation` |

## Related Documentation

- **[overview.md](./overview.md)** - Full workflow overview
- **[workflow-e2e.md](./workflow-e2e.md)** - E2E scenarios including bug flow (section 4)
- **[setup-guide.md](./setup-guide.md)** - Setup including Bug Investigation column
