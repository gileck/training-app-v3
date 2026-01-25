# Task Management - Quick Reference

## Claude Code Slash Commands (Recommended)

**These commands make Claude actively work with tasks:**

| Slash Command | Description |
|---------------|-------------|
| `/add-task` | Create a new task interactively following standardized format |
| `/task-list` | List all tasks by priority (active and completed) |
| `/start-task 1` | Claude implements task 1 with full workflow |
| `/start-task-worktree 3` | Claude implements task 3 in a new worktree |
| `/mark-task-as-done` | Mark last task as done with commit hash (auto-detect) |
| `/mark-task-as-done 5` | Mark task 5 as done with commit hash |

**Use these in Claude Code CLI/Cloud for automated task management.**

---

## CLI Commands (Manual Use)

**For manual task management:**

| Command | Description | Example |
|---------|-------------|---------|
| `yarn task list` | List all tasks by priority | `yarn task list` |
| `yarn task work --task N` | Start working on task N | `yarn task work --task 1` |
| `yarn task worktree --task N` | Create worktree for task N | `yarn task worktree --task 3` |
| `yarn task plan --task N` | View task details for planning | `yarn task plan --task 5` |
| `yarn task mark-done --task N` | Mark task as completed | `yarn task mark-done --task 1` |

## Quick Workflows

### Automated Workflow (Claude Code Slash Commands)

```bash
# In Claude Code CLI or Cloud:

# 1. See available tasks
/task-list

# 2. Claude implements the task automatically
/start-task 1

# Claude will:
# - Create git branch
# - Read task requirements
# - Implement the solution
# - Run validation (yarn checks)
# - Commit and create PR
# - Provide completion summary
```

### Worktree Workflow (Squash-Merge)

```bash
# In Claude Code CLI or Cloud:

# 1. See available tasks
/task-list

# 2. Claude implements in worktree with squash-merge
/start-task-worktree 1

# Claude will:
# - Create worktree and branch
# - Symlink node_modules (NOT yarn install - saves time/space)
# - Implement with WIP commits
# - Run validation (yarn checks)
# - Return to main worktree
# - Squash merge into ONE clean commit
# - Push to main
# - Clean up worktree
# - Mark task as done
```

### Manual Workflow (CLI Commands)

```bash
# 1. See what needs to be done
yarn task list

# 2. Start working on a task
yarn task work --task 1

# 3. Make changes, commit, create PR
yarn checks
git add . && git commit -m "fix: description"
git push -u origin task/1-branch-name
yarn github-pr create --title "fix: title" --body "description"

# 4. After PR merges, mark done
yarn task mark-done --task 1
git add task-manager/tasks.md && git commit -m "docs: mark task 1 as done"
git push
```

## CLI Command Examples

```bash
yarn task list              # List tasks
yarn task work --task 1     # Work on task
yarn task worktree --task 2 # Create worktree
yarn task plan --task 3     # Plan task
yarn task mark-done --task 1 # Mark done
```

## Slash Commands Details

### `/task-list`

Lists all tasks organized by priority with recommendations.

**What it does:**
- Reads task-manager/tasks.md
- Groups by priority (Critical → High → Medium → Low)
- Displays task numbers, titles, and sizes
- Recommends highest priority task

**When to use:**
- Start of work session to see what needs attention
- After completing a task to pick the next one
- Planning your work for the day/week

---

### `/start-task N`

Claude actively implements task N following a complete workflow.

**What Claude does:**
1. Creates git branch (`task/N-task-name`)
2. Reads and understands task requirements
3. Reviews relevant documentation (CLAUDE.md, etc.)
4. Explores code that needs modification
5. Creates implementation plan (for complex tasks)
6. Implements the solution
7. Runs `yarn checks` validation
8. Reviews the implementation
9. Commits changes
10. Pushes and creates PR
11. Provides completion summary

**When to use:**
- For any task you want Claude to implement
- Tasks with clear requirements in task-manager/tasks.md
- When you want automated implementation with validation

**Best for:** XS, S, and M sized tasks

---

### `/start-task-worktree N`

