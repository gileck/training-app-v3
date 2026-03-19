# Task Management Slash Commands

Claude Code slash commands that actively implement tasks from `task-manager/tasks.md`.

## 🎯 What Are These?

Unlike CLI tools that you run manually, **slash commands make Claude actively work on tasks for you**.

- **CLI tools** (`yarn task work`): You use them to help yourself code
- **Slash commands** (`/start-task`): Claude uses them to code for you

## 📋 Available Slash Commands

### `/add-task`

**Interactively create a new task following the standardized format.**

```
In Claude Code:
> /add-task

What Claude does:
✅ Reads TASK_FORMAT.md for format specification
✅ Determines next task number automatically
✅ Asks for required fields (title, priority, size, complexity, summary)
✅ Optionally asks for additional fields (details, files, dependencies, risks)
✅ Generates properly formatted task markdown
✅ Inserts task in correct priority section of tasks.md
✅ Confirms task was added successfully

Example:
You: /add-task

Claude: Creating a new task in tasks.md. Next task number will be #13.

[Claude asks for task details using interactive questions]

You provide:
- Title: "Add Dark Mode Support"
- Priority: High, Size: M
- Complexity: Medium
- Summary: "Add dark mode theme toggle with persistent user preference"
- Optional: Details, Files to Modify

Claude:
✅ Task #13 added successfully!

📝 Task Details:
- Title: Add Dark Mode Support
- Priority: High
- Size: M
- Complexity: Medium

💡 Next Steps:
- Use /task-list to see all tasks
- Use /start-task 13 to implement this task
```

---

### `/task-list`

**Lists all tasks organized by priority.**

```
In Claude Code:
> /task-list

Output:
📋 Tasks by Priority

🔴 Critical:
  1. Fix Cost Tracking Bug in Implementation Agent (XS)

🟠 High:
  2. Debug PR Reviewer + Claude Integration (S)
  3. Add "Ready to Merge" Status (M)
...

💡 Recommended: Start with Task 1 (Critical, XS size)
```

---

### `/plan-task N`

**Create an implementation plan for a task using the background Plan agent.**

```
In Claude Code:
> /plan-task 17

What Claude does:
✅ Loads task details from task-manager/tasks/task-17.md
✅ Reads CLAUDE.md and project guidelines for context
✅ Launches a background Plan agent to explore the codebase
✅ Creates detailed implementation plan with sub-tasks
✅ Saves plan to task-manager/plans/task-17-plan.md
✅ Updates task frontmatter with planFile reference
✅ Displays plan summary and next steps

Example:
You: /plan-task 17

Claude: Planning Task #17: Add QA Verification Step Using Playwright MCP

[Plan agent explores codebase, identifies patterns, breaks down work...]

✅ Plan created for Task #17!

📋 Plan saved to: task-manager/plans/task-17-plan.md
📝 Task updated with plan reference

## Plan Summary
Objective: Add automated QA step after PR merge...

## Sub-tasks (7)
- [ ] Research Playwright MCP tool capabilities
- [ ] Add QA status to project types
- [ ] Create QA agent with Playwright tools
...

💡 Next Steps:
- Review the plan: cat task-manager/plans/task-17-plan.md
- Start implementation: /start-task 17
- The /start-task command will automatically use this plan
```

**When to use:**
- Before starting M/L/XL tasks (recommended)
- When you want a thorough plan before implementation
- When task has significant unknowns
- When exploring architecture is needed

**Benefits over inline planning:**
- Plan agent thoroughly explores codebase
- Plan is saved to file for reference
- `/start-task` will use the plan automatically
- Plan can be reviewed and edited before implementation

---

### `/start-task N`

**Claude implements task N with complete workflow.**

```
In Claude Code:
> /start-task 1

What Claude does:
✅ Creates git branch: task/1-fix-cost-tracking-bug
✅ Reads task requirements from task-manager/tasks.md
✅ Reviews CLAUDE.md guidelines
✅ Explores relevant code files
✅ Creates implementation plan (if complex)
✅ Implements the solution
✅ Runs yarn checks validation
✅ Reviews implementation
✅ Commits with proper message
✅ Pushes and creates PR
✅ Provides completion summary
```

