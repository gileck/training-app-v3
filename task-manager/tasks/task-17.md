---
number: 17
title: Add QA Verification Step Using Playwright MCP
priority: High
size: M
complexity: Medium
status: TODO
dateAdded: 2026-01-27
---

# Task 17: Add QA Verification Step Using Playwright MCP

**Summary:** Add automated QA step after PR merge that uses Playwright MCP to navigate to the deployed app and verify the feature/bug fix works as expected.

## Details

Currently, there's no automated verification that merged features actually work in production. This task adds a QA verification step that:

- Runs after PR is merged and deployed (post-merge webhook)
- Uses Playwright MCP to interact with the deployed application
- Verifies the feature request or bug fix works as described
- Reports results to GitHub issue and Telegram

## Implementation Notes

1.

## Files to Modify

- `src/server/project-management/types.ts` - Add "QA Failed" status if needed
- `scripts/github-workflows-agent.ts` - Add QA agent execution
- `docs/github-agents-workflow/workflow-guide.md` - Document QA phase

## Notes

- Playwright MCP tools are already available (mcp__plugin_playwright_playwright__*)
- Tests should be simple happy-path verification, not comprehensive E2E tests
- Consider adding retry logic for flaky tests (network issues, slow loads)

---
