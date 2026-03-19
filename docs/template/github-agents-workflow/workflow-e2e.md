---
title: GitHub Agents Workflow E2E Scenarios
description: Visual workflows for all workflow scenarios. Use this to understand specific flows like multi-phase features, request changes, or rejections.
summary: "Comprehensive visual diagrams for: simple features, multi-phase features (L/XL split into phases), bug fixes, design/implementation request changes flows, undo actions (5-min window), clarification flows, and rejection scenarios."
priority: 4
key_points:
  - Simple features can skip design phases and go straight to implementation
  - Multi-phase features create sequential PRs (Phase 1/3, 2/3, 3/3)
  - Request Changes triggers revision cycle on same PR
  - 5-minute undo window for accidental Request Changes clicks
related_docs:
  - overview.md
  - workflow-items-architecture.md
---

# GitHub Agents Workflow - End-to-End Scenarios

This document provides comprehensive visual workflows for all scenarios in the agents workflow, from initial submission to completion.

> **Note:** All flows described below go through the unified workflow service at `src/server/template/workflow-service/`, regardless of which transport initiated the action (Telegram, UI, or CLI). This means cross-transport scenarios work seamlessly -- for example, an item approved via CLI will send Telegram routing notifications, and an item routed via the UI will log to agent-logs the same way as one routed via Telegram.

---

## Table of Contents

