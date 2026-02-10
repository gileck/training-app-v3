---
number: 42
title: Create Bug Investigator Agent for GitHub Workflow
priority: High
size: L
complexity: High
status: Done
dateAdded: "2026-02-04"
dateUpdated: 2026-02-05
dateCompleted: 2026-02-05
completionCommit: c973913
planFile: task-manager/plans/task-42-plan.md
---

# Task 42: Create Bug Investigator Agent for GitHub Workflow

**Summary:** 

## Details

### Core Functionality

The bug-investigator agent's primary job is to **investigate the root cause of the bug as a first priority**. Key behaviors:

1. **Read-only investigation**: Uses only Read, Glob, Grep, WebFetch tools (no code changes)
2. **Root cause clarity**: Must clearly state whether root cause was found or not
3. **Multi-option output**: Provides fix options ranging from small quick fix to full refactor
4. **Iterative investigation**: Can request more logs be added and continue investigation when logs are added by implementation agent

### Output Format

Investigation summary posted on the issue should include:
- Root cause analysis (found/not found)
- Confidence level
- Multiple fix options with different complexity levels:
  - Quick fix (minimal changes)
  - Standard fix (recommended approach)
  - Full refactor (if underlying design issues exist)
- Files examined
- Request for additional logs (if needed)

### Workflow Integration

1. **Admin interaction**: Admin chooses fix option by commenting (possibly using clarify flow)
2. **Request changes**: Admin can request changes, sending back to bug-investigator for feedback addressing
3. **Continuation**: Once admin chooses option, workflow continues to:
   - Tech/Product Design agent (for complex fixes)
   - Implementation agent (for simple fixes)
4. **Context propagation**: All downstream agents check previous issue comments to understand the chosen approach

### Open Question

Should bug-investigator be allowed to open PR directly when:
- Root cause NOT found AND
- More logs are needed AND
- PR is ONLY for adding logging (never for fixes, even tiny ones)

This would speed up the investigation cycle but introduces write capability to an otherwise read-only agent.

## Implementation Notes

Reference implementation: `scripts/template/investigate-bugs.ts`

Key differences from reference:
- Outputs to GitHub issue instead of MongoDB
- Provides multiple fix options (not just one)
- Integrates with admin approval workflow
- Supports iterative investigation with log additions
- Uses clarify flow for option selection

New agent file: `src/agents/core-agents/bugInvestigatorAgent/index.ts`

## Files to Modify

- `src/agents/core-agents/bugInvestigatorAgent/index.ts` - New agent (primary)
- `src/agents/shared/prompts/bug-investigation.ts` - New prompt builders
- `src/agents/shared/index.ts` - Export new prompts
- `src/agents/index.ts` - Export new agent
- `src/agents/auto-advance.ts` - Add bug investigation column handling
- `docs/template/github-agents-workflow/overview.md` - Document new workflow step
- `src/agents/core-agents/technicalDesignAgent/index.ts` - Remove ALL bug-related code
- `src/agents/core-agents/technicalDesignAgent/AGENTS.md` - Remove bug documentation
- `src/agents/shared/prompts/bug-fix.ts` - Delete or repurpose for bug-investigator
- `src/agents/shared/utils.ts` - Remove getBugDiagnostics(), getIssueType() if bug-only

## Dependencies

- Existing GitHub adapter for issue comments
- Claude Code SDK for agent execution
- Clarify flow infrastructure (if using for option selection)

## Notes

This extends the bug fix workflow to have a dedicated investigation phase before jumping to implementation. Benefits:
- Better root cause analysis
- Multiple fix options for admin to choose from
- Reduces wasted implementation effort on wrong approach
- Supports complex bugs requiring multiple investigation cycles

**Important Architectural Change:** The tech-design agent is for technical design ONLY - no bug handling. All bug-related code (~50 lines) will be removed from tech-design. Clean separation:
- Bugs: bug-investigator → (optionally) tech-design → implementation
- Features: tech-design → implementation
