---
number: 11
title: Move Design Documents to Source Code with PR-Based Workflow
priority: High
size: L
complexity: High
status: Done
dateAdded: 2026-01-27
---

# Task 11: Move Design Documents to Source Code with PR-Based Workflow

**Summary:** Transition design document storage from GitHub issue comments to source code files. Design agents create PRs for documents, admin reviews/approves, and documents are linked to issues via pinned comment artifacts.

## Files to Modify

- `src/agents/core-agents/productDesignAgent/index.ts` - Add PR workflow
- `src/agents/core-agents/techDesignAgent/index.ts` - Add PR workflow
- `src/agents/core-agents/implementAgent/index.ts` - Read from files via artifact
- `src/server/project-management/types.ts` - Add new status values
- `.github/workflows/on-pr-merged.yml` - Add design PR merge handler
- --
