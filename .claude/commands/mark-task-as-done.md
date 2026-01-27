---
description: Mark a task as done in task-manager/tasks.md with commit hash
---

# Mark Task as Done Command

Mark a task as complete using the task management CLI. Tasks are stored as individual files in `task-manager/tasks/` with a summary index in `task-manager/tasks.md`.

## Usage

Invoke this command:
- `/mark-task-as-done` - Mark the last worked task as done (auto-detect)
- `/mark-task-as-done 9` - Mark task 9 as done
- `/mark-task-as-done --task 9` - Mark task 9 as done

## Process

---

## Step 1: Determine Task Number

- **Objective**: Get the task number to mark as done
- **Actions**:
  - If user provided task number: use that number
  - If NO task number provided: auto-detect from git history

**Auto-detection method:**
1. Run: `git log --oneline --grep="task #" -1`
   - Gets the most recent commit mentioning a task number
2. Extract task number from commit message using regex: `task #(\d+)`
3. If no task found in recent commits: ask user to specify task number

**Display:**
```
🔍 Auto-detected Task #5 from recent commit:
   abc1234 fix: description (task #5)

Marking Task #5 as done...
```

---

## Step 2: Use CLI to Mark Task as Done

- **Objective**: Mark the task as done using the official CLI
- **Actions**:
  - Run: `yarn task mark-done --task {N}`
  - The CLI will:
    - Update the individual task file: `task-manager/tasks/task-{N}.md`
    - Set `status: Done`
    - Add `dateCompleted: YYYY-MM-DD`
    - Rebuild the summary index in `task-manager/tasks.md`

**Example command:**
```bash
yarn task mark-done --task 9
```

---

## Step 3: Add Completion Commit Hash (Optional)

- **Objective**: Add the commit hash that implemented the task
- **Actions**:
  - Run: `git rev-parse --short HEAD` to get current commit hash
  - Read the individual task file: `task-manager/tasks/task-{N}.md`
  - Add `completionCommit: {HASH}` to the frontmatter (YAML section)
  - Run: `yarn task rebuild-index` to update the summary

**IMPORTANT:** The field name is `completionCommit`, not `commitHash`.

**Example task frontmatter:**
```yaml
---
number: 9
title: Workflow Review Slash Command
priority: Medium
size: M
complexity: Mid
status: Done
dateAdded: 2026-01-27
dateUpdated: 2026-01-27
dateCompleted: 2026-01-27
completionCommit: edc9a7f
---
```

---

## Step 4: Verify and Display

- **Objective**: Confirm the task was marked as done
- **Actions**:
  - Run: `yarn task list` to verify task is in completed section
  - Verify the commit hash appears in the summary table
  - Display success message with details

**Display:**
```
✅ Task #{N} marked as done!

📝 Task: {Title}
📅 Completed: {COMPLETION_DATE}
🔗 Commit: {COMMIT_HASH}

The task has been updated in:
- Individual task file: task-manager/tasks/task-{N}.md
- Summary index: task-manager/tasks.md
```

---

## Step 5: Suggest Next Actions

- **Objective**: Guide user on what to do next
- **Actions**:
  - Display next steps based on context

**Display:**
```
💡 Next Steps:
- Review the changes in task-manager/
- Commit the changes:
  git add task-manager/
  git commit -m "docs: mark task #{N} as done"
- Use yarn task list to see remaining tasks
```

---

## Quick Checklist

- [ ] Task number determined (provided or auto-detected)
- [ ] Run `yarn task mark-done --task {N}` to mark task as done
- [ ] Get current commit hash with `git rev-parse --short HEAD`
- [ ] Edit task file `task-manager/tasks/task-{N}.md` to add `completionCommit` field
- [ ] Run `yarn task rebuild-index` to update summary
- [ ] Verification successful (task appears in completed section)
- [ ] User notified with success message

---

## Example Interactions

### Example 1: Auto-detect from git history

**User:** `/mark-task-as-done`

