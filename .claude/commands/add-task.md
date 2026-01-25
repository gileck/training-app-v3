---
description: Add a new task to task-manager/tasks.md following the standardized format
---

# Add Task Command

Interactively create a new task in `task-manager/tasks.md` following the standardized format defined in `task-manager/TASK_FORMAT.md`.

## Usage

Invoke this command:
- `/add-task` - Start interactive task creation

## Process

---

## Step 1: Read Task Format Specification

- **Objective**: Understand the required task format
- **Actions**:
  - Read `task-manager/TASK_FORMAT.md` to understand the standardized format
  - Note required fields: Number, Title, Priority, Complexity, Size, Status, Date Added, Summary
  - Note optional fields: Date Updated, Details, Implementation Notes, Files to Modify, Dependencies, Risks/Blockers, Notes

---

## Step 2: Determine Next Task Number

- **Objective**: Get the next sequential task number
- **Actions**:
  - Read `task-manager/tasks.md`
  - Find the highest task number currently used
  - Next task number = highest + 1
  - Display: "Creating Task #{N}"

---

## Step 3: Gather Required Information

- **Objective**: Collect all required task details from the user
- **Actions**:
  - Use AskUserQuestion tool to gather task information

**Ask the user:**

1. **Title** (question 1):
   - Question: "What is the task title?"
   - Header: "Title"
   - Options:
     - Provide text input field
   - Example: "Add User Authentication", "Fix Login Bug", "Refactor Database Layer"

2. **Priority and Size** (question 2):
   - Question: "What is the priority and size of this task?"
   - Header: "Priority/Size"
   - Options:
     - "Critical / XS" - Urgent, < 1 hour
     - "Critical / S" - Urgent, 1-4 hours
     - "Critical / M" - Urgent, 4-8 hours
     - "High / S" - Important, 1-4 hours
     - "High / M" - Important, 4-8 hours
     - "High / L" - Important, 1-3 days
     - "Medium / S" - Should do, 1-4 hours
     - "Medium / M" - Should do, 4-8 hours
     - "Medium / L" - Should do, 1-3 days
     - "Low / M" - Nice to have, 4-8 hours
     - "Low / L" - Nice to have, 1-3 days

3. **Complexity** (question 3):
   - Question: "What is the complexity of this task?"
   - Header: "Complexity"
   - Options:
     - "Low" - Straightforward, well-understood, minimal unknowns
     - "Medium (Recommended)" - Some complexity, may require design decisions
     - "High" - Complex problem, significant unknowns, architectural impact

4. **Summary** (question 4):
   - Question: "Provide a one-sentence summary of what needs to be done:"
   - Header: "Summary"
   - Options:
     - Provide text input field
   - Example: "Add JWT-based authentication with persistent sessions"

---

## Step 4: Gather Optional Information

- **Objective**: Ask if user wants to add optional fields
- **Actions**:
  - Use AskUserQuestion tool with multiSelect enabled

**Ask the user:**

Question: "Which optional fields would you like to include?"
- Header: "Optional Fields"
- multiSelect: true
- Options:
  - "Details" - Extended description, problem statement, background
  - "Implementation Notes" - Technical approach, code snippets, API references
  - "Files to Modify" - Specific files that need changes
  - "Dependencies" - Tasks or features this depends on
  - "Risks/Blockers" - Known challenges or potential issues
  - "Notes" - Additional context or comments

**For each selected field, ask for the content:**

If "Details" selected:
- Question: "Provide detailed description, problem statement, or background:"
- Collect multi-line text

If "Implementation Notes" selected:
- Question: "Provide technical details, approach, or code examples:"
- Collect multi-line text

If "Files to Modify" selected:
- Question: "List files to modify (one per line, format: `path/file.ts - What to change`):"
- Collect multi-line text
- Parse into bulleted list

If "Dependencies" selected:
- Question: "List dependencies (e.g., 'Task #5 must be completed first', 'Requires MongoDB migration'):"
- Collect multi-line text
- Parse into bulleted list

If "Risks/Blockers" selected:
- Question: "List potential risks or blockers:"
- Collect multi-line text
- Parse into bulleted list

