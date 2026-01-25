#!/usr/bin/env npx tsx
import '../src/agents/shared/loadEnv';

/**
 * Tasks Management CLI
 *
 * A CLI tool for managing tasks from tasks.md
 *
 * Usage:
 *   yarn task <command> [options]
 *
 * Commands:
 *   list [filter]       List tasks (filter: open, in-progress, done, all)
 *   work                Work on a specific task
 *   worktree            Create worktree and work on task
 *   plan                Plan implementation for a task
 *   mark-done           Mark task as completed
 *
 * Examples:
 *   yarn task list              # All tasks grouped by status
 *   yarn task list open         # Only open tasks
 *   yarn task list in-progress  # Only in-progress tasks
 *   yarn task list done         # Only completed tasks
 *   yarn task work --task 1
 *   yarn task worktree --task 3
 *   yarn task plan --task 5
 *   yarn task mark-done --task 1
 */

import { Command } from 'commander';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

type TaskStatus = 'Open' | 'In Progress' | 'Done';

interface Task {
    number: number;
    title: string;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    complexity: string;
    size: string;
    status: TaskStatus;
    startLine: number;
    endLine: number;
    content: string;
}

// ============================================================================
// Task Parser
// ============================================================================

const TASKS_FILE = path.join(process.cwd(), 'task-manager', 'tasks.md');

function parseTasks(): Task[] {
    if (!fs.existsSync(TASKS_FILE)) {
        console.error('❌ tasks.md not found');
        process.exit(1);
    }

    const content = fs.readFileSync(TASKS_FILE, 'utf-8');
    const lines = content.split('\n');
    const tasks: Task[] = [];

    let currentTask: Partial<Task> | null = null;
    let taskContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect task header: ## 1. Task Title or ## 1. ~~Task Title~~ ✅ DONE
        const headerMatch = line.match(/^## (\d+)\.\s+(.+)/);
        if (headerMatch) {
            // Save previous task
            if (currentTask) {
                tasks.push({
                    ...currentTask,
                    endLine: i - 1,
                    content: taskContent.join('\n'),
                } as Task);
            }

            // Check if task is done (header contains ✅ DONE)
            const isDone = line.includes('✅ DONE');
            // Clean up title (remove strikethrough and DONE marker)
            let title = headerMatch[2];
            title = title.replace(/~~(.+?)~~/g, '$1').replace(/✅ DONE/g, '').trim();

            // Start new task
            currentTask = {
                number: parseInt(headerMatch[1]),
                title,
                startLine: i,
                status: isDone ? 'Done' : 'Open', // Will be updated if "In Progress" found
            };
            taskContent = [line];
            continue;
        }

        // Parse metadata table
        if (currentTask && line.includes('| Priority |')) {
            // Next line has the values (skip separator line)
            const nextLine = lines[i + 2];
            if (nextLine) {
                // Parse: | **Priority** | Complexity | Size | Status (optional) |
                const cells = nextLine.split('|').map(c => c.trim()).filter(c => c);
                if (cells.length >= 3) {
                    currentTask.priority = cells[0].replace(/\*\*/g, '').trim() as Task['priority'];
                    currentTask.complexity = cells[1].trim();
                    currentTask.size = cells[2].trim();
                    // Check for status in 4th column (if exists and not already Done)
                    if (cells.length >= 4 && currentTask.status !== 'Done') {
                        const statusCell = cells[3].toLowerCase();
                        if (statusCell.includes('in progress')) {
                            currentTask.status = 'In Progress';
                        }
                    }
                }
            }
        }

        if (currentTask) {
            taskContent.push(line);
        }
    }

    // Save last task
    if (currentTask) {
        tasks.push({
            ...currentTask,
            endLine: lines.length - 1,
            content: taskContent.join('\n'),
        } as Task);
    }

    return tasks;
}

function getTask(taskNumber: number): Task {
    const tasks = parseTasks();
    const task = tasks.find((t) => t.number === taskNumber);
    if (!task) {
        console.error(`❌ Task ${taskNumber} not found`);
        process.exit(1);
    }
    return task;
}

// ============================================================================
// Commands
// ============================================================================

