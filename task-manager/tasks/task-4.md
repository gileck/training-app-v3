---
number: 4
title: Add Agent Retry Logic for Transient Failures
priority: Medium
size: M
complexity: Mid
status: TODO
dateAdded: 2026-01-27
---

# Task 4: Add Agent Retry Logic for Transient Failures

**Summary:** When agents fail due to timeouts, rate limits, or transient errors, they must be manually re-run. Need automatic retry with backoff.

## Files to Modify

- `src/agents/lib/adapters/claude-code-sdk.ts` - Add retry wrapper
- `src/agents/shared/config.ts` - Add retry configuration
- `src/agents/core-agents/*/index.ts` - Wrap execution with retry
- --
