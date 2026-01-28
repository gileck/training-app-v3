---
number: 23
title: Workflow Source Code Audit Command
priority: Medium
size: M
complexity: Medium
status: TODO
dateAdded: 2026-01-27
dateUpdated: 2026-01-27
---

# Task 23: Workflow Source Code Audit Command

**Summary:** Create a CLI command similar to `audit-project` but specifically for auditing workflow/agent source code quality and consistency.

## Problem

The `audit-project` command audits the entire application codebase, but there's no dedicated tool to audit just the workflow/agent source code. The agent system has its own patterns, conventions, and best practices that should be validated separately.

## Proposed Solution

Create a new CLI command `yarn audit-workflow` (or similar) that:
1. Validates agent code follows established patterns
2. Checks for consistency in agent implementations
3. Verifies prompt templates follow best practices
4. Ensures error handling is consistent across agents
5. Validates configuration files are complete and correct

## Areas to Audit

- Agent implementations in `src/agents/`
- Prompt templates and their structure
- Configuration files (`agents.config.ts`, etc.)
- Shared utilities and their usage
- Error handling patterns
- Logging consistency
- Type definitions and exports

## Files to Modify

- Create `scripts/audit-workflow.ts` - Main audit script
- `package.json` - Add `yarn audit-workflow` command
- Possibly create `src/agents/audit/` - Audit rules and validators

## Notes

- Should be similar in approach to existing `audit-project` command
- Output should be clear and actionable
- Consider generating a report file for review