**Example conversation:**

```
You: /start-task 1

Claude: I'll implement Task 1: Fix Cost Tracking Bug in Implementation Agent

[Claude reads task, explores code, implements solution...]

✅ Implementation complete!

Summary:
- Fixed cost tracking in implementAgent/index.ts:939
- Changed logExecutionEnd to use actual usage values
- Validation: yarn checks passed ✅
- PR created: #123

After PR merges, run: yarn task mark-done --task 1
```

---

### `/start-task-worktree N`

**Claude implements task N in a separate worktree for isolation.**

```
In Claude Code:
> /start-task-worktree 3

What Claude does:
✅ Creates worktree at ../worktree-task-3/
✅ Creates branch in worktree
✅ Symlinks node_modules (faster than yarn install)
✅ Implements task with WIP commits
✅ Returns to main worktree
✅ Squash merges into ONE clean commit
✅ Pushes to main (no PR needed)
✅ Cleans up worktree and branch

Benefits:
- Clean history: ONE commit per task
- Fast: No dependency installation, no PR review
- Work on multiple tasks in parallel
- No branch switching in main workspace
- Isolated test environments
- Keep main workspace clean
```

**When to use worktree:**
- Long-running tasks (M/L/XL size)
- Multiple tasks simultaneously
- Frequent context switching needed

---

### `/mark-task-as-done [N]`

**Mark a task as complete with commit hash (auto-detects from git if N not provided).**

```
In Claude Code:
> /mark-task-as-done

What Claude does:
✅ Auto-detects task number from recent git commit with "task #N"
✅ Gets current commit hash (short format)
✅ Updates task header with strikethrough and ✅ DONE
✅ Updates status table to DONE
✅ Adds completion metadata (date + commit hash)
✅ Shows success message with next steps

Or provide explicit task number:
> /mark-task-as-done 5

Claude:
✅ Task #5 marked as done!

📝 Task: Fix Cost Tracking Bug
📅 Completed: 2026-01-25
🔗 Commit: abc1234

💡 Next Steps:
- Commit: git add task-manager/tasks.md && git commit -m "docs: mark task #5 as done"
```

**When to use:**
- After merging a PR that completed a task
- To record which commit fixed the task
- When you forgot to mark task done during implementation
- To update completion info for already-done tasks

**Auto-detection:**
- Searches for "task #N" in recent commit messages
- Uses most recent commit if multiple found
- Falls back to asking for task number if not found

---

## 🚀 Quick Start Examples

### Example 1: Simple Bug Fix

```
You: /task-list
Claude: [Shows task list with priorities]

You: /start-task 1
Claude: [Implements Task 1, creates PR]

[After PR merges]
You: yarn task mark-done --task 1
```

### Example 2: Working on Multiple Tasks

```
You: /task-list
Claude: [Shows 3 high priority tasks]

You: /start-task-worktree 2
Claude: [Creates worktree, implements Task 2 in isolation]

You: /start-task 3
Claude: [Implements Task 3 in main workspace]

Now you have:
- Main workspace: Task 3 implementation
- Worktree: Task 2 implementation
```

### Example 3: Plan Before Implementing (Recommended for M/L/XL tasks)

```
You: /task-list
Claude: [Shows Task 17 is High priority, M size]

You: /plan-task 17
Claude: [Creates thorough plan with Plan agent]

✅ Plan created for Task #17!
📋 Plan saved to: task-manager/plans/task-17-plan.md

[You review and optionally edit the plan]

You: /start-task 17
Claude: 📋 Using existing plan: task-manager/plans/task-17-plan.md
[Implements following the plan's sub-tasks]
```

### Example 4: Review Before Implementing

```
You: /task-list
Claude: [Shows task list]

You: Show me details for task 5
Claude: [Displays task requirements]

You: /start-task 5
Claude: [Implements after you reviewed requirements]
```

---

## 📂 Implementation Details

### Where Are Slash Commands Defined?

Slash commands are markdown files in `.ai/commands/`:

