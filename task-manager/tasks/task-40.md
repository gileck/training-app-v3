---
number: 40
title: "Extract Shared Git Utilities to src/agents/lib/git.ts"
priority: Medium
size: S
complexity: Low
status: TODO
dateAdded: 2026-02-04
---

# Task 40: Extract Shared Git Utilities to src/agents/lib/git.ts

**Summary:** Extract duplicated git utility functions from design agents into a shared module

## Details

All three design agents (technicalDesignAgent, productDesignAgent, productDevelopmentAgent) have identical git utility functions duplicated (~80 lines each). This creates maintenance burden and increases the risk of bugs being fixed in one place but not others.

## Implementation Notes

Extract the following 8 functions to `src/agents/lib/git.ts`:
- `git()` - Execute git command and return output
- `hasUncommittedChanges()` - Check for uncommitted changes
- `branchExistsLocally()` - Check if branch exists locally
- `checkoutBranch()` - Checkout or create branch
- `getCurrentBranch()` - Get current branch name
- `commitChanges()` - Commit all changes with message
- `pushBranch()` - Push branch to origin
- `getDefaultBranch()` - Get default branch name

Then update all three agents to import from the shared module.

## Files to Modify

- `src/agents/lib/git.ts` - Create new shared module
- `src/agents/lib/index.ts` - Export git utilities
- `src/agents/core-agents/technicalDesignAgent/index.ts` - Remove local git functions, import from lib
- `src/agents/core-agents/productDesignAgent/index.ts` - Remove local git functions, import from lib
- `src/agents/core-agents/productDevelopmentAgent/index.ts` - Remove local git functions, import from lib

## Notes

Identified during bug fix for feedback mode branch checkout issue - the same bug existed in all three agents due to code duplication.
