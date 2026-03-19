---
description: Add a new task using the task management library (creates task-manager/tasks/task-N.md)
---

# Add Task Command

Interactively create a new task using the centralized task library. The task will be saved as an individual file in `task-manager/tasks/` and the summary index will be automatically updated.

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
  - Use CLI command: `yarn task list` to see current tasks
  - Or read from task library to get next available number
  - The library will automatically assign the next number (highest + 1)
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
- Parse into array of strings

If "Dependencies" selected:
- Question: "List dependencies (e.g., 'Task #5 must be completed first', 'Requires MongoDB migration'):"
- Collect multi-line text
- Parse into array of strings

If "Risks/Blockers" selected:
- Question: "List potential risks or blockers:"
- Collect multi-line text
- Parse into array of strings

If "Notes" selected:
- Question: "Add any additional notes or context:"
- Collect multi-line text

---

## Step 5: Create Task Using Library

- **Objective**: Create the task using the task management library
- **Actions**:
  - Import the task library: `import { createTask } from './task-manager/lib/index'`
  - Prepare task object with gathered data
  - Call `createTask()` which will:
    - Assign the next task number automatically
    - Create `task-manager/tasks/task-N.md` with YAML frontmatter
    - Rebuild `task-manager/tasks.md` summary index automatically
  - Get today's date in YYYY-MM-DD format
  - Status is automatically set to "TODO" for new tasks

**Task Object Structure:**

```typescript
const newTask = {
    title: "gathered title",
    priority: "High", // or Critical, Medium, Low
    complexity: "Medium", // or Low, High
    size: "M", // or XS, S, L, XL
    status: "TODO",
    dateAdded: "2026-01-27", // today's date
    summary: "gathered summary",
    // Optional fields:
    details: "gathered details" || undefined,
    implementationNotes: "gathered implementation notes" || undefined,
    filesToModify: ["file1.ts", "file2.ts"] || undefined,
    dependencies: ["Task #5", "MongoDB migration"] || undefined,
    risks: ["Risk 1", "Risk 2"] || undefined,
    notes: "gathered notes" || undefined,
};

const createdTask = createTask(newTask);
// Returns: Task object with assigned number
```

**Library automatically:**
- Assigns next task number (highest + 1)
- Creates `task-manager/tasks/task-{N}.md` with YAML frontmatter
- Regenerates `task-manager/tasks.md` summary index

---

## Step 6: Confirm and Display

- **Objective**: Verify task was added successfully
- **Actions**:
  - Read the newly created task file to confirm
  - Display success message with task details
  - Show file location and next steps

**Display:**
```
✅ Task #{N} added successfully!

📝 Task Details:
- Title: {Title}
- Priority: {Priority}
- Size: {Size}
- Complexity: {Complexity}
- File: task-manager/tasks/task-{N}.md

💡 Next Steps:
- View task: yarn task view --task {N}
- List all tasks: yarn task list
- Start implementation: yarn task work --task {N}
- Summary index auto-updated: task-manager/tasks.md
```

---

## Quick Checklist

- [ ] Read TASK_FORMAT.md for format reference
- [ ] Library will determine next task number automatically
- [ ] Gathered required fields (title, priority, size, complexity, summary)
- [ ] Gathered optional fields (if requested)
- [ ] Called createTask() from library
- [ ] Library created task-manager/tasks/task-N.md
- [ ] Library auto-rebuilt task-manager/tasks.md summary
- [ ] Verified task was added successfully
- [ ] Displayed confirmation and next steps

---

## Example Interaction

**User:** `/add-task`

**Claude:** Creating a new task. The task library will assign the next available task number.

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
✅ Task #21 added successfully!

📝 Task Details:
- Title: Add Dark Mode Support
- Priority: High
- Size: M
- Complexity: Medium
- File: task-manager/tasks/task-21.md

The task has been saved and the summary index has been automatically updated.

💡 Next Steps:
- View task: yarn task view --task 21
- List all tasks: yarn task list
- Start implementation: yarn task work --task 21
```

---

## Notes

- Task library handles all file operations automatically
- No need to manually insert into tasks.md - it's auto-generated
- Task number is automatically assigned (highest + 1)
- Summary index (tasks.md) is automatically rebuilt
- Individual task file uses YAML frontmatter for metadata
- Use `yarn task view --task N` to see full task details
- Use `yarn task list` to see all tasks organized by priority/status
