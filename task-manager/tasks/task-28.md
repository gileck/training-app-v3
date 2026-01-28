---
number: 28
title: Issue Workflow Configuration Page from Telegram
priority: High
size: XL
complexity: High
status: TODO
dateAdded: 2026-01-27
dateUpdated: 2026-01-27
---

# Task 28: Issue Workflow Configuration Page from Telegram

**Summary:** Add a web-based configuration page for each issue, accessible from Telegram, allowing admin to configure the entire workflow before it starts (phases, plans, reviews, etc.).

## Problem

Currently, workflow configuration is global (in `agents.config.ts`) and cannot be customized per-issue. Different issues may need:
1. Different number of phases
2. Plan subagent enabled/disabled
3. Different review strictness
4. Skip certain workflow stages
5. Custom prompts or context

## Proposed Solution

Create a web page that:
1. Is invoked from a Telegram button when an issue is approved
2. Shows all configurable workflow options for this specific issue
3. Allows admin to customize before starting workflow
4. Saves configuration to issue metadata (MongoDB or GitHub)
5. Workflow agents read this per-issue config

## Configuration Options

- **Phases**: Number of phases (1-5), auto-detect, or manual split
- **Plan Subagent**: Enable/disable for this issue
- **Product Design**: Skip/require
- **Tech Design**: Skip/require
- **PR Review Strictness**: Lenient/Normal/Strict
- **Auto-merge**: Enable/disable after approval
- **Custom Context**: Additional instructions for agents
- **Branch Strategy**: Target master or feature branch

## User Flow

```
1. Issue approved in Telegram
2. "Configure Workflow" button appears
3. Click opens web page: /admin/workflow-config/{issueId}
4. Admin adjusts settings
5. Click "Start Workflow"
6. Workflow runs with custom configuration
```

## Files to Modify

- Create `/src/client/routes/WorkflowConfig/` - New admin route
- Create `/src/apis/workflow-config/` - API for saving/loading config
- Update Telegram webhook to add config button
- Update agents to read per-issue config
- Create `src/server/database/collections/workflow-configs/`

## Considerations

- Config page should have sensible defaults
- Show estimated cost/time for different configurations
- Allow saving presets for common configurations
- Consider mobile-friendly design for quick Telegram→config flow

## Dependencies

- Task #22 (Per-Issue Plan Subagent Toggle) - Can be superseded by this

## Notes

- This is a significant feature that touches many parts of the system
- Consider implementing incrementally: basic config first, advanced later
