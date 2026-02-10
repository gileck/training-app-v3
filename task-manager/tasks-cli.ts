#!/usr/bin/env npx tsx
import '../src/agents/shared/loadEnv';

/**
 * Tasks Management CLI
 *
 * A CLI tool for managing tasks using the centralized task library.
 *
 * Usage:
 *   yarn task <command> [options]
 *
 * Commands:
 *   list [filter]       List tasks (filter: open, in-progress, blocked, done, all)
 *                       Options:
 *                         --sortBy <type>  Sort by: priority, date, or number
 *                         --groupBy <type> Group by: status, priority, or date
 *   view                View a specific task
 *   work                Work on a specific task
 *   worktree            Create worktree and work on task
 *   plan                Plan implementation for a task
 *   mark-in-progress    Mark task as in progress
 *   mark-done           Mark task as completed
 *   migrate             Migrate from legacy to new format
 *   rebuild-index       Rebuild tasks.md summary index
 *
 * Examples:
 *   yarn task list                      # All tasks grouped by status
 *   yarn task list open                 # Only open tasks
 *   yarn task list --sortBy date        # Sort by date added (newest first)
 *   yarn task list --groupBy date       # Group by date added
 *   yarn task view --task 1             # View task details
 *   yarn task work --task 1
 *   yarn task worktree --task 3
 *   yarn task migrate --dry-run         # Preview migration
 *   yarn task migrate                   # Execute migration
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Import task library
import {
    Task,
    TaskPriority,
    getAllTasks,
    getTask,
    getTasksByStatus,
    markTaskInProgress as libMarkTaskInProgress,
    markTaskDone as libMarkTaskDone,
    detectFormat,
    writeTaskFile,
    rebuildTasksFile,
    clearCache,
} from './lib/index';

// ============================================================================
// Helper Functions
// ============================================================================

const priorityEmoji: Record<TaskPriority, string> = {
    Critical: '🔴',
    High: '🟠',
    Medium: '🟡',
    Low: '🟢',
};

/**
 * Convert library status to CLI-friendly status
 */
function normalizeStatus(status: Task['status']): string {
    if (status === 'TODO') return 'Open';
    return status;
}

/**
 * Get task or exit with error
 */
function getTaskOrExit(taskNumber: number): Task {
    const task = getTask(taskNumber);
    if (!task) {
        console.error(`❌ Task ${taskNumber} not found`);
        process.exit(1);
    }
    return task;
}

// ============================================================================
// Commands
// ============================================================================

type SortBy = 'priority' | 'date' | 'number';
type GroupBy = 'status' | 'priority' | 'date';

interface ListOptions {
    filter?: 'open' | 'in-progress' | 'blocked' | 'done' | 'all';
    sortBy?: SortBy;
    groupBy?: GroupBy;
}

/**
 * Format date string for display (YYYY-MM-DD)
 */
function formatDate(dateStr: string): string {
    return dateStr.split('T')[0];
}

/**
 * Get date grouping key (just the date part)
 */
function getDateKey(dateStr: string): string {
    return formatDate(dateStr);
}

/**
 * Sort tasks by date (newest first)
 */
function sortByDate(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
        const dateA = new Date(a.dateAdded).getTime();
        const dateB = new Date(b.dateAdded).getTime();
        return dateB - dateA; // newest first
    });
}

/**
 * Group tasks by date added
 */
function groupByDate(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();
    const sorted = sortByDate(tasks);

    for (const task of sorted) {
        const dateKey = getDateKey(task.dateAdded);
        if (!groups.has(dateKey)) {
            groups.set(dateKey, []);
        }
        groups.get(dateKey)!.push(task);
    }

    return groups;
}

