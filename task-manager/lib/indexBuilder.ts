/**
 * Index Builder - Generate Auto-Generated Summary Index
 *
 * Builds the tasks.md summary index from individual task files.
 * This file is auto-generated and should not be manually edited.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Task, TaskIndex, TaskPriority } from './types';
import { getAllTasks } from './taskReader';

const TASK_MANAGER_DIR = path.join(process.cwd(), 'task-manager');
const TASKS_FILE = path.join(TASK_MANAGER_DIR, 'tasks.md');

/**
 * Build task index from all tasks
 * @returns TaskIndex with organized task data
 */
export function buildIndex(): TaskIndex {
    const tasks = getAllTasks();
    const tasksMap = new Map(tasks.map(t => [t.number, t]));

    // Group by status
    const byStatus = {
        open: tasks.filter(t => t.status === 'TODO'),
        inProgress: tasks.filter(t => t.status === 'In Progress'),
        blocked: tasks.filter(t => t.status === 'Blocked'),
        done: tasks.filter(t => t.status === 'Done'),
    };

    // Group by priority
    const byPriority = {
        Critical: tasks.filter(t => t.priority === 'Critical'),
        High: tasks.filter(t => t.priority === 'High'),
        Medium: tasks.filter(t => t.priority === 'Medium'),
        Low: tasks.filter(t => t.priority === 'Low'),
    };

    return {
        tasks: tasksMap,
        byStatus,
        byPriority,
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Generate markdown content for tasks.md summary index
 * @returns Markdown string
 */
export function generateIndexMarkdown(): string {
    const index = buildIndex();
    const lines: string[] = [];

    // Header
    lines.push('# Tasks');
    lines.push('');
    lines.push('> **Note:** This file is auto-generated from individual task files in `tasks/`. Do not edit manually.');
    lines.push('> To modify tasks, edit the individual files in `tasks/task-N.md` or use the CLI: `yarn task --help`');
    lines.push('');
    lines.push('---');
    lines.push('');

    // Summary stats
    const totalTasks = index.tasks.size;
    const openCount = index.byStatus.open.length;
    const inProgressCount = index.byStatus.inProgress.length;
    const blockedCount = index.byStatus.blocked.length;
    const doneCount = index.byStatus.done.length;

    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Tasks:** ${totalTasks}`);
    lines.push(`- **Open:** ${openCount}`);
    lines.push(`- **In Progress:** ${inProgressCount}`);
    if (blockedCount > 0) {
        lines.push(`- **Blocked:** ${blockedCount}`);
    }
    lines.push(`- **Done:** ${doneCount}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Open Tasks (grouped by priority)
    if (openCount > 0) {
        lines.push(`## 📋 Open Tasks (${openCount})`);
        lines.push('');

        const priorityOrder: TaskPriority[] = ['Critical', 'High', 'Medium', 'Low'];
        const priorityEmoji: Record<TaskPriority, string> = {
            Critical: '🔴',
            High: '🟠',
            Medium: '🟡',
            Low: '🟢',
        };

        for (const priority of priorityOrder) {
            const tasksInPriority = index.byStatus.open.filter(t => t.priority === priority);
            if (tasksInPriority.length === 0) continue;

            lines.push(`### ${priorityEmoji[priority]} ${priority} Priority`);
            lines.push('');
            lines.push('| # | Title | Size | Complexity |');
            lines.push('|---|-------|------|------------|');

            for (const task of tasksInPriority) {
                lines.push(`| ${task.number} | ${task.title} | ${task.size} | ${task.complexity} |`);
            }
            lines.push('');
        }
    }

    // In Progress Tasks
    if (inProgressCount > 0) {
        lines.push(`## 🔄 In Progress (${inProgressCount})`);
        lines.push('');
        lines.push('| # | Title | Size | Priority |');
        lines.push('|---|-------|------|----------|');

        // Sort by task number descending (most recent first)
        const sorted = [...index.byStatus.inProgress].sort((a, b) => b.number - a.number);
        for (const task of sorted) {
            lines.push(`| ${task.number} | ${task.title} | ${task.size} | **${task.priority}** |`);
        }
        lines.push('');
    }

    // Blocked Tasks
    if (blockedCount > 0) {
        lines.push(`## 🚫 Blocked (${blockedCount})`);
        lines.push('');
        lines.push('| # | Title | Size | Priority |');
        lines.push('|---|-------|------|----------|');

        // Sort by task number descending
        const sorted = [...index.byStatus.blocked].sort((a, b) => b.number - a.number);
        for (const task of sorted) {
            lines.push(`| ${task.number} | ${task.title} | ${task.size} | **${task.priority}** |`);
        }
        lines.push('');
    }

    // Done Tasks
    if (doneCount > 0) {
        lines.push(`## ✅ Completed Tasks (${doneCount})`);
        lines.push('');
        lines.push('| # | Title | Completed | Commit |');
        lines.push('|---|-------|-----------|--------|');

        // Sort by task number descending (most recent first)
        const sorted = [...index.byStatus.done].sort((a, b) => b.number - a.number);
        for (const task of sorted) {
            const completedDate = task.dateCompleted || 'Unknown';
            const commit = task.completionCommit ? `\`${task.completionCommit}\`` : '-';
            lines.push(`| ${task.number} | ~~${task.title}~~ | ${completedDate} | ${commit} |`);
        }
        lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(`*Last updated: ${new Date().toISOString().split('T')[0]}*`);
    lines.push('');

    return lines.join('\n');
}

/**
 * Rebuild tasks.md from individual task files
 * This should be called after any task modification
 */
export function rebuildTasksFile(): void {
    const content = generateIndexMarkdown();
    fs.writeFileSync(TASKS_FILE, content, 'utf-8');
}
