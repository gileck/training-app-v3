---
description: List all tasks using the task management library (organized by priority)
---

# Task List Command

Display all available tasks from `task-manager/tasks.md` organized by priority.

## CRITICAL FORMATTING RULE

**YOU MUST USE NUMBERED LISTS WITH ACTUAL NUMBERS (1., 2., 3., etc.)**

❌ WRONG: `a.`, `b.`, `c.`, `d.` (letters)
❌ WRONG: `-`, `•`, `*` (bullets)
✅ CORRECT: `1.`, `2.`, `3.`, `4.` (numbers)

This applies to BOTH active tasks AND completed tasks.

## Process

### Step 1: Read Tasks File
- **Objective**: Load tasks from task-manager/tasks.md
- **Actions**:
  - Read the `task-manager/tasks.md` file from the project root
  - Parse all tasks with their metadata (number, title, priority, size, complexity)

### Step 2: Separate Active and Completed Tasks
- **Objective**: Distinguish between tasks to work on and completed tasks
- **Actions**:
  - Identify tasks marked as DONE (have "## ~~N. Title~~" or status indicating completion)
  - Keep active (not done) tasks in the main list
  - Save completed tasks for display at the bottom

### Step 3: Organize Active Tasks by Priority
- **Objective**: Group active tasks for easy decision-making
- **Actions**:
  - Group active tasks by priority: Critical → High → Medium → Low
  - Within each priority, maintain task order by number
  - Only include tasks that are NOT marked as done

### Step 4: Display Active Task List
- **Objective**: Present active tasks in a clear, actionable format
- **Actions**:
  - Show active tasks grouped by priority with visual indicators
  - **ALWAYS use numbered lists with actual numbers** (e.g., "1.", "2.", "3." - NOT letters like "a.", "b.", "c.")
  - Display task number, title, and size for each task
  - Use emojis for priority levels:
    - 🔴 Critical
    - 🟠 High
    - 🟡 Medium
    - 🟢 Low

### Step 5: Display Completed Tasks
- **Objective**: Show completed tasks for reference without cluttering main list
- **Actions**:
  - Add a separator (e.g., "---")
  - Show section header: "✅ Completed Tasks"
  - **ALWAYS use numbered lists with actual numbers** (1., 2., 3. - NOT letters) with strikethrough formatting
  - Include task number, title, and size

### Step 6: Recommend Next Task
- **Objective**: Help user prioritize work
- **Actions**:
  - Identify the highest priority active task (not marked as done)
  - Suggest it as the next task to work on
  - Mention the size estimate to set expectations

## Example Output Format

**IMPORTANT: Use the TASK NUMBER as the list number (not separate numbering)**

```
📋 Active Tasks by Priority

🔴 Critical:
2. Debug PR Reviewer + Claude Integration (S)

🟠 High:
4. Add Agent Retry Logic for Transient Failures (M)
5. Add Stale Item Detection Workflow (M)

🟡 Medium:
6. Improve Error Messages in Tech Design Agent (S)
7. Add Notification System for Agent Events (M)

🟢 Low:
10. Add Cost Budgeting and Alerts (M)

---

✅ Completed Tasks:
1. ~~Fix Cost Tracking Bug in Implementation Agent (XS)~~ - commit abc123
3. ~~Add "Ready to Merge" Status with Admin Approval Gate (M)~~ - commit def456
8. ~~Update Documentation for GitHub Projects Setup (S)~~ - commit ghi789

💡 Recommended: Start with Task 2 (Critical, S size)
```

**The task number IS the list number. Do NOT add separate numbering.**

## Quick Checklist

- [ ] Tasks file read successfully
- [ ] Active and completed tasks separated
- [ ] Active tasks organized by priority
- [ ] Active task list displayed clearly
- [ ] Completed tasks shown at bottom
- [ ] Recommendation provided