1. [Simple Feature (S/M size) - Happy Flow](#1-simple-feature-sm-size---happy-flow)
2. [Complex Feature (L/XL size) - Multi-Phase Happy Flow](#2-complex-feature-lxl-size---multi-phase-happy-flow)
3. [Feature with Product + Tech Design (M size) - Happy Flow](#3-feature-with-product--tech-design-m-size---happy-flow)
4. [Bug Report - Happy Flow](#4-bug-report---happy-flow)
5. [Request Changes Flow - Design Phase](#5-request-changes-flow---design-phase)
6. [Request Changes Flow - Implementation Phase](#6-request-changes-flow---implementation-phase)
7. [Undo Accidental Request Changes (5-Minute Window)](#7-undo-accidental-request-changes-5-minute-window)
8. [Clarification Flow](#8-clarification-flow)
9. [Multi-Phase with Mid-Phase Changes Requested](#9-multi-phase-with-mid-phase-changes-requested)
10. [Rejection Scenarios](#10-rejection-scenarios)
11. [Skip Design Phases](#11-skip-design-phases)
12. [Status Transitions Reference](#12-status-transitions-reference)
13. [Decision Points Reference](#13-decision-points-reference)

---

## 1. Simple Feature (S/M size) - Happy Flow

**Scenario:** User submits a simple feature that doesn't need design phases.

```
┌─────────────────────────────────────┐
│ USER SUBMITS FEATURE REQUEST        │
│ - Title: "Add dark mode toggle"    │
│ - Description: UX requirements      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ MONGODB STATE                       │
│ - status: 'new'                     │
│ - type: 'feature'                   │
│ - githubIssueNumber: null           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM NOTIFICATION TO ADMIN      │
│ ┌─────────────────────────────────┐ │
│ │ New Feature Request             │ │
│ │ "Add dark mode toggle"          │ │
│ │                                 │ │
│ │ [Approve] [Reject]              │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Approve"
              ▼
┌─────────────────────────────────────┐
│ GITHUB ISSUE CREATED                │
│ - Issue #42                         │
│ - Label: feature                    │
│ - Added to Projects board           │
│ - Column: Backlog                   │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ MONGODB STATE UPDATED               │
│ - status: 'in_progress'             │
│ - githubIssueNumber: 42             │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM ROUTING MESSAGE            │
│ ┌─────────────────────────────────┐ │
│ │ Where should this item start?   │ │
│ │                                 │ │
│ │ [🎨 Product Design]             │ │
│ │ [🔧 Tech Design]                │ │
│ │ [⚡ Ready for development]      │ │
│ │ [📋 Keep in Backlog]            │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Ready for development"
              ▼
┌─────────────────────────────────────┐
│ WORKFLOW PIPELINE               │
│ - Column: Ready for development     │
│ - Review Status: (empty)            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ IMPLEMENTATION AGENT (Cron)         │
│ - Detects item in Ready column      │
│ - Review Status is empty            │
│ - Starts implementation             │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT CREATES BRANCH & PR           │
│ - Branch: feature/dark-mode-toggle  │
│ - PR #43 created                    │
│ - PR title: "feat: Add dark mode"   │
│ - Linked to issue #42               │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT UPDATES ITEM                  │
│ - Column: PR Review                 │
│ - Review Status: Waiting for Review │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ PR REVIEW AGENT (Cron)              │
│ - Detects PR in Review Status       │
│ - Reviews code changes              │
│ - Generates commit message          │
│ - Approves PR                       │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT POSTS REVIEW RESULTS          │
│ - PR comment with approval          │
│ - Commit message saved              │
│ - Review Status: Approved           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM MERGE NOTIFICATION         │
│ ┌─────────────────────────────────┐ │
│ │ PR #43 Approved                 │ │
│ │ "feat: Add dark mode toggle"    │ │
│ │                                 │ │
│ │ [Merge] [Request Changes]       │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Merge"
              ▼
┌─────────────────────────────────────┐
│ SERVER MERGES PR                    │
│ - Uses saved commit message         │
│ - Squash merge to main              │
│ - PR #43 merged & closed            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ GITHUB WEBHOOK FIRES                │
│ - Event: pull_request (closed)      │
│ - Merged: true                      │
│ - Linked issue: #42                 │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ WEBHOOK MARKS ITEM DONE             │
│ - Column: Done                      │
│ - Review Status: (cleared)          │
│ - MongoDB status: 'done'            │
└─────────────────────────────────────┘

✅ WORKFLOW COMPLETE
```

**Key Timeline:**
- User submit → Admin approve: Manual
- Approval → GitHub issue: Immediate
- Issue → Routing choice: Manual (admin)
- Routing → Implementation: Next cron cycle (5min)
- Implementation → PR creation: ~5-15min (agent work)
- PR → Review: Next cron cycle (5min)
- Review → Approval: ~2-5min (agent work)
- Approval → Merge: Manual (admin via Telegram)
- Merge → Done: Immediate (webhook)

---

## 2. Complex Feature (L/XL size) - Multi-Phase Happy Flow

**Scenario:** User submits a large feature that tech design agent splits into 3 phases.

```
┌─────────────────────────────────────┐
│ USER SUBMITS FEATURE REQUEST        │
│ - Title: "Real-time collaboration"  │
│ - Size: XL (complex)                │
└─────────────┬───────────────────────┘
              │
              ▼
         [Same approval flow as Simple Feature]
              │
              ▼
┌─────────────────────────────────────┐
│ ADMIN ROUTES TO TECH DESIGN         │
│ (Skips product design for this ex)  │
│ - Column: Technical Design          │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TECH DESIGN AGENT (Cron)            │
│ - Analyzes requirements             │
│ - Determines item is L/XL size      │
│ - Generates 3 implementation phases │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT POSTS PHASES TO ISSUE         │
│ ┌─────────────────────────────────┐ │
│ │ <!-- AGENT_PHASES_V1 -->        │ │
│ │                                 │ │
│ │ ## Phase 1: WebSocket Setup     │ │
│ │ - Set up WebSocket server       │ │
│ │ - Add connection handling       │ │
│ │ Size: M                         │ │
│ │                                 │ │
│ │ ## Phase 2: Data Sync Layer     │ │
│ │ - Implement CRDT logic          │ │
│ │ - Add conflict resolution       │ │
│ │ Size: M                         │ │
│ │                                 │ │
│ │ ## Phase 3: UI Integration      │ │
│ │ - Add presence indicators       │ │
│ │ - Implement live cursors        │ │
│ │ Size: S                         │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT CREATES DESIGN PR             │
│ - Branch: tech-design/issue-42      │
│ - File: designs/tech/issue-42.md    │
│ - PR #44 with phases in file        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM DESIGN APPROVAL            │
│ [Approve Design] [Request Changes]  │
└─────────────┬───────────────────────┘
              │ Admin clicks "Approve Design"
              ▼
┌─────────────────────────────────────┐
│ DESIGN APPROVED (S3)               │
│ - PR #44 merged                     │
│ - Column: Ready for development     │
│ - Review Status: (empty)            │
│ - Phase tracking initialized        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ IMPLEMENTATION AGENT - PHASE 1      │
│ - Reads phases from issue comment   │
│ - Implements Phase 1 only           │
│ - Creates feature/issue-42-phase-1  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ PHASE 1 PR CREATED                  │
│ - PR #45                            │
│ - Title: "feat: Phase 1/3 - WS..."  │
│ - Description references Phase 1    │
│ - Review Status: Waiting for Review │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ PR REVIEW AGENT - PHASE 1           │
│ - Detects this is Phase 1 of 3      │
│ - Reviews ONLY Phase 1 scope        │
│ - Verifies no Phase 2/3 code        │
│ - Approves                          │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ ADMIN MERGES PHASE 1                │
│ - PR #45 merged                     │
│ - Issue comment updated:            │
│   ✅ Phase 1 complete               │
│   ⬜ Phase 2 pending                │
│   ⬜ Phase 3 pending                │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ ITEM RETURNS TO READY COLUMN        │
│ - Column: Ready for development     │
│ - Review Status: (cleared)          │
│ - Phases artifact shows 2 remaining │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ IMPLEMENTATION AGENT - PHASE 2      │
│ - Reads phases from issue comment   │
│ - Sees Phase 1 complete             │
│ - Implements Phase 2 only           │
│ - Creates feature/issue-42-phase-2  │
└─────────────┬───────────────────────┘
              │
              ▼
         [Same review & merge flow for Phase 2]
              │
              ▼
┌─────────────────────────────────────┐
│ PHASE 2 MERGED                      │
│ - Issue comment:                    │
│   ✅ Phase 1 complete               │
│   ✅ Phase 2 complete               │
│   ⬜ Phase 3 pending                │
└─────────────┬───────────────────────┘
              │
              ▼
         [Same flow for Phase 3]
              │
              ▼
┌─────────────────────────────────────┐
│ PHASE 3 MERGED                      │
│ - Issue comment:                    │
│   ✅ Phase 1 complete               │
│   ✅ Phase 2 complete               │
│   ✅ Phase 3 complete               │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ ALL PHASES COMPLETE                 │
│ - Item moves to Done                │
│ - MongoDB status: 'done'            │
└─────────────────────────────────────┘

✅ MULTI-PHASE WORKFLOW COMPLETE
```

**Key Points:**
- Tech design agent detects L/XL size and generates phases
- Phases saved to MongoDB `artifacts.phases` and posted as **issue comment** for display
- Implementation agent reads phases from DB first (with comment fallback for backward compat)
- PR review agent is **phase-aware** - only validates specified phase
- Each phase creates independent PR with sequential numbering
- Item cycles: Ready → PR Review → (merge) → Ready → ... until all phases done
- Final phase merge moves item to Done

---

## 3. Feature with Product + Tech Design (M size) - Happy Flow

**Scenario:** User submits a feature that needs both UX/UI design and technical architecture.

```
┌─────────────────────────────────────┐
│ USER SUBMITS FEATURE REQUEST        │
│ - Title: "User dashboard widgets"   │
│ - Needs UX design                   │
└─────────────┬───────────────────────┘
              │
              ▼
         [Same approval flow]
              │
              ▼
┌─────────────────────────────────────┐
│ ADMIN ROUTES TO PRODUCT DESIGN      │
│ - Column: Product Design            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ PHASE 1: PRODUCT DESIGN AGENT      │
│ - Explores codebase                 │
│ - Writes 2-3 React mock options     │
│   to src/pages/design-mocks/        │
│ - Creates design PR (mocks only)    │
│ - Posts decision comment on issue   │
│ - Review Status: Waiting for        │
│   Decision                          │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ NOTIFICATION TO ADMIN               │
│ [Choose Recommended] [All Options]  │
│ [Preview Mocks] [Request Changes]   │
└─────────────┬───────────────────────┘
              │ Admin selects option
              ▼
┌─────────────────────────────────────┐
│ DECISION SUBMITTED                  │
│ - Review Status: Decision Submitted │
│ - Item stays in Product Design      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ PHASE 2: PRODUCT DESIGN AGENT      │
│ - Reads chosen mock from DB         │
│ - Reads mock React source file      │
│ - Writes full design document       │
│ - Updates same design PR            │
│ - Saves design to S3                │
│ - Review Status: Waiting for Review │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ NOTIFICATION TO ADMIN               │
│ [Approve] [Request Changes]         │
└─────────────┬───────────────────────┘
              │ Admin approves
              ▼
┌─────────────────────────────────────┐
│ PRODUCT DESIGN APPROVED             │
│ - Design read from S3               │
│ - Column: Technical Design          │
│ - Review Status: (cleared)          │
│ - Design PR stays open (NOT merged) │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TECH DESIGN AGENT (Cron)            │
│ - Reads product design from S3      │
│ - Generates technical architecture  │
│ - Creates tech design PR            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TECH DESIGN PR CREATED              │
│ - Branch: tech-design/issue-50      │
│ - File: designs/tech/issue-50.md    │
│ - PR #52 with architecture          │
│ - Review Status: Waiting for Review │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM TECH DESIGN APPROVAL       │
│ [Approve Design] [Request Changes]  │
└─────────────┬───────────────────────┘
              │ Admin clicks "Approve Design"
              ▼
┌─────────────────────────────────────┐
│ TECH DESIGN APPROVED (S3)          │
│ - Design saved to S3                │
│ - Column: Ready for development     │
│ - Review Status: (cleared)          │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ IMPLEMENTATION AGENT (Cron)         │
│ - Reads both design files           │
│ - Product: designs/product/...      │
│ - Tech: designs/tech/...            │
│ - Implements feature                │
└─────────────┬───────────────────────┘
              │
              ▼
         [Same implementation & review flow]
              │
              ▼
┌─────────────────────────────────────┐
│ FEATURE COMPLETE                    │
│ - Both designs in repo              │
│ - Implementation merged             │
│ - Item in Done                      │
└─────────────────────────────────────┘

✅ FULL DESIGN PIPELINE COMPLETE
```

**Key Points:**
- Item advances through **all 6 columns** sequentially
- Each design phase creates its own PR
- Design PRs auto-merge when approved
- Implementation agent reads **both** design files from repo
- Product design informs UX, tech design informs architecture

---

## 4. Bug Report - Happy Flow

**Scenario:** User reports a bug with diagnostics. Bug is automatically routed to Bug Investigation, where the agent investigates the root cause and proposes fix options. Admin selects a fix approach, and the bug is routed to Tech Design or Implementation.

```
┌─────────────────────────────────────┐
│ USER SUBMITS BUG REPORT             │
│ - Description: "Login fails..."     │
│ - Steps to reproduce                │
│ - Session logs attached             │
│ - Screenshot included               │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ MONGODB STATE                       │
│ - status: 'new'                     │
│ - type: 'bug'                       │
│ - diagnostics: {...}                │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM NOTIFICATION TO ADMIN      │
│ ┌─────────────────────────────────┐ │
│ │ New Bug Report                  │ │
│ │ "Login fails on Safari"         │ │
│ │                                 │ │
│ │ [View Diagnostics]              │ │
│ │ [Approve] [Reject]              │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Approve"
              ▼
┌─────────────────────────────────────┐
│ GITHUB ISSUE CREATED                │
│ - Issue #60                         │
│ - Label: bug                        │
│ - Diagnostics in issue body         │
│ - Column: Bug Investigation         │
│   (auto-routed, no routing msg)     │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ MONGODB STATE UPDATED               │
│ - status: 'investigating'           │
│ - githubIssueNumber: 60             │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ BUG INVESTIGATOR AGENT (Cron)       │
│ - Detects item in Bug Investigation │
│ - Review Status is empty            │
│ - Read-only investigation           │
│ - Uses Glob, Grep, Read tools       │
│ - Analyzes codebase + diagnostics   │
│ - Identifies root cause             │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ INVESTIGATION COMMENT POSTED        │
│ ┌─────────────────────────────────┐ │
│ │ 🔍 Bug Investigation Report     │ │
│ │                                 │ │
│ │ Root Cause Found: Yes           │ │
│ │ Confidence: 🟢 High             │ │
│ │                                 │ │
│ │ Root Cause Analysis:            │ │
│ │ Race condition in useAuth...    │ │
│ │                                 │ │
│ │ Fix Options:                    │ │
│ │ opt1: Add null check (S)       │ │
│ │ opt2: Refactor auth flow (M)⭐ │ │
│ │ opt3: Redesign arch (L)        │ │
│ └─────────────────────────────────┘ │
│ - Review Status: Waiting for Review │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM NOTIFICATION               │
│ ┌─────────────────────────────────┐ │
│ │ Bug Investigation Ready         │ │
│ │ Issue #60                       │ │
│ │                                 │ │
│ │ [🔍 View Investigation]         │ │
│ │ [🔧 Choose Fix Option]          │ │
│ │ [📝 Request Changes]            │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Choose Fix Option"
              ▼
┌─────────────────────────────────────┐
│ DECISION SELECTION UI               │
│ /decision/:issueNumber              │
│ ┌─────────────────────────────────┐ │
│ │ Choose fix approach:            │ │
│ │ ○ Add null check (S) → Impl    │ │
│ │ ● Refactor auth (M) → Tech ⭐  │ │
│ │ ○ Redesign arch (L) → Tech     │ │
│ │                                 │ │
│ │ Custom solution: [________]     │ │
│ │ Route to: ○ Tech ○ Impl        │ │
│ │                                 │ │
│ │           [Submit Selection]    │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin submits selection
              ▼
┌─────────────────────────────────────┐
│ WEBHOOK PROCESSES SELECTION         │
│ - Posts decision comment on issue   │
│ - Routes to destination:            │
│   Tech Design or Implementation     │
│ - Clears Review Status              │
└─────────────┬───────────────────────┘
              │
         ┌────┴────────────────┐
         │                     │
    [Tech Design]        [Implementation]
         │                     │
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│ TECH DESIGN      │  │ IMPLEMENTATION   │
│ AGENT            │  │ AGENT            │
│ - Architecture   │  │ - Direct fix     │
│ - Design PR      │  │ - Fix PR         │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         ▼                     ▼
    [Design approval      [Same review &
     → Implementation]     merge flow]
         │                     │
         ▼                     ▼
┌─────────────────────────────────────┐
│ BUG FIX MERGED                      │
│ - Item moves to Done                │
│ - MongoDB status: 'done'            │
└─────────────────────────────────────┘

✅ BUG FIX COMPLETE
```

**Key Differences from Feature:**
- Label: `bug` instead of `feature`
- Branch prefix: `fix/` instead of `feature/`
- PR title prefix: `fix:` instead of `feat:`
- **Auto-routed to Bug Investigation** (no routing message shown)
- Bug Investigator agent uses **read-only** tools (no code changes)
- Investigation posted as **issue comment** (not a PR)
- Admin selects fix approach via **web UI** (`/decision/:issueNumber`)
- Can route to **Tech Design** (complex fixes) or **Implementation** (simple fixes)
- Diagnostics (session logs, stack traces) included in agent prompt (not in GitHub issue)

---

## 5. Request Changes Flow - Design Phase

**Scenario:** Admin requests changes to a design PR before approving.

```
┌─────────────────────────────────────┐
│ DESIGN PR CREATED                   │
│ - PR #70                            │
│ - Column: Product Design            │
│ - Review Status: Waiting for Review │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM DESIGN APPROVAL            │
│ ┌─────────────────────────────────┐ │
│ │ Design PR #70 Ready             │ │
│ │                                 │ │
│ │ [Approve Design]                │ │
│ │ [Request Changes]               │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Request Changes"
              ▼
┌─────────────────────────────────────┐
│ ADMIN POSTS FEEDBACK ON PR          │
│ ┌─────────────────────────────────┐ │
│ │ PR Comment:                     │ │
│ │ "Please add mobile mockups for  │ │
│ │  the dashboard view"            │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ SERVER UPDATES REVIEW STATUS        │
│ - Review Status: Changes Requested  │
│ - Item stays in current column      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ DESIGN AGENT (Next Cron Cycle)      │
│ - Detects Changes Requested         │
│ - Reads PR comments                 │
│ - Addresses feedback                │
│ - Updates design document           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT PUSHES TO SAME PR             │
│ - Same branch: product-design/...   │
│ - Same PR #70                       │
│ - Updated file with mobile mockups  │
│ - PR comment: "Added mobile views"  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT UPDATES REVIEW STATUS         │
│ - Review Status: Waiting for Review │
│ - Item still in Product Design      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM NOTIFICATION (Updated PR)  │
│ ┌─────────────────────────────────┐ │
│ │ PR #70 Updated (Changes Made)   │ │
│ │                                 │ │
│ │ [Approve Design]                │ │
│ │ [Request More Changes]          │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin reviews again
              │
         ┌────┴────┐
         │         │
    [Approve] [Request Changes Again]
         │         │
         │         └─────> [Loop back to feedback]
         │
         ▼
┌─────────────────────────────────────┐
│ DESIGN APPROVED (S3)               │
│ - PR #70 merged                     │
│ - Column advances to next phase     │
│ - Review Status: (cleared)          │
└─────────────────────────────────────┘

✅ DESIGN APPROVED AFTER REVISION
```

**Key Points:**
- Agent updates **same PR**, not a new one
- Review Status cycles: Waiting → Changes Requested → Waiting → ...
- Item stays in current column until approved
- Can loop multiple times until admin satisfied
- Works same way for Product Design and Tech Design phases

---

## 6. Request Changes Flow - Implementation Phase

**Scenario:** PR Review agent or admin requests changes to implementation PR.

```
┌─────────────────────────────────────┐
│ IMPLEMENTATION PR CREATED           │
│ - PR #80                            │
│ - Column: PR Review                 │
│ - Review Status: Waiting for Review │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ PR REVIEW AGENT (Cron)              │
│ - Reviews code                      │
│ - Finds issues:                     │
│   • Missing error handling          │
│   • Test coverage incomplete        │
│ - Requests changes                  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT POSTS REVIEW ON PR            │
│ ┌─────────────────────────────────┐ │
│ │ Changes Requested:              │ │
│ │                                 │ │
│ │ 1. Add error handling for API   │ │
│ │    timeout in handleSubmit()    │ │
│ │                                 │ │
│ │ 2. Add test case for edge case  │ │
│ │    when user is offline         │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT UPDATES REVIEW STATUS         │
│ - Review Status: Changes Requested  │
│ - Item stays in PR Review           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ IMPLEMENTATION AGENT (Next Cron)    │
│ - Detects Changes Requested         │
│ - Reads PR review comments          │
│ - Addresses each point              │
│ - Adds error handling               │
│ - Adds test case                    │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT PUSHES TO SAME PR             │
│ - Same branch: feature/...          │
│ - Same PR #80                       │
│ - New commits with fixes            │
│ - PR comment: "Addressed feedback"  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT UPDATES REVIEW STATUS         │
│ - Review Status: Waiting for Review │
│ - Item still in PR Review           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ PR REVIEW AGENT (Next Cron)         │
│ - Reviews updated code              │
│ - Verifies fixes                    │
│ - All issues addressed              │
│ - Approves PR                       │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT POSTS APPROVAL                │
│ - Review Status: Approved           │
│ - Commit message generated          │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM MERGE NOTIFICATION         │
│ [Merge] [Request More Changes]      │
└─────────────┬───────────────────────┘
              │ Admin clicks "Merge"
              ▼
┌─────────────────────────────────────┐
│ PR MERGED & ITEM DONE               │
└─────────────────────────────────────┘

✅ IMPLEMENTATION APPROVED AFTER FIXES
```

**Alternative Flow - Admin Requests Changes:**

```
┌─────────────────────────────────────┐
│ PR REVIEW AGENT APPROVES            │
│ - Review Status: Approved           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM MERGE NOTIFICATION         │
│ ┌─────────────────────────────────┐ │
│ │ PR #80 Approved                 │ │
│ │                                 │ │
│ │ [Merge] [Request Changes]       │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Request Changes"
              ▼
┌─────────────────────────────────────┐
│ ADMIN POSTS FEEDBACK ON PR          │
│ "Please refactor the component to   │
│  use hooks instead of class"        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ SERVER UPDATES REVIEW STATUS        │
│ - Review Status: Changes Requested  │
└─────────────┬───────────────────────┘
              │
              ▼
         [Implementation agent addresses feedback]
              │
              ▼
         [Cycle repeats until admin merges]
```

**Key Points:**
- PR Review agent can request changes automatically
- Admin can override approval and request changes
- Implementation agent reads **all PR comments** for context
- Same PR used throughout - no new PRs for revisions
- Can cycle multiple times: Review → Changes → Fix → Review → ...

---

## 7. Undo Accidental Request Changes (5-Minute Window)

**Scenario:** Admin accidentally clicks "Request Changes" and needs to undo within 5 minutes.

### 7.1 Undo Implementation PR Request Changes

```
┌─────────────────────────────────────┐
│ PR REVIEW APPROVED                  │
│ - PR #80                            │
│ - Review Status: Approved           │
│ - Commit message generated          │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM MERGE NOTIFICATION         │
│ ┌─────────────────────────────────┐ │
│ │ PR #80 Approved                 │ │
│ │ "feat: Add dark mode toggle"    │ │
│ │                                 │ │
│ │ [Merge] [Request Changes]       │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin ACCIDENTALLY clicks
              │ "Request Changes"
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM CONFIRMATION WITH UNDO     │
│ ┌─────────────────────────────────┐ │
│ │ 🔄 Marked for Changes           │ │
│ │                                 │ │
│ │ 📊 Status: Implementation       │ │
│ │ 📋 Review Status: Changes       │ │
│ │    Requested                    │ │
│ │                                 │ │
│ │ Next: Comment on the PR         │ │
│ │ explaining what needs to change │ │
│ │                                 │ │
│ │ Changed your mind? Click Undo   │ │
│ │ within 5 minutes.               │ │
│ │                                 │ │
│ │ [↩️ Undo (4:58)]                │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Undo" within 5 min
              ▼
┌─────────────────────────────────────┐
│ SERVER RESTORES PREVIOUS STATE      │
│ - Status: PR Review (restored)      │
│ - Review Status: (cleared)          │
│ - No changes to PR or issue         │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM UNDO CONFIRMATION          │
│ ┌─────────────────────────────────┐ │
│ │ ↩️ Undone!                      │ │
│ │                                 │ │
│ │ 📊 Status restored to: PR Review│ │
│ │ 📋 Review Status: (cleared)     │ │
│ │                                 │ │
│ │ Re-sending PR Ready             │ │
│ │ notification...                 │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ NEW TELEGRAM NOTIFICATION SENT      │
│ ┌─────────────────────────────────┐ │
│ │ PR #80 Approved                 │ │
│ │ "feat: Add dark mode toggle"    │ │
│ │                                 │ │
│ │ [Merge] [Request Changes]       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

✅ UNDO SUCCESSFUL - ADMIN CAN NOW MERGE
```

### 7.2 Undo Design PR Request Changes

```
┌─────────────────────────────────────┐
│ DESIGN PR READY FOR REVIEW          │
│ - PR #70                            │
│ - Column: Product Design            │
│ - Review Status: Waiting for Review │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM DESIGN APPROVAL            │
│ ┌─────────────────────────────────┐ │
│ │ Design PR #70 Ready             │ │
│ │                                 │ │
│ │ [Approve]               │ │
│ │ [Request Changes]               │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin accidentally clicks
              │ "Request Changes"
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM CONFIRMATION WITH UNDO     │
│ ┌─────────────────────────────────┐ │
│ │ 🔄 Changes Requested            │ │
│ │                                 │ │
│ │ 📊 Status: Product Design       │ │
│ │ 📋 Review: Changes Requested    │ │
│ │                                 │ │
│ │ [↩️ Undo (4:55)]                │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Undo"
              ▼
┌─────────────────────────────────────┐
│ SERVER RESTORES STATE               │
│ - Review Status: (cleared)          │
│ - Design status unchanged           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ NEW DESIGN PR NOTIFICATION SENT     │
│ ┌─────────────────────────────────┐ │
│ │ Design PR #70 Ready             │ │
│ │                                 │ │
│ │ [Approve]               │ │
│ │ [Request Changes]               │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

✅ UNDO SUCCESSFUL - ADMIN CAN NOW APPROVE
```

### 7.3 Undo Expired (After 5 Minutes)

```
┌─────────────────────────────────────┐
│ TELEGRAM CONFIRMATION WITH UNDO     │
│ ┌─────────────────────────────────┐ │
│ │ 🔄 Marked for Changes           │ │
│ │                                 │ │
│ │ [↩️ Undo (0:00)]                │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Undo" after 5 min
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM ERROR TOAST                │
│ ┌─────────────────────────────────┐ │
│ │ ❌ Undo window expired          │ │
│ │    (5 minutes)                  │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ MANUAL RECOVERY REQUIRED            │
│ ┌─────────────────────────────────┐ │
│ │ Options:                        │ │
│ │ • Fix manually in GitHub        │ │
│ │   Projects UI                   │ │
│ │ • Let agent address the         │ │
│ │   "changes" and re-submit       │ │
│ │ • Move item status manually     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

⚠️ UNDO EXPIRED - MANUAL INTERVENTION NEEDED
```

**Key Points:**
- **5-minute window:** Undo button only works within 5 minutes of the original action
- **Timestamp in callback:** The undo button includes a timestamp to enforce the window
- **State restoration:** Undo restores the previous status and clears the review status
- **Re-sends notification:** After undo, a fresh notification with action buttons is sent
- **No data loss:** The PR and issue remain unchanged - only the status is restored
- **Works for all "Request Changes" actions:**
  - Implementation PR request changes
  - Design PR request changes
  - Design review changes/reject

**When Undo is NOT Available:**
- Merge actions (irreversible - code is merged)
- Approve actions (item advances to next phase)
- After 5-minute window expires

---

## 8. Clarification Flow

**Scenario:** Agent encounters ambiguity and needs admin input.

```
┌─────────────────────────────────────┐
│ IMPLEMENTATION AGENT WORKING        │
│ - Issue: "Add export feature"       │
│ - Ambiguity: export format unclear  │
│   (CSV? JSON? Excel?)               │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT POSTS CLARIFICATION QUESTION  │
│ ┌─────────────────────────────────┐ │
│ │ Issue #90 Comment:              │ │
│ │                                 │ │
│ │ I need clarification:           │ │
│ │                                 │ │
│ │ What export format(s) should be │ │
│ │ supported?                      │ │
│ │ - CSV only                      │ │
│ │ - JSON only                     │ │
│ │ - Both CSV and JSON             │ │
│ │ - Excel (XLSX)                  │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ AGENT UPDATES REVIEW STATUS         │
│ - Review Status: Waiting for        │
│   Clarification                     │
│ - Item stays in current column      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM CLARIFICATION NOTIFICATION │
│ ┌─────────────────────────────────┐ │
│ │ Issue #90 Needs Clarification   │ │
│ │                                 │ │
│ │ [View on GitHub]                │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks through to GitHub
              ▼
┌─────────────────────────────────────┐
│ ADMIN ANSWERS ON GITHUB ISSUE       │
│ ┌─────────────────────────────────┐ │
│ │ Issue #90 Comment:              │ │
│ │                                 │ │
│ │ "Support both CSV and JSON.     │ │
│ │  CSV should be the default."    │ │
│ │                                 │ │
│ │ [Clarification Received] (btn)  │ │
│ └─────────────────────────────────┘ │
└─────────────┬───────────────────────┘
              │ Admin clicks "Clarification Received"
              ▼
┌─────────────────────────────────────┐
│ WEBHOOK UPDATES REVIEW STATUS       │
│ - Review Status: (cleared)          │
│ - Agent can resume work             │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ IMPLEMENTATION AGENT (Next Cron)    │
│ - Detects clarification answered    │
│ - Reads admin's response            │
│ - Implements both CSV & JSON export │
│ - CSV as default                    │
└─────────────┬───────────────────────┘
              │
              ▼
         [Continues normal flow to PR creation]

✅ CLARIFICATION RESOLVED
```

**Key Points:**
- Agent can pause work at any phase
- Review Status: "Waiting for Clarification" blocks further agent action
- Admin answers via GitHub issue comment (not Telegram)
- "Clarification Received" button resumes workflow
- Agent reads clarification from issue comments
- Works for any agent: Product Design, Tech Design, or Implementation

---

## 9. Multi-Phase with Mid-Phase Changes Requested

**Scenario:** Phase 2 of 3 needs revisions.

```
┌─────────────────────────────────────┐
│ PHASE 1 COMPLETE & MERGED           │
│ - Issue comment:                    │
│   ✅ Phase 1                        │
│   ⬜ Phase 2                        │
│   ⬜ Phase 3                        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ IMPLEMENTATION AGENT - PHASE 2      │
│ - Implements Phase 2                │
│ - Creates PR #102                   │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ PR REVIEW AGENT REVIEWS PHASE 2     │
│ - Validates Phase 2 scope only      │
│ - Finds issue: missing validation   │
│ - Requests changes                  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ REVIEW STATUS: Changes Requested    │
│ - Item stays in PR Review           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ IMPLEMENTATION AGENT (Next Cron)    │
│ - Fixes Phase 2 issues              │
│ - Pushes to same PR #102            │
│ - Review Status: Waiting for Review │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ PR REVIEW AGENT RE-REVIEWS          │
│ - Phase 2 fixes verified            │
│ - Approves PR #102                  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ ADMIN MERGES PHASE 2                │
│ - PR #102 merged                    │
│ - Issue comment updated:            │
│   ✅ Phase 1                        │
│   ✅ Phase 2                        │
│   ⬜ Phase 3                        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ ITEM RETURNS TO READY COLUMN        │
│ - Review Status: (cleared)          │
│ - Ready for Phase 3                 │
└─────────────┬───────────────────────┘
              │
              ▼
         [Phase 3 implementation continues normally]

✅ MULTI-PHASE WITH REVISIONS COMPLETE
```

**Key Points:**
- Each phase can independently go through revision cycles
- Phase tracking artifact persists across all phases
- Phases completed sequentially - Phase 3 won't start until Phase 2 merged
- Changes to Phase 2 don't affect Phase 1 (already merged) or Phase 3 (not started)

---

## 10. Rejection Scenarios

### 10.1 Reject Design

```
┌─────────────────────────────────────┐
│ DESIGN PR CREATED                   │
│ - PR #110                           │
│ - Column: Product Design            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM DESIGN APPROVAL            │
│ [Approve Design] [Reject]           │
└─────────────┬───────────────────────┘
              │ Admin clicks "Reject"
              ▼
┌─────────────────────────────────────┐
│ ADMIN POSTS REJECTION REASON        │
│ "This doesn't align with our design │
│  system. Not proceeding."           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ SERVER CLOSES PR                    │
│ - PR #110 closed (not merged)       │
│ - Review Status: Rejected           │
│ - Item stays in current column      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ ADMIN MANUAL DECISION               │
│ ┌─────────────────────────┐         │
│ │ Options:                │         │
│ │ • Move to Backlog       │         │
│ │ • Close GitHub issue    │         │
│ │ • Request redesign      │         │
│ └─────────────────────────┘         │
└─────────────────────────────────────┘

⚠️ DESIGN REJECTED - MANUAL INTERVENTION NEEDED
```

### 10.2 Reject Implementation

```
┌─────────────────────────────────────┐
│ IMPLEMENTATION PR APPROVED          │
│ - PR #120                           │
│ - Review Status: Approved           │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TELEGRAM MERGE NOTIFICATION         │
│ [Merge] [Reject]                    │
└─────────────┬───────────────────────┘
              │ Admin clicks "Reject"
              ▼
┌─────────────────────────────────────┐
│ ADMIN POSTS REJECTION REASON        │
│ "Product requirements changed. This │
│  feature is no longer needed."      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ SERVER CLOSES PR                    │
│ - PR #120 closed (not merged)       │
│ - Review Status: Rejected           │
│ - MongoDB status: 'rejected'        │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ ADMIN CLOSES GITHUB ISSUE           │
│ - Issue #115 closed                 │
│ - Removed from board OR             │
│ - Moved to "Rejected" column        │
└─────────────────────────────────────┘

⚠️ IMPLEMENTATION REJECTED - ISSUE CLOSED
```

**Key Points:**
- Rejection can happen at any phase: Design or Implementation
- Rejected PRs are **closed**, not merged
- Review Status set to "Rejected"
- Agent will not retry rejected items automatically
- Admin must manually decide next steps (close issue, move to backlog, etc.)

---

## 11. Skip Design Phases

### 11.1 Bug with Investigation Phase (Default)

All bugs are automatically routed to **Bug Investigation** on approval. The Bug Investigator agent investigates the root cause and proposes fix options. Admin then chooses to route to Tech Design or directly to Implementation.

```
┌─────────────────────────────────────┐
│ USER SUBMITS BUG REPORT             │
│ - Simple CSS fix                    │
│ - Clear reproduction steps          │
└─────────────┬───────────────────────┘
              │
              ▼
         [Approval flow]
              │
              ▼
┌─────────────────────────────────────┐
│ AUTO-ROUTED TO BUG INVESTIGATION    │
│ - No routing message shown          │
│ - Bug Investigator agent runs       │
│ - Posts investigation + fix options  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ ADMIN SELECTS FIX OPTION            │
│ - Via /decision/:issueNumber UI     │
│ - Chooses "Direct Implementation"   │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ ITEM IN READY COLUMN                │
│ - Skipped Product Design            │
│ - Skipped Tech Design               │
│ - Goes straight to implementation   │
│ - Investigation context on issue    │
└─────────────┬───────────────────────┘
              │
              ▼
         [Normal implementation flow]
              │
              ▼
┌─────────────────────────────────────┐
│ BUG FIX COMPLETE                    │
│ - No design files created           │
│ - Fix PR merged directly            │
└─────────────────────────────────────┘

✅ BUG FIX VIA INVESTIGATION → IMPLEMENTATION
```

### 11.2 Internal Refactor - Skip Product Design

```
┌─────────────────────────────────────┐
│ ADMIN CREATES INTERNAL TASK         │
│ - "Refactor API layer"              │
│ - No user-facing changes            │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ ADMIN ROUTES TO TECH DESIGN         │
│ - Skips Product Design              │
│   (no UX changes)                   │
│ - Column: Technical Design          │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│ TECH DESIGN AGENT                   │
│ - Creates architecture plan         │
│ - No product design file            │
└─────────────┬───────────────────────┘
              │
              ▼
         [Design approval → Implementation]
              │
              ▼
┌─────────────────────────────────────┐
│ REFACTOR COMPLETE                   │
│ - Only tech design in repo          │
│ - No product design                 │
└─────────────────────────────────────┘

✅ BACKEND-ONLY TASK COMPLETE
```

**Key Points:**
- **Bugs** are auto-routed to Bug Investigation (no routing buttons for bugs)
- **Features** use routing buttons to control starting phase
- Simple features can skip **all design phases** via routing
- Backend tasks can skip **Product Design** only
- Bug Investigation agent determines whether fix needs Tech Design or can go straight to Implementation
- Agents adapt: no design files = implement from issue description + investigation context

---

## 12. Status Transitions Reference

Comprehensive table of all state transitions in the workflow.

| Starting State | Event/Action | Ending State | Triggered By |
|----------------|--------------|--------------|--------------|
| **MongoDB: 'new'**<br/>GitHub: N/A<br/>Review: N/A | User submits request | MongoDB: 'new'<br/>GitHub: N/A<br/>Review: N/A | User |
| MongoDB: 'new'<br/>GitHub: N/A<br/>Review: N/A | Admin clicks "Approve" (feature) | MongoDB: 'in_progress'<br/>GitHub: Issue created, Backlog<br/>Review: (empty) | Admin (Telegram) |
| MongoDB: 'new'<br/>GitHub: N/A<br/>Review: N/A | Admin clicks "Approve" (bug) | MongoDB: 'investigating'<br/>GitHub: Issue created, Bug Investigation<br/>Review: (empty) | Admin (Telegram) |
| MongoDB: 'in_progress'<br/>GitHub: Backlog<br/>Review: (empty) | Admin routes to Product Design | MongoDB: 'in_progress'<br/>GitHub: Product Design<br/>Review: (empty) | Admin (Telegram) |
| GitHub: Product Design<br/>Review: (empty) | Phase 1: Agent creates mocks + decision | GitHub: Product Design<br/>Review: Waiting for Decision | Agent (Cron) |
| GitHub: Product Design<br/>Review: Waiting for Decision | Admin selects design option | GitHub: Product Design<br/>Review: Decision Submitted | Admin (Telegram/UI) |
| GitHub: Product Design<br/>Review: Decision Submitted | Phase 2: Agent writes full design doc | GitHub: Product Design<br/>Review: Waiting for Review | Agent (Cron) |
| GitHub: Product Design<br/>Review: Waiting for Review | Admin approves design | GitHub: Technical Design<br/>Review: (empty)<br/>Design PR: stays open | Admin (Telegram/UI) |
| GitHub: Product Design<br/>Review: Waiting for Review | Admin clicks "Request Changes" | GitHub: Product Design<br/>Review: Changes Requested | Admin (Telegram/UI) |
| GitHub: Product Design<br/>Review: Changes Requested | Agent revises design + PR | GitHub: Product Design<br/>Review: Waiting for Review | Agent (Cron) |
| GitHub: Product Design<br/>Review: (empty) | Agent needs clarification | GitHub: Product Design<br/>Review: Waiting for Clarification | Agent (Cron) |
| GitHub: Technical Design<br/>Review: (empty) | Tech Design agent creates PR | GitHub: Technical Design<br/>Review: Waiting for Review | Agent (Cron) |
| GitHub: Technical Design<br/>Review: Waiting for Review | Admin approves design | GitHub: Ready for development<br/>Review: (empty)<br/>Design PR: stays open | Admin (Telegram/UI) |
| GitHub: Ready for development<br/>Review: (empty) | Implementation agent creates PR | GitHub: PR Review<br/>Review: Waiting for Review | Agent (Cron) |
| GitHub: PR Review<br/>Review: Waiting for Review | PR Review agent approves | GitHub: PR Review<br/>Review: Approved | Agent (Cron) |
| GitHub: PR Review<br/>Review: Waiting for Review | PR Review agent requests changes | GitHub: PR Review<br/>Review: Changes Requested | Agent (Cron) |
| GitHub: PR Review<br/>Review: Changes Requested | Implementation agent fixes issues | GitHub: PR Review<br/>Review: Waiting for Review | Agent (Cron) |
| GitHub: PR Review<br/>Review: Approved | Admin clicks "Merge" | GitHub: Done<br/>Review: (empty)<br/>MongoDB: 'done' | Admin (Telegram) + Webhook |
| GitHub: PR Review<br/>Review: Approved | Admin clicks "Request Changes" | GitHub: PR Review<br/>Review: Changes Requested | Admin (Telegram) |
| Any column<br/>Review: (any) | Agent posts clarification | Same column<br/>Review: Waiting for Clarification | Agent (Cron) |
| Any column<br/>Review: Waiting for Clarification | Admin clicks "Clarification Received" | Same column<br/>Review: (empty) | Admin (GitHub button) |
| Any design column<br/>Review: Waiting for Review | Admin clicks "Reject" | Same column<br/>Review: Rejected<br/>Design PR: Closed | Admin (Telegram) |
| GitHub: PR Review<br/>Review: Approved | Admin clicks "Reject" | Same column<br/>Review: Rejected<br/>MongoDB: 'rejected'<br/>PR: Closed | Admin (Telegram) |
| **Bug Investigation Specific** |
| GitHub: Bug Investigation<br/>Review: (empty) | Bug Investigator agent investigates | GitHub: Bug Investigation<br/>Review: Waiting for Review | Agent (Cron) |
| GitHub: Bug Investigation<br/>Review: Waiting for Review | Admin selects fix → Implementation | GitHub: Ready for development<br/>Review: (empty) | Admin (Bug Fix UI) |
| GitHub: Bug Investigation<br/>Review: Waiting for Review | Admin selects fix → Tech Design | GitHub: Technical Design<br/>Review: (empty) | Admin (Bug Fix UI) |
| GitHub: Bug Investigation<br/>Review: Waiting for Review | Admin clicks "Request Changes" | GitHub: Bug Investigation<br/>Review: Request Changes | Admin (Telegram) |
| GitHub: Bug Investigation<br/>Review: Request Changes | Agent revises investigation | GitHub: Bug Investigation<br/>Review: Waiting for Review | Agent (Cron) |
| **Multi-Phase Specific** |
| GitHub: Technical Design<br/>Review: (empty) | Tech Design agent detects L/XL | GitHub: Technical Design<br/>Review: Waiting for Review<br/>**Phases artifact created** | Agent (Cron) |
| GitHub: Ready (Phase 1)<br/>Review: (empty) | Implementation agent creates Phase 1 PR | GitHub: PR Review<br/>Review: Waiting for Review<br/>**Phase 1 in progress** | Agent (Cron) |
| GitHub: Done (Phase 1)<br/>Phases: 1✅ 2⬜ 3⬜ | Webhook detects merge | GitHub: Ready for development<br/>Review: (empty)<br/>**Phase 2 unlocked** | Webhook |
| GitHub: Done (Phase 3)<br/>Phases: 1✅ 2✅ 3✅ | Webhook detects final phase merge | GitHub: Done<br/>Review: (empty)<br/>MongoDB: 'done'<br/>**All phases complete** | Webhook |
| **Undo Actions (5-minute window)** |
| GitHub: Implementation<br/>Review: Changes Requested | Admin clicks "Undo" (within 5 min) | GitHub: PR Review<br/>Review: (empty)<br/>**New notification sent** | Admin (Telegram) |
| Any design column<br/>Review: Changes Requested | Admin clicks "Undo" (within 5 min) | Same column<br/>Review: (empty)<br/>**New notification sent** | Admin (Telegram) |
| Any column<br/>Review: Changes Requested | Admin clicks "Undo" (after 5 min) | **Error: Undo window expired**<br/>No state change | Admin (Telegram) |

---

## 13. Decision Points Reference

Key decision points where admin makes manual choices.

### 13.1 Initial Routing (After Approval)

**When:** After admin clicks "Approve" on new request

**Bug reports** are automatically routed to **Bug Investigation** (no routing message shown). The Bug Investigator agent handles the initial analysis.

**Feature requests** show a routing message with these options:

| Button | Result | Best For |
|--------|--------|----------|
| 🎨 **Product Design** | Item → Product Design column | Features with UX/UI components |
| 🔧 **Tech Design** | Item → Technical Design column | Backend tasks, refactors |
| ⚡ **Ready for development** | Item → Ready for development column | Trivial features, clear requirements |
| 📋 **Keep in Backlog** | Item → Backlog column (stays) | Not ready to start, needs more info |

**Considerations:**
- **Feature size**: L/XL features benefit from design phases
- **User-facing**: UX changes need Product Design
- **Complexity**: Architectural changes need Tech Design
- **Clarity**: Clear, simple tasks can skip design

---

### 13.2 Design Review

**When:** Design PR created, Review Status = "Waiting for Review"

**Options:**

| Button | Result | Use When |
|--------|--------|----------|
| **Approve Design** | Design saved to S3, item advances to next phase (PR stays open) | Design looks good, ready to proceed |
| **Request Changes** | Review Status → Changes Requested, agent will revise | Design needs improvements, clarifications, or additions |
| **Reject** | PR closed, Review Status → Rejected | Design doesn't align, requirements changed, not proceeding |

**Considerations:**
- Design quality and completeness
- Alignment with product vision
- Technical feasibility
- Design system consistency

---

### 13.3 Implementation Review

**When:** Implementation PR approved by PR Review agent

**Options:**

| Button | Result | Use When |
|--------|--------|----------|
| **Merge** | PR squash-merged, item → Done | Code looks good, ready for production |
| **Request Changes** | Review Status → Changes Requested | Code needs improvements despite agent approval |
| **Reject** | PR closed, item rejected | Requirements changed, feature no longer needed |

**Considerations:**
- Trust in agent's review (usually reliable)
- Business requirements validation
- Breaking changes or migrations
- Security implications

---

### 13.4 Clarification Questions

**When:** Agent posts clarification question, Review Status = "Waiting for Clarification"

**Actions:**
1. Read question on GitHub issue
2. Post answer as comment
3. Click "Clarification Received" button

**Considerations:**
- Answer should be clear and actionable
- May need to consult stakeholders
- Can provide multiple options with preference

---

### 13.5 Phase Approval (Multi-Phase Items)

**When:** Each phase completes, before next phase starts

**Implicit Decision:** Merging a phase PR automatically unlocks the next phase

**Control Points:**
- Can pause between phases by not merging
- Can reject a phase and close entire feature
- Can request changes to current phase
- All phases must complete sequentially

**Considerations:**
- Each phase is independently testable
- Later phases build on earlier ones
- Can validate incrementally in production

---

## Summary

This document covers all major workflow scenarios:

✅ **Happy Paths:**
- Simple feature (skip design)
- Complex feature (multi-phase)
- Feature with full design pipeline
- Bug fix with investigation → fix selection → implementation

✅ **Revision Flows:**
- Design changes requested
- Implementation changes requested
- Multi-phase with mid-phase revisions

✅ **Special Cases:**
- Clarification questions
- Rejection scenarios
- Skipping design phases

✅ **References:**
- Complete status transition table
- Decision point guide

Use this document to understand the complete end-to-end workflow for any scenario in the agents workflow pipeline.
