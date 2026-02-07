---
title: Bug Investigation Workflow
description: Complete documentation for the Bug Investigator agent and bug fix selection flow.
summary: "Bugs are auto-routed to Bug Investigation on approval. The Bug Investigator agent performs read-only investigation, posts root cause analysis with fix options, and admin selects a fix approach via web UI to route to Tech Design or Implementation."
priority: 5
key_points:
  - "Bugs auto-route to Bug Investigation on approval (no routing message)"
  - "Bug Investigator agent uses read-only tools (Glob, Grep, Read, WebFetch)"
  - "Investigation posted as GitHub issue comment with fix options"
  - "Admin selects fix approach via /decision/:issueNumber web UI"
  - "Routes to Tech Design (complex fixes) or Implementation (simple fixes)"
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
3. Sends a Telegram notification with links to view the investigation and select a fix approach
4. Admin selects a fix option via the `/decision/:issueNumber` web UI
5. The bug is routed to **Technical Design** or **Implementation** based on the selected option

## Auto-Routing on Approval

Unlike feature requests (which show a routing message), bug reports are automatically routed:

- **Feature requests**: Approval creates GitHub issue in "Backlog" + shows routing buttons
- **Bug reports**: Approval creates GitHub issue directly in "Bug Investigation" (no routing buttons)

This is configured via `initialStatus: STATUSES.bugInvestigation` in the bug report sync config (`src/server/github-sync/index.ts`).

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
}
```

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

### Investigation Ready

Sent when the Bug Investigator agent completes its investigation:

```
Agent (Bug Investigation): Decision Ready
Bug

Issue #60: "Login fails on Safari"
Options: 3

Summary:
[investigation summary]

[Choose Option] [View Issue] [Request Changes]
```

- **Choose Option**: Opens `/decision/:issueNumber` web UI
- **View Issue**: Opens the GitHub issue
- **Request Changes**: Sets Review Status to "Request Changes" (triggers feedback mode)

## E2E Flow Diagram

```
1. Bug enters "Bug Investigation" status (auto-routed on approval)
   |
2. Bug Investigator agent runs
   |- Investigates codebase (read-only)
   |- Posts investigation comment on GitHub issue (Agent Decision format)
   '- Sends Telegram: [Choose Option] [View Issue] [Request Changes]
   |
3. Admin clicks "Choose Option" -> Opens /decision/:issueNumber UI
   |
4. Admin selects option (or provides custom) -> Submits
   |
5. API processes submission
   |- Posts selection comment on issue
   |- Reads routing config from DECISION_META
   |- Routes to destination (Tech Design or Implementation)
   '- Clears Review Status
   |
6. Next agent picks up with full context from issue comments
```

## Status Transitions

| Starting State | Event | Ending State | Actor |
|----------------|-------|--------------|-------|
| Bug Investigation, Review: empty | Agent investigates | Bug Investigation, Review: Waiting for Review | Agent |
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
| `src/agents/shared/notifications.ts` | `notifyDecisionNeeded()` |
| `src/client/routes/template/Decision/` | Decision selection UI (generic) |
| `src/client/routes/template/BugFix/` | Legacy redirect to `/decision/` |
| `src/apis/template/agent-decision/` | Agent decision API handlers |
| `src/server/github-sync/index.ts` | `bugReportSyncConfig` with `initialStatus` |
| `src/server/project-management/config.ts` | `STATUSES.bugInvestigation` |

## Related Documentation

- **[overview.md](./overview.md)** - Full workflow overview
- **[workflow-e2e.md](./workflow-e2e.md)** - E2E scenarios including bug flow (section 4)
- **[setup-guide.md](./setup-guide.md)** - Setup including Bug Investigation column
