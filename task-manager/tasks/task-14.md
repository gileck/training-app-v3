---
number: 14
title: Fix Issue Parsing Summary Section in Issue Log File
priority: High
size: S
complexity: Low
status: Done
dateAdded: 2026-01-27
---

# Task 14: Fix Issue Parsing Summary Section in Issue Log File

**Summary:** The agent workflow encounters a warning "Found summary section but could not parse table - creating new summary" when processing issue log files like agent-logs/issue-48.md, preventing proper cost tracking updates.

## Files to Modify

- `src/agents/lib/logging/index.ts` - Fix summary section table parsing
- --