function listTasks(options: ListOptions = {}) {
    const { filter, sortBy = 'priority', groupBy = 'status' } = options;
    const allTasks = getAllTasks();
    const priorityOrder: TaskPriority[] = ['Critical', 'High', 'Medium', 'Low'];

    // Group tasks by status
    const openTasks = allTasks.filter(t => t.status === 'TODO');
    const inProgressTasks = allTasks.filter(t => t.status === 'In Progress');
    const blockedTasks = allTasks.filter(t => t.status === 'Blocked');
    const doneTasks = allTasks.filter(t => t.status === 'Done');

    // Helper to print a single task
    const printTask = (task: Task, indent = '  ') => {
        console.log(`${indent}${task.number}. ${task.title} (${task.size})`);
    };

    // Helper to print tasks grouped by priority
    const printTasksByPriority = (taskList: Task[], indent = '  ') => {
        priorityOrder.forEach((priority) => {
            const tasksInPriority = taskList.filter((t) => t.priority === priority);
            if (tasksInPriority.length === 0) return;

            console.log(`\n${indent}${priorityEmoji[priority]} ${priority}:`);
            tasksInPriority.forEach((task) => {
                console.log(`${indent}  ${task.number}. ${task.title} (${task.size})`);
            });
        });
    };

    // Helper to print tasks sorted by number descending
    const printTasksByNumber = (taskList: Task[], indent = '  ') => {
        const sorted = [...taskList].sort((a, b) => b.number - a.number);
        sorted.forEach((task) => {
            printTask(task, indent);
        });
    };

    // Helper to print tasks sorted by date (newest first)
    const printTasksByDate = (taskList: Task[], indent = '  ') => {
        const sorted = sortByDate(taskList);
        sorted.forEach((task) => {
            printTask(task, indent);
        });
    };

    // Helper to print tasks grouped by date
    const printTasksGroupedByDate = (taskList: Task[], indent = '  ') => {
        const groups = groupByDate(taskList);
        for (const [dateKey, tasks] of groups) {
            console.log(`\n${indent}📅 ${dateKey}:`);
            tasks.forEach((task) => {
                console.log(`${indent}  ${task.number}. ${task.title} (${task.size})`);
            });
        }
    };

    // Choose the appropriate print function based on sortBy/groupBy
    const getPrintFunction = () => {
        if (groupBy === 'date') return printTasksGroupedByDate;
        if (groupBy === 'priority') return printTasksByPriority;
        if (sortBy === 'date') return printTasksByDate;
        return printTasksByNumber;
    };

    const printFn = getPrintFunction();

    // Print based on filter
    if (filter === 'open') {
        console.log('\n📋 Open Tasks\n');
        if (openTasks.length === 0) {
            console.log('  No open tasks');
        } else {
            printFn(openTasks);
        }
    } else if (filter === 'in-progress') {
        console.log('\n🔄 In Progress Tasks\n');
        if (inProgressTasks.length === 0) {
            console.log('  No tasks in progress');
        } else {
            printFn(inProgressTasks);
        }
    } else if (filter === 'blocked') {
        console.log('\n🚫 Blocked Tasks\n');
        if (blockedTasks.length === 0) {
            console.log('  No blocked tasks');
        } else {
            printFn(blockedTasks);
        }
    } else if (filter === 'done') {
        console.log('\n✅ Done Tasks\n');
        if (doneTasks.length === 0) {
            console.log('  No completed tasks');
        } else {
            printFn(doneTasks);
        }
    } else {
        // Show all, separated by status
        console.log('\n📋 Tasks\n');

        // For groupBy=date, we show all tasks grouped by date regardless of status
        if (groupBy === 'date') {
            printTasksGroupedByDate(allTasks);
        } else {
            if (openTasks.length > 0) {
                console.log('━━━ 📋 Open ━━━');
                printFn(openTasks);
            }

            if (inProgressTasks.length > 0) {
                console.log('\n━━━ 🔄 In Progress ━━━\n');
                printFn(inProgressTasks);
            }

            if (blockedTasks.length > 0) {
                console.log('\n━━━ 🚫 Blocked ━━━\n');
                printFn(blockedTasks);
            }

            if (doneTasks.length > 0) {
                console.log('\n━━━ ✅ Done ━━━\n');
                printFn(doneTasks);
            }
        }
    }

    console.log('');
}

