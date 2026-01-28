---
number: 25
title: Phase PRs Target Issue Branch Instead of Master
priority: High
size: L
complexity: High
status: TODO
dateAdded: 2026-01-27
dateUpdated: 2026-01-27
---

# Task 25: Phase PRs Target Issue Branch Instead of Master

**Summary:** Change multi-phase feature workflow so PRs are pushed to an issue-specific branch rather than master, preventing incomplete features from reaching production.

## Problem

Currently, when a multi-phase feature (L/XL) is being implemented:
1. Each phase creates a PR that merges to `master`
2. This means incomplete feature code goes to production after each phase
3. The feature may be in a broken or incomplete state between phases
4. Users may see half-implemented features

## Proposed Solution

Change the workflow so:
1. When a multi-phase feature starts, create an issue branch: `feature/issue-{N}`
2. Each phase PR targets this issue branch, not master
3. Phase PRs are merged into the issue branch sequentially
4. Only when ALL phases complete, create a final PR from issue branch to master
5. Final PR contains the complete feature

## Workflow Changes

```
Before (current):
Phase 1 PR → master
Phase 2 PR → master  (incomplete feature in prod!)
Phase 3 PR → master

After (proposed):
Phase 1 PR → feature/issue-123
Phase 2 PR → feature/issue-123
Phase 3 PR → feature/issue-123
Final PR: feature/issue-123 → master (complete feature)
```

## Files to Modify

- `src/agents/core-agents/implementAgent/` - Change branch targeting logic
- `src/agents/lib/git.ts` - Add issue branch creation/management
- PR creation logic - Target issue branch for phases
- Add final merge step after last phase completes
- Update GitHub Project status handling for final merge

## Considerations

- Need to handle branch cleanup after final merge
- Consider branch protection rules for issue branches
- Handle case where issue branch gets stale/conflicts
- Update Telegram notifications to reflect new flow

## Risks

- Adds complexity to the branch management
- Need to handle merge conflicts between phases
- May need manual intervention if issue branch diverges significantly from master

## Notes

- This is a significant architectural change to the workflow
- Should be thoroughly tested with a multi-phase feature before deploying
