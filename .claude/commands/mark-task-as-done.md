---
description: Mark a task as done in task-manager/tasks.md with commit hash
---

# Mark Task as Done Command

Mark a task as complete in `task-manager/tasks.md` with the commit hash that implemented it. If no task number is provided, automatically detects the last task that was worked on.

## Usage

Invoke this command:
- `/mark-task-as-done` - Mark the last worked task as done (auto-detect)
- `/mark-task-as-done 5` - Mark task 5 as done
- `/mark-task-as-done --task 3` - Mark task 3 as done

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

## Step 2: Get Current Commit Hash

- **Objective**: Capture the commit hash that implemented the task
- **Actions**:
  - Run: `git rev-parse --short HEAD`
  - This gets the short commit hash (7 characters)
  - Store as `COMMIT_HASH`

**Example output:** `abc1234`

---

## Step 3: Read Current Task Content

- **Objective**: Find and read the task to be marked
- **Actions**:
  - Read `task-manager/tasks.md`
  - Search for task header: `## {N}.` or `## ~~{N}.`
  - Verify task exists
  - Check if already marked as done (has `~~` strikethrough or `✅ DONE`)

**If task already done:**
- Display: "⚠️ Task #{N} is already marked as done"
- Ask user: "Update completion info anyway? (yes/no)"
- If no: exit
- If yes: continue to update

---

## Step 4: Get Completion Date

- **Objective**: Record when the task was completed
- **Actions**:
  - Get today's date in YYYY-MM-DD format
  - Store as `COMPLETION_DATE`

**Example:** `2026-01-25`

---

## Step 5: Update Task Header

- **Objective**: Mark task as complete with strikethrough and status
- **Actions**:
  - Update task header from:
    ```markdown
    ## {N}. {Title}
    ```

    To:
    ```markdown
    ## {N}. ~~{Title}~~ ✅ DONE
    ```

  - Update status table from:
    ```markdown
    | Priority | Complexity | Size | Status |
    |----------|------------|------|--------|
    | **{Priority}** | {Complexity} | {Size} | TODO |
    ```

    To:
    ```markdown
    | Priority | Complexity | Size | Status |
    |----------|------------|------|--------|
    | **{Priority}** | {Complexity} | {Size} | ✅ **DONE** |
    ```

---

## Step 6: Add Completion Metadata

- **Objective**: Add completion date and commit reference
- **Actions**:
  - Add completion blockquote after the status table:

```markdown
> **Completed:** {COMPLETION_DATE} - Fixed in commit `{COMMIT_HASH}`
```

**Example:**
```markdown
> **Completed:** 2026-01-25 - Fixed in commit `abc1234`
```

**If completion metadata already exists:**
- Replace the existing blockquote with new data
- Keep any additional notes that were added below

---

## Step 7: Write Updated Content

- **Objective**: Save the updated task to tasks.md
- **Actions**:
  - Use Edit tool to update the task in `task-manager/tasks.md`
  - Preserve all other task content (summary, details, etc.)
  - Ensure proper markdown formatting

---

## Step 8: Verify and Display

- **Objective**: Confirm the task was marked as done
- **Actions**:
  - Read back the updated task from tasks.md
  - Verify the changes were applied correctly
  - Display success message with details

**Display:**
```
✅ Task #{N} marked as done!

📝 Task: {Title}
📅 Completed: {COMPLETION_DATE}
🔗 Commit: {COMMIT_HASH}

The task has been updated in task-manager/tasks.md
```

---

## Step 9: Suggest Next Actions

- **Objective**: Guide user on what to do next
- **Actions**:
  - Display next steps based on context

**Display:**
```
💡 Next Steps:
- Review the change in task-manager/tasks.md
- Commit the change: git add task-manager/tasks.md && git commit -m "docs: mark task #{N} as done"
- Use /task-list to see remaining tasks
```

---

## Quick Checklist

- [ ] Task number determined (provided or auto-detected)
- [ ] Current commit hash retrieved
- [ ] Task found in tasks.md and verified
- [ ] Completion date obtained
- [ ] Task header updated with strikethrough and ✅ DONE
- [ ] Status table updated to DONE
- [ ] Completion metadata added with date and commit
- [ ] Changes written to tasks.md
- [ ] Verification successful
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

✅ Task #5 marked as done!

📝 Task: Fix Cost Tracking Bug in Implementation Agent
📅 Completed: 2026-01-25
🔗 Commit: abc1234

💡 Next Steps:
- Review the change in task-manager/tasks.md
- Commit: git add task-manager/tasks.md && git commit -m "docs: mark task #5 as done"
```

### Example 2: Explicit task number

**User:** `/mark-task-as-done 3`

**Claude:**
```
Marking Task #3 as done...

✅ Task #3 marked as done!

📝 Task: Add Admin Approval Gate
📅 Completed: 2026-01-25
🔗 Commit: def5678

💡 Next Steps:
- Review the change in task-manager/tasks.md
- Commit: git add task-manager/tasks.md && git commit -m "docs: mark task #3 as done"
```

### Example 3: Task already done

**User:** `/mark-task-as-done 2`

**Claude:**
```
⚠️ Task #2 is already marked as done (completed on 2026-01-24).

Would you like to update the completion info anyway?
```

**User:** `yes`

**Claude:**
```
Updating Task #2 completion info...

✅ Task #2 updated!

📝 Task: Debug PR Reviewer + Claude Integration
📅 Completed: 2026-01-25 (previously: 2026-01-24)
🔗 Commit: xyz9012 (previously: dc3fb4c)
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
- **Already done** tasks can be updated with new completion info
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

If the specified task number doesn't exist in tasks.md:
- Display error: "❌ Task #{N} not found in task-manager/tasks.md"
- Suggest running `/task-list` to see available tasks

### Invalid Task Number

If user provides non-numeric task number:
- Display error: "❌ Invalid task number. Please provide a number (e.g., /mark-task-as-done 5)"

---

## Implementation Considerations

This command should:
1. Parse task number from user input or git history
2. Validate task exists in tasks.md
3. Update task with proper markdown formatting
4. Preserve all existing task content
5. Show clear success/error messages
6. Guide user on next steps (commit the change)
