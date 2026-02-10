---
number: 24
title: Standalone Task Creation Agent
priority: Medium
size: L
complexity: Medium
status: TODO
dateAdded: 2026-01-27
dateUpdated: 2026-01-27
---

# Task 24: Standalone Task Creation Agent

**Summary:** Create an agent that is separated from workflows and focused solely on creating GitHub issues, with admin approval before issues are created.

## Problem

Currently, task/issue creation is tightly coupled with the full workflow pipeline. There's no lightweight way to:
1. Have an AI agent propose new tasks based on analysis
2. Queue proposed tasks for admin review
3. Approve/reject proposed tasks before they become GitHub issues

## Proposed Solution

Create a standalone agent that:
1. Analyzes codebase, user feedback, or other inputs
2. Generates proposed tasks/issues with title, description, labels
3. Stores proposals in a pending queue (MongoDB or local file)
4. Sends Telegram notification for each proposal with approve/reject buttons
5. Only creates GitHub issues when admin approves

## Use Cases

- Agent analyzes TODO comments in code and proposes issues
- Agent reviews error logs and proposes bug tickets
- Agent analyzes user feedback and proposes feature requests
- Agent identifies technical debt and proposes refactoring tasks

## Files to Modify

- Create `src/agents/core-agents/taskCreationAgent/` - New agent
- Create `src/server/database/collections/proposed-tasks/` - Storage for proposals
- Update Telegram webhook to handle approval callbacks
- Add CLI command `yarn agent:create-tasks`

## Considerations

- Should be invokable independently from main workflow
- Proposals should include enough context for admin decision
- Rejected proposals should be logged for learning
- Consider rate limiting to prevent spam

## Notes

- This decouples task creation from task execution
- Enables proactive task discovery without committing to full workflow
