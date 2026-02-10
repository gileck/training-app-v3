---
number: 37
title: Implement Feature Branch Workflow with Phase PRs
priority: High
size: L
complexity: High
status: Done
dateAdded: 2026-02-01
dateUpdated: 2026-02-03
dateCompleted: 2026-02-03
completionCommit: 374bf1c
planFile: task-manager/plans/task-37-plan.md
---

# Task 37: Implement Feature Branch Workflow with Phase PRs

**Summary:** Refactor agent workflow to use feature branches per task with phase PRs for isolated review, replacing direct pushes to main

## Details

## Problem

Currently, agents push code directly to the main branch. This creates several issues:
- No isolation between concurrent workflows
- Difficult to review individual phases
- One broken feature can block others
- Hard to roll back individual features
- No preview deployments for verification before merge

## Implementation Notes

## Key Changes Required

### 1. Branch Management (workflow-runner or git utilities)
- Create feature branch when workflow starts: `feature/task-{issueId}`
- Track current branch per workflow
- Ensure phases work off the feature branch

### 2. PR Creation Logic
- Phase PRs target the feature branch, not main
- After all phases merge to feature branch, create final PR to main
- Include all phase changes in the final PR description

### 3. Implementor Agent Updates
- Push commits to feature branch
- Create phase PR targeting feature branch
- Wait for phase PR approval before continuing

### 4. PR Review Agent Updates
- Review phase PRs (to feature branch)
- Filter by file type (skip design docs, review only code)
- Approve/request changes on phase PRs

### 5. Final Merge Flow
- After last phase merges to feature branch
- Create PR from feature branch to main
- Admin verifies via Vercel preview
- Merge and delete feature branch

### 6. Vercel Integration
- Preview deployments for feature branches
- Include preview URL in final PR and Telegram notifications