Claude implements task N in a separate git worktree using squash-merge workflow.

**What Claude does:**
1. Creates worktree at `../worktree-task-N/`
2. Creates git branch in worktree
3. Installs dependencies in worktree
4. Implements task (WIP commits OK in worktree)
5. Runs validation checks
6. Returns to main worktree
7. **Squash merges** all commits into ONE clean commit
8. Pushes to main (no PR needed)
9. Cleans up worktree and branch

**When to use:**
- Working on multiple tasks simultaneously
- Solo work or trusted implementation
- Want isolated environment for experiments
- Small/medium tasks that don't need code review
- Want clean commit history (one commit per task)

**Benefits:**
- Clean history: ONE commit per task on main
- Freedom to commit freely in worktree (will be squashed)
- No PR review cycle for simple tasks
- Easy abort (just delete worktree)
- Multiple tasks in parallel
- Direct to main for fast iteration

---

### `/mark-task-as-done [N]`

Mark a task as complete with commit hash and completion date.

**What it does:**
1. Auto-detects task number from recent git commit (if not provided)
2. Gets current commit hash
3. Updates task header with strikethrough and ✅ DONE marker
4. Adds completion metadata (date + commit hash)
5. Displays success message with next steps

**Usage:**
```bash
/mark-task-as-done        # Auto-detect from "task #N" in recent commit
/mark-task-as-done 5      # Mark task 5 as done
```

**When to use:**
- After merging a PR that completed a task
- To manually mark a task complete with commit reference
- When you forgot to mark a task done during implementation
- To update completion info for an already-done task

**Auto-detection:**
- Searches recent commits for "task #N" pattern
- Uses the most recent commit mentioning a task
- Falls back to asking for task number if not found

**Example output:**
```
✅ Task #5 marked as done!

📝 Task: Fix Cost Tracking Bug
📅 Completed: 2026-01-25
🔗 Commit: abc1234

💡 Next Steps:
- Commit: git add task-manager/tasks.md && git commit -m "docs: mark task #5 as done"
```

---

## Comparison: Slash Commands vs CLI

| Aspect | `/start-task` | `/start-task-worktree` | CLI Commands |
|--------|---------------|------------------------|--------------|
| **Who does work** | Claude | Claude | You |
| **Workspace** | Main | Separate worktree | Main |
| **Commits** | Clean commits | WIP commits (squashed) | Your commits |
| **Merge method** | PR with review | Squash merge to main | Manual |
| **Code review** | Yes (PR) | No (direct to main) | Manual |
| **Validation** | Auto runs checks | Auto runs checks | You run checks |
| **Best for** | Team work, reviews | Solo work, experiments | Learning, control |
| **Speed** | Medium (PR cycle) | Fast (no PR) | Slow (manual) |

---

## When to Use Each Approach

### Use Slash Commands (`/start-task`) when:
- ✅ Task requirements are clear in task-manager/tasks.md
- ✅ You want automated implementation
- ✅ Task follows established patterns
- ✅ You trust Claude to implement correctly
- ✅ You want to save time

### Use CLI Commands (`yarn task work`) when:
- ✅ You want to implement manually
- ✅ Task requires creative problem-solving
- ✅ You're learning the codebase
- ✅ Task has ambiguous requirements
- ✅ You want full control

### Use Worktree (`/start-task-worktree`) when:
- ✅ Working on multiple tasks simultaneously
- ✅ Solo work or trusted automated implementation
- ✅ Small/medium tasks that don't need code review
- ✅ Want to experiment freely (easy to abort)
- ✅ Want clean history (one commit per task on main)
- ✅ Need isolated environment without affecting main workspace

---

## See Full Documentation

For detailed usage, examples, and workflows, see:
- [task-manager/task-management-cli.md](task-manager/task-management-cli.md)
- Slash command docs:
  - `.claude/commands/add-task.md`
  - `.claude/commands/task-list.md`
  - `.claude/commands/start-task.md`
  - `.claude/commands/start-task-worktree.md`
  - `.claude/commands/mark-task-as-done.md`