function viewTask(taskNumber: number) {
    const task = getTaskOrExit(taskNumber);

    console.log(`\n# Task ${task.number}: ${task.title}\n`);
    console.log(`**Status:** ${normalizeStatus(task.status)}`);
    console.log(`**Priority:** ${task.priority}`);
    console.log(`**Size:** ${task.size}`);
    console.log(`**Complexity:** ${task.complexity}`);
    console.log(`**Added:** ${task.dateAdded}`);
    if (task.dateCompleted) {
        console.log(`**Completed:** ${task.dateCompleted}`);
        if (task.completionCommit) {
            console.log(`**Commit:** \`${task.completionCommit}\``);
        }
    }
    console.log('');
    console.log(`**Summary:** ${task.summary}`);

    if (task.details) {
        console.log('\n## Details\n');
        console.log(task.details);
    }

    if (task.implementationNotes) {
        console.log('\n## Implementation Notes\n');
        console.log(task.implementationNotes);
    }

    if (task.filesToModify && task.filesToModify.length > 0) {
        console.log('\n## Files to Modify\n');
        task.filesToModify.forEach(file => console.log(`- ${file}`));
    }

    if (task.dependencies && task.dependencies.length > 0) {
        console.log('\n## Dependencies\n');
        task.dependencies.forEach(dep => console.log(`- ${dep}`));
    }

    if (task.risks && task.risks.length > 0) {
        console.log('\n## Risks\n');
        task.risks.forEach(risk => console.log(`- ${risk}`));
    }

    if (task.notes) {
        console.log('\n## Notes\n');
        console.log(task.notes);
    }

    console.log('');
}

function workOnTask(taskNumber: number) {
    const task = getTaskOrExit(taskNumber);

    console.log(`\n🚀 Working on Task ${taskNumber}: ${task.title}\n`);
    console.log(`Priority: ${task.priority}`);
    console.log(`Size: ${task.size}`);
    console.log(`Complexity: ${task.complexity}\n`);

    // Show current branch
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    console.log(`📌 Current branch: ${currentBranch}`);

    if (currentBranch !== 'main') {
        console.log('⚠️  You are not on main branch. Consider switching to main unless you explicitly want to work on a separate branch.\n');
    } else {
        console.log('✅ Working on main branch\n');
    }

    console.log('📝 Task summary:');
    console.log(`   ${task.summary}\n`);

    console.log('💡 Next steps:');
    console.log('  1. Implement the task');
    console.log('  2. Run: yarn checks');
    console.log('  3. Request user approval (MANDATORY)');
    if (currentBranch === 'main') {
        console.log('  4. Commit changes to main');
        console.log(`  5. Run: yarn task mark-done --task ${taskNumber}`);
        console.log('  6. Push to main: git push origin main');
    } else {
        console.log('  4. Commit your changes');
        console.log('  5. Create a PR');
        console.log(`  6. After merge: yarn task mark-done --task ${taskNumber}`);
    }

    console.log(`\n📄 View full details: yarn task view --task ${taskNumber}\n`);
}

function createWorktree(taskNumber: number) {
    const task = getTaskOrExit(taskNumber);

    console.log(`\n🔧 Creating worktree for Task ${taskNumber}: ${task.title}\n`);

    const branchName = `task/${taskNumber}-${task.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 50)}`;

    const worktreePath = path.join(process.cwd(), '..', `worktree-task-${taskNumber}`);

    console.log(`📂 Worktree path: ${worktreePath}`);
    console.log(`🌿 Branch: ${branchName}\n`);

    // Check if worktree already exists
    if (fs.existsSync(worktreePath)) {
        console.log('⚠️  Worktree already exists. Removing old one...');
        try {
            execSync(`git worktree remove ${worktreePath} --force`, { stdio: 'inherit' });
        } catch (e) {
            console.error('Failed to remove old worktree:', e);
        }
    }

    // Create worktree
    try {
        const mainProjectPath = process.cwd();
        execSync(`git worktree add ${worktreePath} -b ${branchName}`, { stdio: 'inherit' });
        console.log('\n✅ Worktree created!');
        console.log(`\n💡 To start working (squash-merge workflow):`);
        console.log(`  cd ${worktreePath}`);
        console.log(`  ln -s "${mainProjectPath}/node_modules" node_modules`);
        console.log(`  # Make your changes (WIP commits OK)`);
        console.log(`  yarn checks`);
        console.log(`  git add . && git commit -m "WIP: changes"`);
        console.log(``);
        console.log(`  # Return to main and squash merge:`);
        console.log(`  cd ${mainProjectPath}`);
        console.log(`  git merge --squash ${branchName}`);
        console.log(`  git commit -m "fix: description (task #${taskNumber})"`);
        console.log(`  git push origin main`);
        console.log(``);
        console.log(`  # Cleanup:`);
        console.log(`  git worktree remove ${worktreePath}`);
        console.log(`  git branch -d ${branchName}`);
        console.log(`  yarn task mark-done --task ${taskNumber}`);
    } catch (error) {
        console.error('❌ Failed to create worktree:', error);
        process.exit(1);
    }
}

