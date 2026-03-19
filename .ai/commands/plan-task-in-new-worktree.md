---
description: Create a git worktree and plan a task in isolation using a background Plan agent
---

# Plan Task in New Worktree Command

Create a separate git worktree and generate an implementation plan for a task in isolation. This combines `/start-task-worktree` setup with `/plan-task` planning, allowing you to explore and plan in an isolated environment.

## Usage

Invoke this command with a task number:
- `/plan-task-in-new-worktree 17` - Create worktree and plan for task 17
- `/plan-task-in-new-worktree --task 5` - Create worktree and plan for task 5

## When to Use This Command

**Use this command when:**
- Planning a complex task that requires codebase exploration
- Want isolated environment for planning without affecting main workspace
- Plan to continue with implementation in the same worktree after planning
- Need to experiment with code exploration during planning

**Use regular `/plan-task` when:**
- Quick planning without isolation needed
- Already have the worktree set up
- Planning simple tasks

---

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

## Step 4: Create Worktree

- **Objective**: Set up isolated workspace for the task
- **Actions**:
  - Run: `yarn task worktree --task N` (where N is the task number)
  - This automatically:
    - Creates worktree at `../worktree-task-N/`
    - Creates new branch: `task/N-task-name`
    - Provides setup instructions
  - Note the worktree path and branch name

**Expected Output:**
```
🔧 Creating worktree for Task N: Task Title

📂 Worktree path: /Users/you/Projects/worktree-task-N
🌿 Branch: task/N-task-name

✅ Worktree created!
```

---

## Step 5: Navigate to Worktree and Symlink Dependencies

- **Objective**: Set up worktree environment
- **Actions**:
  - Save main project path: `MAIN_PROJECT_PATH=$(pwd)`
  - Change to worktree: `cd ../worktree-task-N`
  - Symlink node_modules (DO NOT run yarn install): `ln -s "${MAIN_PROJECT_PATH}/node_modules" node_modules`
  - Verify symlink created: `ls -la node_modules`

**CRITICAL - Always symlink, never install:**
- Faster: No dependency installation
- Same dependencies: Uses exact same packages as main workspace
- Never run `yarn install` in worktree - Always use symlink

---

## Step 6: Read Project Guidelines

- **Objective**: Provide context for the Plan agent
- **Actions**:
  - Read `CLAUDE.md` for project guidelines
  - Read any specific docs mentioned in the task
  - This context helps the Plan agent create a relevant plan

---

## Step 7: Launch Background Plan Agent

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

## Step 8: Wait for Plan Agent Completion

- **Objective**: Monitor the background agent
- **Actions**:
  - Inform user: "Planning task #{N} in worktree... This may take a few minutes."
  - Use TaskOutput to periodically check status (every 30 seconds)
  - When complete, retrieve the plan content

---

## Step 9: Save Plan to File (in Worktree)

- **Objective**: Persist the plan to the plans directory in the worktree
- **Actions**:
  - Ensure `task-manager/plans/` directory exists in worktree
  - Write plan to `task-manager/plans/task-N-plan.md`

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

## Step 10: Update Task with Plan Reference (in Worktree)

- **Objective**: Link the task to its plan
- **Actions**:
  - Read the task file: `task-manager/tasks/task-N.md`
  - Add `planFile: task-manager/plans/task-N-plan.md` to YAML frontmatter
  - Save the updated task file
  - Rebuild the task index: `yarn task rebuild-index`

---

## Step 11: Commit Plan in Worktree

- **Objective**: Commit the plan files
- **Actions**:
  - Stage changes: `git add task-manager/`
  - Commit: `git commit -m "docs: add implementation plan for task #N"`

---

## Step 12: Display Results and Next Steps

- **Objective**: Show user the completed plan and options
- **Actions**:
  - Display success message
  - Show plan summary
  - Provide next steps

**Output:**

```
✅ Plan created for Task #{N} in worktree!

📂 Worktree: ../worktree-task-N
🌿 Branch: task/N-task-name
📋 Plan: task-manager/plans/task-{N}-plan.md

## Plan Summary

[Brief summary of the plan - objectives and key sub-tasks]

## Sub-tasks ({count})
- [ ] Sub-task 1
- [ ] Sub-task 2
...

💡 Next Steps (choose one):

Option A - Continue implementing in worktree:
  # You're already in the worktree with the plan ready.
  # Follow /start-task-worktree steps 3-17 for implementation:
  #   - Steps 3-9: Implement (understand, explore, code, validate)
  #   - Step 8: Request user review (MANDATORY)
  #   - Steps 10-17: Merge and cleanup (squash merge to main)
  #
  # Quick reference:
  yarn checks                              # Validate before merge
  cd /path/to/main/project                 # Return to main
  git merge --squash task/N-branch-name    # Squash merge
  git commit -m "feat: description (#N)"   # Clean commit
  yarn task mark-done --task N             # Mark done
  git push origin main                     # Push
  git worktree remove ../worktree-task-N   # Cleanup

Option B - Review plan and decide later:
  # Return to main without implementing:
  cd /path/to/main/project
  # The plan is committed in the worktree branch
  # You can resume later with:
  cd ../worktree-task-N

Option C - Abort and discard:
  cd /path/to/main/project
  git worktree remove --force ../worktree-task-N
  git branch -D task/N-branch-name
```

---

## Quick Checklist

- [ ] Task number parsed from arguments
- [ ] Task loaded and verified (exists, not Done)
- [ ] Checked for existing plan (asked to overwrite if exists)
- [ ] Worktree created with `yarn task worktree --task N`
- [ ] Navigated to worktree and symlinked node_modules
- [ ] Project guidelines read for context
- [ ] Background Plan agent launched with full task details
- [ ] Agent completion monitored and plan retrieved
- [ ] Plan saved to `task-manager/plans/task-N-plan.md` (in worktree)
- [ ] Task frontmatter updated with `planFile` reference (in worktree)
- [ ] Task index rebuilt (in worktree)
- [ ] Plan committed in worktree
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

**Worktree Already Exists:**
```
⚠️ Worktree already exists for task #{N}.
Options:
1. Remove existing: git worktree remove --force ../worktree-task-N
2. Navigate to existing: cd ../worktree-task-N
```

**Plan Agent Timeout:**
```
⚠️ Plan agent is taking longer than expected.
Current status: [status]
You can check progress later with: cat task-manager/plans/task-{N}-plan.md
```

---

## Workflow Summary

```bash
# This command automates the following:

# 1. Create worktree
yarn task worktree --task N
cd ../worktree-task-N
ln -s "${MAIN_PROJECT_PATH}/node_modules" node_modules

# 2. Run Plan agent (background)
# [Plan agent explores codebase and creates plan]

# 3. Save plan
# task-manager/plans/task-N-plan.md created
# task-manager/tasks/task-N.md updated with planFile reference

# 4. Commit in worktree
git add task-manager/
git commit -m "docs: add implementation plan for task #N"

# Result: Worktree ready with plan, you can continue implementing
```

---

## Notes

- Plans are recommended for M/L/XL tasks
- The worktree stays active after planning for implementation
- Plan is committed in the worktree branch (not yet on main)
- When you squash merge to main later, the plan will be included
- Use `yarn task view --task N` to see if a task has a plan
- **For implementation after planning**: Follow `/start-task-worktree` steps 3-17 (implementation through cleanup)