```
.ai/commands/
├── add-task.md            (/add-task)
├── task-list.md           (/task-list)
├── plan-task.md           (/plan-task)
├── start-task.md          (/start-task)
├── start-task-worktree.md (/start-task-worktree)
└── mark-task-as-done.md   (/mark-task-as-done)
```

Each file contains:
- Description (shown in command help)
- Step-by-step process for Claude to follow
- Guidelines and best practices
- Checklists for quality assurance

### What Happens Behind the Scenes?

When you invoke `/start-task 1`:

1. **Task Loading**
   - Runs `yarn task work --task 1` to create branch
   - Reads task details from task-manager/tasks.md
   - Parses priority, size, complexity, implementation details

2. **Understanding Phase**
   - Reads task requirements
   - Reviews CLAUDE.md for guidelines
   - Explores files listed in "Files to Modify"

3. **Planning Phase**
   - Creates todo list for complex tasks
   - Breaks down into sub-tasks
   - Orders by dependencies

4. **Implementation Phase**
   - Implements following task specifications
   - Uses code examples from task
   - Follows project patterns

5. **Validation Phase**
   - Runs `yarn checks` (TypeScript + ESLint)
   - Fixes any errors
   - Re-runs until passing

6. **Review Phase**
   - Self-reviews implementation
   - Checks for edge cases
   - Verifies requirements met

7. **Commit Phase**
   - Commits with conventional commit format
   - Includes task number reference

8. **PR Phase**
   - Pushes to remote
   - Creates PR with `yarn github-pr create`
   - Links to task in description

9. **Summary Phase**
   - Reports what was done
   - Shows PR URL
   - Reminds to mark done after merge

---

## 🎓 Best Practices

### For Task Authors (When Writing task-manager/tasks.md)

**Good task structure:**
```markdown
## 1. Fix Cost Tracking Bug

| Priority | Complexity | Size |
|----------|------------|------|
| **Critical** | Low | XS |

**Summary:** Clear one-line description

**Current Bug Location:** Exact file and line number

**Code Example:**
```typescript
// CURRENT (broken):
logExecutionEnd(logCtx, {
    totalCost: 0,  // ← Should be from result.usage
});

// CORRECT:
logExecutionEnd(logCtx, {
    totalCost: result.usage?.totalCostUSD ?? 0,
});
```

**Files to Modify:**
- `src/path/to/file.ts` - Description of what to change
```

**Why this helps slash commands:**
- ✅ Clear requirements → Claude knows what to do
- ✅ Code examples → Claude knows how to do it
- ✅ File paths → Claude knows where to change
- ✅ Size estimate → Sets expectations

### For Task Implementors (When Using Slash Commands)

**Do:**
- ✅ Use `/task-list` to see priorities
- ✅ Start with highest priority tasks
- ✅ Review task details if unsure
- ✅ Let Claude handle the workflow
- ✅ Mark tasks done after PR merges

**Don't:**
- ❌ Skip validation checks
- ❌ Modify task scope mid-implementation
- ❌ Mark done before PR merges
- ❌ Work on same task in multiple places

---

## 🔧 Integration with Other Tools

### Works With GitHub PR Tool

```bash
# Slash command creates PR automatically
/start-task 1

# But you can also manage PR manually
yarn github-pr info --pr 123
yarn github-pr comment --pr 123 --message "LGTM"
yarn github-pr merge --pr 123 --method squash
```

### Works With Agent Tools

```bash
# If task involves agent implementation
/start-task 2

# Task might use agent tools internally
yarn agent:implement --issue 123
yarn agent:pr-review --pr 123
```

### Works With Template Sync

```bash
# After implementing tasks, sync to child projects
yarn sync-children
```

---

## 📊 Comparison Matrix

| Feature | `/start-task` | `yarn task work` | Manual Work |
|---------|---------------|------------------|-------------|
| Who codes | Claude | You | You |
| Branch creation | ✅ Auto | ✅ Auto | ❌ Manual |
| Code exploration | ✅ Auto | ❌ Manual | ❌ Manual |
| Implementation | ✅ Auto | ❌ Manual | ❌ Manual |
| Validation | ✅ Auto runs | ❌ You run | ❌ You run |
| PR creation | ✅ Auto | ❌ You create | ❌ You create |
| Speed | ⚡ Fast | 🐢 Slow | 🐢 Slow |
| Control | 🔒 Delegated | ✅ Full | ✅ Full |
| Best for | Clear tasks | Learning | Complex tasks |