function planTask(taskNumber: number) {
    const task = getTaskOrExit(taskNumber);

    console.log(`\n📐 Planning Task ${taskNumber}: ${task.title}\n`);
    console.log(`Priority: ${task.priority}`);
    console.log(`Size: ${task.size}`);
    console.log(`Complexity: ${task.complexity}\n`);
    console.log(`Summary: ${task.summary}\n`);

    console.log('🤖 Launching Plan Agent...\n');
    console.log('⚠️  Plan agent integration not yet implemented.');
    console.log('💡 For now, please review the task details and create a plan manually.');
    console.log(`\n📄 View full details: yarn task view --task ${taskNumber}\n`);
}

function markTaskInProgress(taskNumber: number) {
    const task = getTaskOrExit(taskNumber);

    console.log(`\n🔄 Marking Task ${taskNumber} as in progress: ${task.title}\n`);

    if (task.status === 'Done') {
        console.log('⚠️  Task is already marked as done, cannot mark as in progress');
        return;
    }

    if (task.status === 'In Progress') {
        console.log('ℹ️  Task is already in progress');
        return;
    }

    const format = detectFormat();
    if (format === 'new') {
        libMarkTaskInProgress(taskNumber);
        console.log('✅ Task marked as in progress');
    } else {
        // Legacy format - update in place
        markTaskInProgressLegacy(taskNumber, task);
    }
}

function markTaskInProgressLegacy(taskNumber: number, task: Task) {
    const TASKS_FILE = path.join(process.cwd(), 'task-manager', 'tasks.md');
    const content = fs.readFileSync(TASKS_FILE, 'utf-8');
    const lines = content.split('\n');

    // Find task header and update status in metadata table
    let foundTask = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Find task header
        if (line.match(new RegExp(`^## ${taskNumber}\\.\\s+`))) {
            foundTask = true;
            continue;
        }

        // If we found the task, look for the metadata table
        if (foundTask && line.includes('|') && (line.includes('High') || line.includes('Medium') || line.includes('Low') || line.includes('Critical'))) {
            const cells = line.split('|').map(c => c.trim());
            if (cells.length >= 5) {
                cells[4] = ' In Progress ';
                lines[i] = '|' + cells.slice(1).join('|');
            } else if (cells.length === 4) {
                // Add Status column
                const headerLine = i - 2;
                if (lines[headerLine] && lines[headerLine].includes('| Priority |')) {
                    lines[headerLine] = lines[headerLine].replace(/\|(\s*)$/, '| Status |');
                }
                const separatorLine = i - 1;
                if (lines[separatorLine] && lines[separatorLine].includes('|---')) {
                    lines[separatorLine] = lines[separatorLine].replace(/\|(\s*)$/, '|--------|');
                }
                lines[i] = line.replace(/\|(\s*)$/, '| In Progress |');
            }
            break;
        }
    }

    fs.writeFileSync(TASKS_FILE, lines.join('\n'), 'utf-8');
    console.log('✅ Task marked as in progress in tasks.md');
}

function markTaskDone(taskNumber: number, commit?: string) {
    const task = getTaskOrExit(taskNumber);

    console.log(`\n✅ Marking Task ${taskNumber} as done: ${task.title}\n`);

    const format = detectFormat();
    if (format === 'new') {
        libMarkTaskDone(taskNumber, commit);
        console.log('✅ Task marked as done');
        console.log('\n💡 Remember to commit the change:');
        console.log(`  git add task-manager/`);
        console.log(`  git commit -m "docs: mark task ${taskNumber} as done"`);
        console.log(`  git push`);
    } else {
        // Legacy format - update in place
        markTaskDoneLegacy(taskNumber, commit);
    }
}