function listTasks(filter?: 'open' | 'in-progress' | 'done' | 'all') {
    const tasks = parseTasks();
    const priorityOrder: Task['priority'][] = ['Critical', 'High', 'Medium', 'Low'];
    const priorityEmoji: Record<Task['priority'], string> = {
        Critical: '🔴',
        High: '🟠',
        Medium: '🟡',
        Low: '🟢',
    };

    // Filter tasks by status if specified
    const openTasks = tasks.filter(t => t.status === 'Open');
    const inProgressTasks = tasks.filter(t => t.status === 'In Progress');
    const doneTasks = tasks.filter(t => t.status === 'Done');

    // Helper to print tasks grouped by priority (for Open tasks)
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

    // Helper to print tasks sorted by task number descending (for Done/In Progress)
    const printTasksByNumber = (taskList: Task[], indent = '  ') => {
        const sorted = [...taskList].sort((a, b) => b.number - a.number);
        sorted.forEach((task) => {
            console.log(`${indent}${task.number}. ${task.title} (${task.size})`);
        });
    };

    // Print based on filter
    if (filter === 'open') {
        console.log('\n📋 Open Tasks\n');
        if (openTasks.length === 0) {
            console.log('  No open tasks');
        } else {
            printTasksByPriority(openTasks);
        }
    } else if (filter === 'in-progress') {
        console.log('\n🔄 In Progress Tasks\n');
        if (inProgressTasks.length === 0) {
            console.log('  No tasks in progress');
        } else {
            printTasksByNumber(inProgressTasks);
        }
    } else if (filter === 'done') {
        console.log('\n✅ Done Tasks\n');
        if (doneTasks.length === 0) {
            console.log('  No completed tasks');
        } else {
            printTasksByNumber(doneTasks);
        }
    } else {
        // Show all, separated by status
        console.log('\n📋 Tasks\n');

        if (openTasks.length > 0) {
            console.log('━━━ 📋 Open ━━━');
            printTasksByPriority(openTasks);
        }

        if (inProgressTasks.length > 0) {
            console.log('\n━━━ 🔄 In Progress ━━━\n');
            printTasksByNumber(inProgressTasks);
        }

        if (doneTasks.length > 0) {
            console.log('\n━━━ ✅ Done ━━━\n');
            printTasksByNumber(doneTasks);
        }
    }

    console.log('');
}

function workOnTask(taskNumber: number) {
    const task = getTask(taskNumber);

    console.log(`\n🚀 Working on Task ${taskNumber}: ${task.title}\n`);
    console.log(`Priority: ${task.priority}`);
    console.log(`Size: ${task.size}`);
    console.log(`Complexity: ${task.complexity}\n`);

    // Show current branch (no branch creation)
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    console.log(`📌 Current branch: ${currentBranch}`);

    if (currentBranch !== 'main') {
        console.log('⚠️  You are not on main branch. Consider switching to main unless you explicitly want to work on a separate branch.\n');
    } else {
        console.log('✅ Working on main branch\n');
    }

    console.log('📝 Task details:\n');
    console.log(task.content);
    console.log('\n💡 Next steps:');
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
}

function createWorktree(taskNumber: number) {
    const task = getTask(taskNumber);

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
    const task = getTask(taskNumber);

    console.log(`\n📐 Planning Task ${taskNumber}: ${task.title}\n`);
    console.log(`Priority: ${task.priority}`);
    console.log(`Size: ${task.size}`);
    console.log(`Complexity: ${task.complexity}\n`);

    console.log('📝 Task details:\n');
    console.log(task.content);

    console.log('\n\n🤖 Launching Plan Agent...\n');

    // TODO: Integrate with actual plan agent when available
    // For now, just display the task content for manual planning
    console.log('⚠️  Plan agent integration not yet implemented.');
    console.log('💡 For now, please review the task details above and create a plan manually.');
}

