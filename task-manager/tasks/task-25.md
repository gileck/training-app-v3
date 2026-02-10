---
number: 25
title: Phase PRs Target Issue Branch Instead of Master
priority: High
size: L
complexity: High
status: Done
dateAdded: 2026-01-27
dateUpdated: 2026-02-05
dateCompleted: 2026-02-05
completionCommit: 374bf1c
---

# Task 25: Phase PRs Target Issue Branch Instead of Master

**Summary:** Change multi-phase feature workflow so PRs are pushed to an issue-specific branch rather than master, preventing incomplete features from reaching production.

## Files to Modify

- `src/agents/core-agents/implementAgent/` - Change branch targeting logic
- `src/agents/lib/git.ts` - Add issue branch creation/management
- PR creation logic - Target issue branch for phases
- Add final merge step after last phase completes
- Update GitHub Project status handling for final merge

## Risks

- Adds complexity to the branch management
- Need to handle merge conflicts between phases
- May need manual intervention if issue branch diverges significantly from master

## Notes

- This is a significant architectural change to the workflow
- Should be thoroughly tested with a multi-phase feature before deploying
