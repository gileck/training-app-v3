---
number: 6
title: Add PR Size Validation Enforcement
priority: Medium
size: S
complexity: Low
status: TODO
dateAdded: 2026-01-27
---

# Task 6: Add PR Size Validation Enforcement

**Summary:** Tech design specifies phases should be S or M size, but implementation doesn't validate actual PR size.

## Files to Modify

- `src/agents/core-agents/implementAgent/index.ts` - Add validation
- `src/agents/shared/prompts.ts` - Update PR template to include size
- --
