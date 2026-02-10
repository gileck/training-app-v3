---
number: 20
title: "Refactor Task Management: Split tasks.md into Individual Task Files"
priority: Medium
size: M
complexity: Medium
status: Done
dateAdded: 2026-01-27
dateUpdated: 2026-01-27
dateCompleted: 2026-01-27
completionCommit: 3997cc7
---

# Task 20: Refactor Task Management: Split tasks.md into Individual Task Files

**Summary:** Reorganize task management by splitting the monolithic tasks.md into individual task files (one per task) in a tasks/ folder, with a summary tasks.md listing all tasks with minimal required information.

## Files to Modify

- `task-manager/tasks.md` - Convert to task index/list with links to individual files
- `task-manager/tasks/` - Create new folder for individual task files (new folder)
- `task-manager/tasks/task-{N}.md` - Individual task files (new files for each task)
- `task-manager/TASK_FORMAT.md` - Update to reflect new structure
- `scripts/migrate-tasks.ts` - Create migration script to split existing tasks (new file)
- Any scripts that read tasks.md - Update to handle new structure

## Notes

- New structure allows easier editing, linking, and version control per task
- Summary tasks.md should show: task number, title, priority, size, status (table format)
- Each task-{N}.md contains full task details (current format)
- Maintain backward compatibility during migration
- Update /add-task, /start-task, and /task-list skills to work with new structure

---