---

## 🎯 When to Use What

### Use `/task-list`

**Always** - Start every session with this to see priorities

### Use `/plan-task`

When:
- ✅ Task is M, L, or XL size
- ✅ Task has significant unknowns
- ✅ You want a thorough codebase exploration first
- ✅ You want to review the plan before implementation
- ✅ Task touches multiple systems or files

Avoid when:
- ❌ Task is XS or S size (just use `/start-task`)
- ❌ Task is well-understood and straightforward
- ❌ You need implementation ASAP

### Use `/start-task`

When:
- ✅ Task has clear requirements in task-manager/tasks.md
- ✅ Task follows existing patterns
- ✅ You want automated implementation
- ✅ Task size is XS, S, or M
- ✅ You trust Claude to implement
- ✅ A plan already exists (from `/plan-task`)

Avoid when:
- ❌ Requirements are ambiguous
- ❌ Task needs creative problem-solving
- ❌ You're learning the codebase
- ❌ Task has security implications

### Use `/start-task-worktree`

When:
- ✅ Same as `/start-task` PLUS
- ✅ Working on multiple tasks
- ✅ Long-running task (M/L/XL)
- ✅ Need isolated environment
- ✅ Frequent task switching

Avoid when:
- ❌ Quick task (XS/S)
- ❌ Limited disk space
- ❌ Single task focus

---

## 🐛 Troubleshooting

### "Task not found"

```
Error: Task 99 not found

Solution: Run /task-list to see valid task numbers
```

### "yarn checks failed"

```
Claude should fix automatically, but if not:
1. Read error messages
2. Fix TypeScript errors first
3. Fix ESLint errors second
4. Ask Claude to fix: "Please fix the validation errors"
```

### "Worktree already exists"

```
The CLI automatically removes old worktrees.
If manual cleanup needed:
git worktree remove ../worktree-task-N --force
```

### "PR creation failed"

```
Check GITHUB_TOKEN is set:
1. Verify .env has GITHUB_TOKEN
2. Run: yarn verify-credentials
3. Retry PR creation
```

---

## 📚 Related Documentation

- **CLI Tools**: [task-manager/task-management-cli.md](task-management-cli.md)
- **Quick Reference**: [task-manager/TASK_COMMANDS.md](TASK_COMMANDS.md)
- **GitHub PR Tool**: [CLAUDE.md](../CLAUDE.md#github-pr-cli-tool)
- **Agent Integration**: [docs/github-projects-integration.md](../docs/github-projects-integration.md)

---

## 💡 Pro Tips

1. **Check task list daily**: `\task-list` shows what needs attention
2. **Batch similar tasks**: Use worktrees to work on multiple tasks
3. **Review before starting**: Read task details if you're unsure
4. **Trust the validation**: If `yarn checks` passes, implementation is likely correct
5. **Mark tasks done**: Always run `yarn task mark-done` after PR merges
6. **Use for routine work**: Slash commands excel at well-defined tasks
7. **Keep task-manager/tasks.md updated**: Good task descriptions = better implementations

---

## 🎉 Quick Win Example

**Scenario**: You have 30 minutes and want to knock out a quick bug fix.

```
You: /task-list
Claude: [Shows Task 1 is Critical, XS size]

You: /start-task 1
Claude: [Implements in 5 minutes]

You: [Reviews PR, merges]

You: yarn task mark-done --task 1

Total time: 10 minutes, task complete! ✅
```

Compare to manual:
1. Read task - 2 min
2. Create branch - 1 min
3. Explore code - 5 min
4. Implement - 10 min
5. Run checks - 1 min
6. Fix errors - 3 min
7. Commit - 1 min
8. Create PR - 2 min
Total: 25 minutes

**Slash commands save 60% of your time on routine tasks!**