function markTaskDoneLegacy(taskNumber: number, commit?: string) {
    const TASKS_FILE = path.join(process.cwd(), 'task-manager', 'tasks.md');
    const content = fs.readFileSync(TASKS_FILE, 'utf-8');
    const lines = content.split('\n');

    let taskHeaderIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(new RegExp(`^## ${taskNumber}\\.\\s+`))) {
            taskHeaderIndex = i;
            break;
        }
    }

    if (taskHeaderIndex === -1) {
        console.error('❌ Failed to find task header');
        return;
    }

    const currentHeader = lines[taskHeaderIndex];
    if (currentHeader.includes('✅ DONE')) {
        console.log('⚠️  Task already marked as done');
        return;
    }

    // Update header
    const headerMatch = currentHeader.match(/^(## \d+\.\s+)(.+)/);
    if (headerMatch) {
        const prefix = headerMatch[1];
        const title = headerMatch[2];
        lines[taskHeaderIndex] = `${prefix}~~${title}~~ ✅ DONE`;
    }

    // Update status in metadata table
    for (let i = taskHeaderIndex; i < Math.min(taskHeaderIndex + 20, lines.length); i++) {
        const line = lines[i];
        if (line.includes('|') && (line.includes('High') || line.includes('Medium') || line.includes('Low') || line.includes('Critical'))) {
            const cells = line.split('|').map(c => c.trim());
            if (cells.length >= 5) {
                cells[4] = ' ✅ **DONE** ';
                lines[i] = '|' + cells.slice(1).join('|');
            }
            break;
        }
    }

    fs.writeFileSync(TASKS_FILE, lines.join('\n'), 'utf-8');
    console.log('✅ Task marked as done in tasks.md');
    console.log('\n💡 Remember to commit the change:');
    console.log(`  git add task-manager/tasks.md`);
    console.log(`  git commit -m "docs: mark task ${taskNumber} as done"`);
    console.log(`  git push`);
}

function migrate(dryRun: boolean) {
    const format = detectFormat();

    if (format === 'new') {
        console.log('✅ Already using new format (tasks/ directory exists)');
        return;
    }

    console.log('\n🔄 Migrating from legacy to new format\n');

    if (dryRun) {
        console.log('📋 DRY RUN - No changes will be made\n');
    }

    // Parse all tasks from legacy file
    const tasks = getAllTasks();
    console.log(`Found ${tasks.length} tasks to migrate\n`);

    if (dryRun) {
        console.log('Migration plan:');
        console.log(`1. Create backup: task-manager/tasks.md.backup`);
        console.log(`2. Create directory: task-manager/tasks/`);
        console.log(`3. Write ${tasks.length} individual task files:`);
        tasks.forEach(task => {
            console.log(`   - task-manager/tasks/task-${task.number}.md`);
        });
        console.log(`4. Generate new summary index: task-manager/tasks.md`);
        console.log('\n💡 Run without --dry-run to execute migration');
        return;
    }

    // Execute migration
    try {
        // 1. Backup
        const TASKS_FILE = path.join(process.cwd(), 'task-manager', 'tasks.md');
        const BACKUP_FILE = path.join(process.cwd(), 'task-manager', 'tasks.md.backup');
        console.log('📦 Creating backup...');
        fs.copyFileSync(TASKS_FILE, BACKUP_FILE);
        console.log(`   ✅ Backup created: ${BACKUP_FILE}`);

        // 2. Create tasks directory
        const TASKS_DIR = path.join(process.cwd(), 'task-manager', 'tasks');
        console.log('\n📁 Creating tasks directory...');
        if (!fs.existsSync(TASKS_DIR)) {
            fs.mkdirSync(TASKS_DIR, { recursive: true });
        }
        console.log(`   ✅ Directory created: ${TASKS_DIR}`);

        // 3. Write individual task files
        console.log('\n📝 Writing individual task files...');
        for (const task of tasks) {
            writeTaskFile(task);
            console.log(`   ✅ task-${task.number}.md`);
        }

        // 4. Clear cache and rebuild index
        console.log('\n🔨 Rebuilding summary index...');
        clearCache();
        rebuildTasksFile();
        console.log('   ✅ tasks.md regenerated');

        console.log('\n✅ Migration complete!');
        console.log('\n💡 Next steps:');
        console.log('  1. Verify migration: yarn task list');
        console.log('  2. Commit changes: git add task-manager/ && git commit -m "refactor: migrate to individual task files"');
        console.log('  3. If satisfied, delete backup: rm task-manager/tasks.md.backup');
        console.log('\n⚠️  Rollback: cp task-manager/tasks.md.backup task-manager/tasks.md && rm -rf task-manager/tasks/');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        console.log('\n🔙 Restore backup: cp task-manager/tasks.md.backup task-manager/tasks.md');
        process.exit(1);
    }
}

function rebuildIndex() {
    console.log('\n🔨 Rebuilding tasks.md summary index...\n');

    const format = detectFormat();
    if (format === 'legacy') {
        console.log('⚠️  Cannot rebuild index in legacy format');
        console.log('💡 Run: yarn task migrate');
        return;
    }

    try {
        clearCache();
        rebuildTasksFile();
        console.log('✅ tasks.md rebuilt successfully\n');
    } catch (error) {
        console.error('❌ Failed to rebuild index:', error);
        process.exit(1);
    }
}

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program.name('task').description('Tasks Management CLI').version('2.0.0');

program
    .command('list [filter]')
    .description('List tasks (filter: open, in-progress, blocked, done, or all)')
    .option('--sortBy <type>', 'Sort by: priority, date, or number (default: priority)')
    .option('--groupBy <type>', 'Group by: status, priority, or date (default: status)')
    .action((filter: string | undefined, options: { sortBy?: string; groupBy?: string }) => {
        const validFilters = ['open', 'in-progress', 'blocked', 'done', 'all'];
        if (filter && !validFilters.includes(filter)) {
            console.error(`❌ Invalid filter: ${filter}`);
            console.log(`   Valid filters: ${validFilters.join(', ')}`);
            process.exit(1);
        }

        const validSortBy = ['priority', 'date', 'number'];
        if (options.sortBy && !validSortBy.includes(options.sortBy)) {
            console.error(`❌ Invalid sortBy: ${options.sortBy}`);
            console.log(`   Valid options: ${validSortBy.join(', ')}`);
            process.exit(1);
        }

        const validGroupBy = ['status', 'priority', 'date'];
        if (options.groupBy && !validGroupBy.includes(options.groupBy)) {
            console.error(`❌ Invalid groupBy: ${options.groupBy}`);
            console.log(`   Valid options: ${validGroupBy.join(', ')}`);
            process.exit(1);
        }

        listTasks({
            filter: filter as ListOptions['filter'],
            sortBy: options.sortBy as SortBy,
            groupBy: options.groupBy as GroupBy,
        });
    });

program
    .command('view')
    .description('View a specific task')
    .requiredOption('--task <number>', 'Task number to view')
    .action((options) => {
        viewTask(parseInt(options.task));
    });

program
    .command('work')
    .description('Work on a specific task')
    .requiredOption('--task <number>', 'Task number to work on')
    .action((options) => {
        workOnTask(parseInt(options.task));
    });

program
    .command('worktree')
    .description('Create a git worktree and work on task')
    .requiredOption('--task <number>', 'Task number to work on')
    .action((options) => {
        createWorktree(parseInt(options.task));
    });

program
    .command('plan')
    .description('Plan implementation for a task')
    .requiredOption('--task <number>', 'Task number to plan')
    .action((options) => {
        planTask(parseInt(options.task));
    });

program
    .command('mark-in-progress')
    .description('Mark task as in progress')
    .requiredOption('--task <number>', 'Task number to mark as in progress')
    .action((options) => {
        markTaskInProgress(parseInt(options.task));
    });

program
    .command('mark-done')
    .description('Mark task as completed')
    .requiredOption('--task <number>', 'Task number to mark as done')
    .option('--commit <hash>', 'Git commit hash where task was completed')
    .action((options) => {
        markTaskDone(parseInt(options.task), options.commit);
    });

program
    .command('migrate')
    .description('Migrate from legacy to new format')
    .option('--dry-run', 'Preview migration without executing')
    .action((options) => {
        migrate(options.dryRun || false);
    });

program
    .command('rebuild-index')
    .description('Rebuild tasks.md summary index')
    .action(() => {
        rebuildIndex();
    });

program.parse();
