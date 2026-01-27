---
description: Plan a task using a background Plan agent and save the plan to task-manager/plans/
---

# Plan Task Command

Create an implementation plan for a task using a background Plan agent. The plan is saved to `task-manager/plans/` and the task is updated with a reference to the plan.

## Usage

Invoke this command with a task number:
- `/plan-task 17` - Create plan for task 17
- `/plan-task --task 5` - Create plan for task 5

## Process Overview

---

## Step 1: Parse Task Number

- **Objective**: Extract the task number from the command arguments
- **Actions**:
  - Parse `$ARGUMENTS` for the task number
  - Support formats: `17`, `--task 17`, `-t 17`
  - If no task number provided, show error and usage

**Argument: $ARGUMENTS**

---

## Step 2: Load Task Details

- **Objective**: Read the full task information
- **Actions**:
  - Run: `yarn task view --task N` to get task details
  - Verify task exists and is not already Done
  - Extract: title, summary, details, implementation notes, files to modify, dependencies, risks
  - If task doesn't exist, show error and exit

---

## Step 3: Check for Existing Plan

- **Objective**: Avoid overwriting existing plans
- **Actions**:
  - Check if `task-manager/plans/task-N-plan.md` already exists
  - If exists, ask user: "A plan already exists for this task. Overwrite it?"
  - If user declines, exit gracefully

---

## Step 4: Read Project Guidelines

- **Objective**: Provide context for the Plan agent
- **Actions**:
  - Read `CLAUDE.md` for project guidelines
  - Read any specific docs mentioned in the task
  - This context helps the Plan agent create a relevant plan

---

## Step 5: Launch Background Plan Agent

- **Objective**: Use the Plan agent to create a detailed implementation plan
- **Actions**:
  - Launch a Task with `subagent_type: Plan` and `run_in_background: true`
  - Provide the Plan agent with:
    - Full task details (title, summary, details, etc.)
    - Project guidelines from CLAUDE.md
    - Files to modify (if specified)
    - Dependencies and risks
  - The Plan agent will explore the codebase and create a plan

**Plan Agent Prompt Template:**

```
Create an implementation plan for the following task. Explore the codebase thoroughly to understand:
- Existing patterns and architecture
- Related code and dependencies
- Potential challenges

## Task Details

**Task #{N}: {Title}**

**Summary:** {Summary}

**Details:**
{Details from task}

**Implementation Notes:**
{Implementation notes from task}

**Files to Modify:**
{List of files from task}

**Dependencies:**
{Dependencies from task}

**Risks:**
{Risks from task}

## Instructions

1. Explore the codebase to understand the current implementation
2. Identify all files that need to be modified
3. Break down the work into clear sub-tasks
4. Note any decisions or trade-offs to consider
5. Output your plan in the following format:

# Task {N}: {Title} - Implementation Plan

## Objective
Brief description of what we're implementing.

## Approach
High-level approach and key decisions.

## Sub-tasks
- [ ] Sub-task 1 with clear description
- [ ] Sub-task 2 with clear description
- [ ] ...

## Files to Modify
- `path/to/file.ts` - What changes
- ...

## Notes
Any additional context, trade-offs, or decisions.
```

---

## Step 6: Wait for Plan Agent Completion

- **Objective**: Monitor the background agent
- **Actions**:
  - Inform user: "Planning task #{N}... This may take a few minutes."
  - Use TaskOutput to periodically check status (every 30 seconds)
  - When complete, retrieve the plan content

---

## Step 7: Save Plan to File

- **Objective**: Persist the plan to the plans directory
- **Actions**:
  - Ensure `task-manager/plans/` directory exists
  - Write plan to `task-manager/plans/task-N-plan.md`
  - The plan should follow the standard format:

**Plan File Structure:**

```markdown
# Task N: [Title] - Implementation Plan

## Objective
Brief description of what we're implementing.

## Approach
High-level approach and key decisions.

## Sub-tasks
- [ ] Sub-task 1
- [ ] Sub-task 2
- [ ] ...

## Files to Modify
- `path/to/file.ts` - What changes

## Notes
Additional context or decisions.
```

---

## Step 8: Update Task with Plan Reference

- **Objective**: Link the task to its plan
- **Actions**:
  - Read the task file: `task-manager/tasks/task-N.md`
  - Add `planFile: task-manager/plans/task-N-plan.md` to YAML frontmatter
  - Save the updated task file
  - Rebuild the task index: `yarn task rebuild-index`

**Example Updated Frontmatter:**

```yaml
---
number: 17
title: Add QA Verification Step
priority: High
size: M
complexity: Medium
status: TODO
dateAdded: 2026-01-27
planFile: task-manager/plans/task-17-plan.md
---
```

---

## Step 9: Display Results

- **Objective**: Show user the completed plan
- **Actions**:
  - Display success message
  - Show plan file location
  - Provide next steps

**Output:**

```
✅ Plan created for Task #{N}!

📋 Plan saved to: task-manager/plans/task-{N}-plan.md
📝 Task updated with plan reference

## Plan Summary

[Brief summary of the plan - objectives and key sub-tasks]

## Sub-tasks ({count})
- [ ] Sub-task 1
- [ ] Sub-task 2
...

💡 Next Steps:
- Review the plan: cat task-manager/plans/task-{N}-plan.md
- Start implementation: /start-task {N}
- The /start-task command will automatically use this plan
```

---

## Quick Checklist

- [ ] Task number parsed from arguments
- [ ] Task loaded and verified (exists, not Done)
- [ ] Checked for existing plan (asked to overwrite if exists)
- [ ] Project guidelines read for context
- [ ] Background Plan agent launched with full task details
- [ ] Agent completion monitored and plan retrieved
- [ ] Plan saved to `task-manager/plans/task-N-plan.md`
- [ ] Task frontmatter updated with `planFile` reference
- [ ] Task index rebuilt
- [ ] Results displayed with next steps

---

## Error Handling

**Task Not Found:**
```
❌ Task #{N} not found. Use `yarn task list` to see available tasks.
```

**Task Already Done:**
```
⚠️ Task #{N} is already marked as Done. No plan needed.
```

**Plan Agent Timeout:**
```
⚠️ Plan agent is taking longer than expected.
Current status: [status]
You can check progress later with: cat task-manager/plans/task-{N}-plan.md
```

---

## Notes

- Plans are recommended for M/L/XL tasks
- XS/S tasks may not need detailed plans
- The `/start-task` command will automatically use the plan if it exists
- Plans can be manually edited after creation
- Use `yarn task view --task N` to see if a task has a plan
