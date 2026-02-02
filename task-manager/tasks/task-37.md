---
number: 37
title: Implement Feature Branch Workflow with Phase PRs
priority: High
size: L
complexity: High
status: TODO
dateAdded: 2026-02-01
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

## Solution

Implement a feature branch workflow:

1. **One feature branch per task** - Each workflow creates `feature/task-{id}` from main
2. **Phase PRs to feature branch** - Each phase creates a PR targeting the feature branch (not main)
3. **Isolated phase reviews** - PR Review Agent reviews each phase in isolation
4. **Single PR to main** - After all phases complete, one PR from feature branch to main
5. **Admin verification** - Admin verifies complete feature via Vercel preview before merge

## Branch Flow

```
main ◄───────────────────── PR: "Task #42: Add feature X" (single PR)
                                    │
                            feature/task-42
                                    ▲
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
     Phase 1 PR ✓             Phase 2 PR ✓            Phase 3 PR
     (to feature branch)      (to feature branch)     (to feature branch)
```

## Benefits

- **Isolated reviews**: Each phase PR contains only that phase's changes
- **Single task = single PR to main**: Clean git history and tracking
- **Independent rollback**: Revert entire feature easily
- **Preview deployments**: Vercel preview per feature branch
- **No cross-contamination**: Workflows don't affect each other

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

## Files Likely to Modify

- `src/apis/github-agents-workflow/` - Core workflow logic
- Git utility functions for branch management
- PR creation/merge utilities
- Implementor agent prompts
- PR reviewer agent prompts
- Telegram notification messages
