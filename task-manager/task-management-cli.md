# Task Management CLI

A command-line tool for managing tasks from `tasks.md`.

## Overview

The Task Management CLI provides slash commands for working with tasks, including listing, planning, and tracking work. All commands integrate with git workflows and can automatically mark tasks as done after PR merges.

## Commands

### List Tasks

Display all tasks organized by priority:

```bash
yarn task list
# or
yarn task:list
```

**Output:**
```
📋 Tasks by Priority

🔴 Critical:
  1. Fix Cost Tracking Bug in Implementation Agent (XS)

🟠 High:
  2. Debug PR Reviewer + Claude Integration (S)
  3. Add "Ready to Merge" Status with Admin Approval Gate (M)

🟡 Medium:
  4. Add Agent Retry Logic for Transient Failures (M)
  ...
```

### Work on Task

Start working on a specific task (creates/switches to git branch):

```bash
yarn task work --task 1
# or
yarn task:work --task 1
```

**What it does:**
1. Creates a new branch: `task/1-fix-cost-tracking-bug`
2. Switches to the branch (or uses existing if already created)
3. Displays task details
4. Shows next steps

**Output:**
```
🚀 Working on Task 1: Fix Cost Tracking Bug in Implementation Agent

Priority: Critical
Size: XS
Complexity: Low

📌 Branch: task/1-fix-cost-tracking-bug

🌿 Creating new branch...

✅ Ready to work on task!

📝 Task details:
...

💡 Next steps:
  1. Implement the task
  2. Run: yarn checks
  3. Commit your changes
  4. Create a PR
  5. After merge: yarn task mark-done --task 1
```

### Create Worktree

Create a git worktree in a separate directory for isolated work:

```bash
yarn task worktree --task 3
# or
yarn task:worktree --task 3
```

**What it does:**
1. Creates a git worktree at `../worktree-task-3/`
2. Creates a new branch: `task/3-add-ready-to-merge-status`
3. Provides instructions for getting started

**Use case:** Work on multiple tasks simultaneously without branch switching.

**Output:**
```
🔧 Creating worktree for Task 3: Add "Ready to Merge" Status

📂 Worktree path: /Users/you/Projects/worktree-task-3
🌿 Branch: task/3-add-ready-to-merge-status

✅ Worktree created!

💡 To start working:
  cd /Users/you/Projects/worktree-task-3
  yarn install
  # Make your changes
  yarn checks
  git add . && git commit -m "..."
  git push -u origin task/3-add-ready-to-merge-status
  yarn github-pr create --title "..." --body "..."
  # After merge: yarn task mark-done --task 3
```

### Plan Task

View task details for planning (displays task content):

```bash
yarn task plan --task 5
# or
yarn task:plan --task 5
```

**What it does:**
- Displays full task details
- Shows priority, size, complexity
- Displays implementation details, file lists, etc.

**Use case:** Review task requirements before implementation or when using Plan Mode.

**Note:** Plan agent integration is planned but not yet implemented. For now, this command displays task details for manual planning.

### Mark Task Done

Mark a task as completed in `tasks.md`:

```bash
yarn task mark-done --task 1
# or
yarn task:mark-done --task 1
```

**What it does:**
1. Adds `✅ DONE` marker to the task header in `tasks.md`
2. Provides git commit instructions

**When to use:** After your PR is merged and the task is fully completed.

**Output:**
```
✅ Marking Task 1 as done: Fix Cost Tracking Bug in Implementation Agent

✅ Task marked as done in tasks.md

💡 Remember to commit the change:
  git add tasks.md
  git commit -m "docs: mark task 1 as done"
  git push
```

## Complete Workflow Example

Here's a complete workflow for working on a task:

### 1. List tasks to choose what to work on

```bash
yarn task:list
```

### 2. Start working on task (single workspace)

```bash
yarn task:work --task 1
```

### 3. Implement the task

```typescript
// Make your code changes...
```

### 4. Validate

```bash
yarn checks
```

### 5. Commit and push

```bash
git add .
git commit -m "fix: correct cost tracking in implementation agent"
git push -u origin task/1-fix-cost-tracking-bug
```

### 6. Create PR

```bash
yarn github-pr create \
  --title "fix: Cost Tracking Bug in Implementation Agent" \
  --body "Fixes #1 - Updates logExecutionEnd to use actual usage values"
```

### 7. After PR is merged

```bash
yarn task:mark-done --task 1
git add tasks.md
git commit -m "docs: mark task 1 as done"
git push
```

## Worktree Workflow (Multiple Tasks)

If you want to work on multiple tasks simultaneously:

### Task 1 in main workspace

```bash
yarn task:work --task 1
# Work on task 1...
```

### Task 2 in separate worktree

```bash
yarn task:worktree --task 2
cd ../worktree-task-2
yarn install
# Work on task 2...
```

### When done with worktree

```bash
cd /original/project
git worktree remove ../worktree-task-2
```

## Integration with GitHub Workflows

The task CLI integrates seamlessly with other tools:

### GitHub PR Tool

```bash
# Create PR after implementing task
yarn github-pr create --title "fix: task 1" --body "Description"

# Check PR status
yarn github-pr info --pr 123

# Merge PR
yarn github-pr merge --pr 123 --method squash
```

### Agent Tools

```bash
# Use agents to implement tasks
yarn agent:implement --issue 123

# Review PRs
yarn agent:pr-review --pr 123
```

## Tips

### Task Numbering

Tasks are numbered sequentially in `tasks.md`. The CLI parses task numbers from headers:

```markdown
## 1. Fix Cost Tracking Bug
## 2. Debug PR Reviewer
## 3. Add Ready to Merge Status
```

### Branch Naming

Branches are automatically named based on task number and title:
- Task 1: `task/1-fix-cost-tracking-bug`
- Task 3: `task/3-add-ready-to-merge-status`

### Marking Tasks Done

Always mark tasks as done after merging to keep `tasks.md` up to date:

```bash
yarn task:mark-done --task 1
```

This adds `✅ DONE` to the task header:

```markdown
## 1. Fix Cost Tracking Bug in Implementation Agent ✅ DONE
```

### Planning Before Implementation

Use the plan command to review task details:

```bash
yarn task:plan --task 5
```

This is especially useful when:
- Entering Plan Mode in Claude Code
- Reviewing complex tasks before starting
- Understanding dependencies and scope

## Configuration

No configuration needed. The CLI:
- Auto-detects `tasks.md` in project root
- Parses task metadata from markdown tables
- Uses git for branch management

## Error Handling

### Task not found

```bash
yarn task:work --task 99
# ❌ Task 99 not found
```

### No tasks.md

```bash
yarn task:list
# ❌ tasks.md not found
```

### Worktree already exists

The CLI automatically removes old worktrees before creating new ones.

## Future Enhancements

Planned features:
- Plan agent integration for automated planning
- Auto-create GitHub issues from tasks
- Task dependencies and ordering
- Task templates for common patterns
- Integration with agent workflows
- Task completion tracking in metadata

## Related Documentation

- [GitHub Projects Integration](./github-projects-integration.md)
- [GitHub PR CLI Tool](../CLAUDE.md#github-pr-cli-tool)
- [Agent Library Abstraction](./agent-library-abstraction.md)