function markTaskInProgress(taskNumber: number) {
    const task = getTask(taskNumber);

    console.log(`\n🔄 Marking Task ${taskNumber} as in progress: ${task.title}\n`);

    // Check if already done
    if (task.status === 'Done') {
        console.log('⚠️  Task is already marked as done, cannot mark as in progress');
        return;
    }

    // Check if already in progress
    if (task.status === 'In Progress') {
        console.log('ℹ️  Task is already in progress');
        return;
    }

    // Read the file
    const content = fs.readFileSync(TASKS_FILE, 'utf-8');
    const lines = content.split('\n');

    // Find and update the status in the metadata table
    // Look for the line with | Priority | Complexity | Size | (with optional Status column)
    for (let i = task.startLine; i <= task.endLine; i++) {
        const line = lines[i];
        // Match the data row (not header row) - contains actual values like "High", "Mid", etc.
        if (line.includes('|') && (line.includes('High') || line.includes('Medium') || line.includes('Low') || line.includes('Critical'))) {
            const cells = line.split('|').map(c => c.trim());
            // Check if there's already a Status column (4th data column after empty first)
            if (cells.length >= 5) {
                // Has Status column - update it
                cells[4] = ' In Progress ';
                lines[i] = '|' + cells.slice(1).join('|');
            } else if (cells.length === 4) {
                // No Status column - add it
                // First, update the header row (should be 2 lines above)
                const headerLine = i - 2;
                if (lines[headerLine] && lines[headerLine].includes('| Priority |')) {
                    lines[headerLine] = lines[headerLine].replace(/\|(\s*)$/, '| Status |');
                }
                // Update separator line
                const separatorLine = i - 1;
                if (lines[separatorLine] && lines[separatorLine].includes('|---')) {
                    lines[separatorLine] = lines[separatorLine].replace(/\|(\s*)$/, '|--------|');
                }
                // Add status to data row
                lines[i] = line.replace(/\|(\s*)$/, '| In Progress |');
            }
            break;
        }
    }

    // Write back
    fs.writeFileSync(TASKS_FILE, lines.join('\n'), 'utf-8');

    console.log('✅ Task marked as in progress in tasks.md');
}

function markTaskDone(taskNumber: number) {
    const task = getTask(taskNumber);

    console.log(`\n✅ Marking Task ${taskNumber} as done: ${task.title}\n`);

    // Read the file
    const content = fs.readFileSync(TASKS_FILE, 'utf-8');
    const lines = content.split('\n');

    // Add DONE marker to the task header
    const taskHeaderLine = task.startLine;
    const currentHeader = lines[taskHeaderLine];

    if (currentHeader.includes('✅ DONE')) {
        console.log('⚠️  Task already marked as done');
        return;
    }

    // Add strikethrough and ✅ DONE to the header
    // Pattern: ## N. Title -> ## N. ~~Title~~ ✅ DONE
    const headerMatch = currentHeader.match(/^(## \d+\.\s+)(.+)/);
    if (headerMatch) {
        const prefix = headerMatch[1]; // "## N. "
        const title = headerMatch[2];  // "Title"
        lines[taskHeaderLine] = `${prefix}~~${title}~~ ✅ DONE`;
    } else {
        // Fallback if pattern doesn't match
        lines[taskHeaderLine] = currentHeader + ' ✅ DONE';
    }

    // Update Status column in the metadata table to ✅ **DONE**
    for (let i = task.startLine; i <= task.endLine; i++) {
        const line = lines[i];
        // Match the data row (contains priority values)
        if (line.includes('|') && (line.includes('High') || line.includes('Medium') || line.includes('Low') || line.includes('Critical'))) {
            const cells = line.split('|').map(c => c.trim());
            // Check if there's a Status column (4th data column after empty first)
            if (cells.length >= 5) {
                // Has Status column - update it to ✅ **DONE**
                cells[4] = ' ✅ **DONE** ';
                lines[i] = '|' + cells.slice(1).join('|');
            }
            break;
        }
    }

    // Write back
    fs.writeFileSync(TASKS_FILE, lines.join('\n'), 'utf-8');

    console.log('✅ Task marked as done in tasks.md');
    console.log('\n💡 Remember to commit the change:');
    console.log(`  git add tasks.md`);
    console.log(`  git commit -m "docs: mark task ${taskNumber} as done"`);
    console.log(`  git push`);
}

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program.name('task').description('Tasks Management CLI').version('1.0.0');

program
    .command('list [filter]')
    .description('List tasks (filter: open, in-progress, done, or all)')
    .action((filter?: string) => {
        const validFilters = ['open', 'in-progress', 'done', 'all'];
        if (filter && !validFilters.includes(filter)) {
            console.error(`❌ Invalid filter: ${filter}`);
            console.log(`   Valid filters: ${validFilters.join(', ')}`);
            process.exit(1);
        }
        listTasks(filter as 'open' | 'in-progress' | 'done' | 'all' | undefined);
    });

program
    .command('work')
    .description('Work on a specific task (creates/switches to branch)')
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
    .action((options) => {
        markTaskDone(parseInt(options.task));
    });

program.parse();