**Claude:**
```
🔍 Auto-detected Task #5 from recent commit:
   abc1234 fix: correct cost tracking in implementation agent (task #5)

Marking Task #5 as done...
[runs: yarn task mark-done --task 5]
[runs: git rev-parse --short HEAD]
[edits: task-manager/tasks/task-5.md to add completionCommit: abc1234]
[runs: yarn task rebuild-index]

✅ Task #5 marked as done!

📝 Task: Fix Cost Tracking Bug in Implementation Agent
📅 Completed: 2026-01-25
🔗 Commit: abc1234

💡 Next Steps:
- Review the changes in task-manager/
- Commit: git add task-manager/ && git commit -m "docs: mark task #5 as done"
```

### Example 2: Explicit task number

**User:** `/mark-task-as-done 9`

**Claude:**
```
Marking Task #9 as done...
[runs: yarn task mark-done --task 9]
[runs: git rev-parse --short HEAD]
[edits: task-manager/tasks/task-9.md to add completionCommit: edc9a7f]
[runs: yarn task rebuild-index]

✅ Task #9 marked as done!

📝 Task: Workflow Review Slash Command
📅 Completed: 2026-01-27
🔗 Commit: edc9a7f

The task has been updated in:
- Individual task file: task-manager/tasks/task-9.md
- Summary index: task-manager/tasks.md

💡 Next Steps:
- Review the changes in task-manager/
- Commit: git add task-manager/ && git commit -m "docs: mark task #9 as done"
```

### Example 4: No task found in git history

**User:** `/mark-task-as-done`

**Claude:**
```
❌ Could not auto-detect task number from recent commits.

Please specify the task number:
  /mark-task-as-done 5

Or check recent commits with: git log --oneline --grep="task #"
```

---

## Notes

- **Auto-detection** looks for "task #N" pattern in commit messages
- **Short hash** (7 chars) is used for readability
- **Completion date** is set to today, not the commit date
- **Field name** is `completionCommit` in the YAML frontmatter, NOT `commitHash`
- **CLI handles most work** - `yarn task mark-done` updates status and dates
- **Manual step required** - adding the commit hash to frontmatter
- **Always rebuild** - run `yarn task rebuild-index` after manual edits
- **Commit message** suggestion uses consistent format: `docs: mark task #N as done`

---

## Git Pattern Detection

The auto-detection searches for these patterns in commit messages:
- `task #5`
- `task#5`
- `Task #5`
- `(task #5)`

**Search command:**
```bash
git log --oneline --grep="task #" --grep="task#" --grep="Task #" -i -1
```

---

## Edge Cases

### Multiple Tasks in One Commit

If a commit mentions multiple tasks (e.g., "fix task #3 and task #5"):
- Auto-detection picks the FIRST task number found
- User should explicitly specify which task to mark if this isn't correct

### Task Not Found

If the specified task number doesn't exist:
- The CLI will display an error: "❌ Task #{N} not found"
- Display error: "❌ Task #{N} not found in task-manager/tasks/"
- Suggest running `yarn task list` to see available tasks

### Invalid Task Number

If user provides non-numeric task number:
- Display error: "❌ Invalid task number. Please provide a number (e.g., /mark-task-as-done 5)"

---

## Implementation Considerations

This command should:
1. Parse task number from user input or git history
2. Use the CLI command `yarn task mark-done --task {N}` to mark the task
3. Get current commit hash with `git rev-parse --short HEAD`
4. Edit the individual task file to add the `completionCommit` field (NOT `commitHash`)
5. Run `yarn task rebuild-index` to update the summary file
6. Verify the task appears in the completed section
7. Show clear success/error messages
8. Guide user on next steps (commit all changes in task-manager/)

**Key Points:**
- Tasks are stored as individual files in `task-manager/tasks/task-{N}.md`
- The summary file `task-manager/tasks.md` is auto-generated - don't edit manually
- Use `completionCommit` field name in YAML frontmatter, not `commitHash`
- Always run `yarn task rebuild-index` after editing task files manually
- Commit both the individual task file and the summary file