If "Notes" selected:
- Question: "Add any additional notes or context:"
- Collect multi-line text

---

## Step 5: Generate Task Markdown

- **Objective**: Create properly formatted task content
- **Actions**:
  - Use the gathered information to create task following TASK_FORMAT.md
  - Get today's date in YYYY-MM-DD format
  - Status is always "TODO" for new tasks

**Task Template:**

```markdown
## {N}. {Title}

| Priority | Complexity | Size | Status |
|----------|------------|------|--------|
| **{Priority}** | {Complexity} | {Size} | TODO |

**Date Added:** {YYYY-MM-DD}

**Summary:** {Summary}

{IF Details provided:}
**Details:**
{Details}

{IF Implementation Notes provided:}
**Implementation Notes:**
{Implementation Notes}

{IF Files to Modify provided:}
**Files to Modify:**
{Bulleted list of files}

{IF Dependencies provided:}
**Dependencies:**
{Bulleted list of dependencies}

{IF Risks/Blockers provided:}
**Risks/Blockers:**
{Bulleted list of risks}

{IF Notes provided:}
**Notes:**
{Notes}
```

---

## Step 6: Determine Insertion Point

- **Objective**: Find where to insert the task in tasks.md
- **Actions**:
  - Tasks are organized by priority: Critical → High → Medium → Low
  - Within each priority, tasks are ordered by date (oldest first)
  - Find the correct priority section
  - Insert at the end of that priority section (before the next priority section or before completed tasks)

**Priority Section Markers:**
- Look for tasks with matching priority
- Insert after the last task of that priority
- Before the "---" separator or before next priority section

---

## Step 7: Insert Task into tasks.md

- **Objective**: Add the task to the file
- **Actions**:
  - Read current tasks.md
  - Find insertion point based on priority
  - Insert the task with proper spacing (blank line before "---" separator)
  - Write updated tasks.md

**Format:**
```markdown
## {previous task content}

---

## {N}. {New Task Title}

{task content}

---

## {next task or next priority section}
```

---

## Step 8: Confirm and Display

- **Objective**: Verify task was added successfully
- **Actions**:
  - Read the newly added task from tasks.md to confirm
  - Display success message with task details
  - Show next steps

**Display:**
```
✅ Task #{N} added successfully!

📝 Task Details:
- Title: {Title}
- Priority: {Priority}
- Size: {Size}
- Complexity: {Complexity}

💡 Next Steps:
- Review the task in task-manager/tasks.md
- Use /task-list to see all tasks
- Use /start-task {N} to implement this task
```

---

## Quick Checklist

- [ ] Read TASK_FORMAT.md for format reference
- [ ] Determined next task number
- [ ] Gathered required fields (title, priority, size, complexity, summary)
- [ ] Gathered optional fields (if requested)
- [ ] Generated properly formatted task markdown
- [ ] Found correct insertion point by priority
- [ ] Inserted task into tasks.md
- [ ] Verified task was added successfully
- [ ] Displayed confirmation and next steps

---

## Example Interaction

**User:** `/add-task`

**Claude:** Creating a new task in tasks.md. Next task number will be #13.

*[Uses AskUserQuestion to gather info]*

**User provides:**
- Title: "Add Dark Mode Support"
- Priority/Size: "High / M"
- Complexity: "Medium"
- Summary: "Add dark mode theme toggle with persistent user preference"
- Optional fields: "Details", "Files to Modify"
- Details: "Users have requested dark mode for better viewing in low-light environments..."
- Files: "`src/client/features/settings/store.ts - Add theme preference`"

**Claude:**
```
✅ Task #13 added successfully!

📝 Task Details:
- Title: Add Dark Mode Support
- Priority: High
- Size: M
- Complexity: Medium

The task has been added to task-manager/tasks.md in the High priority section.

💡 Next Steps:
- Review the task in task-manager/tasks.md
- Use /task-list to see all tasks
- Use /start-task 13 to implement this task
```

---

## Notes

- Always follow TASK_FORMAT.md specification
- Date Added is automatically set to today
- Status is always "TODO" for new tasks
- Task number is automatically determined (highest + 1)
- Tasks are inserted in the correct priority section
- Use proper markdown formatting with tables and bold text
