/**
 * Task Writer - Write Operations
 *
 * Handles creating and updating individual task files.
 * Automatically rebuilds index after write operations.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Task, TaskStatus } from './types';
import { serializeTask } from './parser';
import { getHighestTaskNumber, taskExists, clearCache } from './taskReader';
import { rebuildTasksFile } from './indexBuilder';

const TASK_MANAGER_DIR = path.join(process.cwd(), 'task-manager');
const TASKS_DIR = path.join(TASK_MANAGER_DIR, 'tasks');

/**
 * Ensure tasks directory exists
 */
function ensureTasksDirectory(): void {
    if (!fs.existsSync(TASKS_DIR)) {
        fs.mkdirSync(TASKS_DIR, { recursive: true });
    }
}

/**
 * Create a new task
 * @param task Task object without number (will be assigned automatically)
 * @returns Created task with assigned number
 */
export function createTask(task: Omit<Task, 'number'>): Task {
    ensureTasksDirectory();

    // Assign next task number
    const nextNumber = getHighestTaskNumber() + 1;

    const newTask: Task = {
        ...task,
        number: nextNumber,
        dateAdded: task.dateAdded || new Date().toISOString().split('T')[0],
        status: task.status || 'TODO',
    };

    // Write task file
    const filepath = path.join(TASKS_DIR, `task-${nextNumber}.md`);
    const content = serializeTask(newTask);
    fs.writeFileSync(filepath, content, 'utf-8');

    // Clear cache and rebuild index
    clearCache();
    rebuildTasksFile();

    return newTask;
}

/**
 * Update an existing task
 * @param taskNumber Task number to update
 * @param updates Partial task object with fields to update
 */
export function updateTask(taskNumber: number, updates: Partial<Omit<Task, 'number'>>): void {
    if (!taskExists(taskNumber)) {
        throw new Error(`Task ${taskNumber} not found`);
    }

    ensureTasksDirectory();

    // Read current task
    const filepath = path.join(TASKS_DIR, `task-${taskNumber}.md`);
    if (!fs.existsSync(filepath)) {
        throw new Error(`Task file not found: ${filepath}`);
    }

    const currentContent = fs.readFileSync(filepath, 'utf-8');
    const { parseTaskFile } = require('./parser');
    const currentTask = parseTaskFile(filepath);

    // Merge updates
    const updatedTask: Task = {
        ...currentTask,
        ...updates,
        number: taskNumber, // Ensure number doesn't change
        dateUpdated: new Date().toISOString().split('T')[0],
    };

    // Write updated task
    const content = serializeTask(updatedTask);
    fs.writeFileSync(filepath, content, 'utf-8');

    // Clear cache and rebuild index
    clearCache();
    rebuildTasksFile();
}

/**
 * Mark a task as in progress
 * @param taskNumber Task number to update
 */
export function markTaskInProgress(taskNumber: number): void {
    updateTask(taskNumber, {
        status: 'In Progress',
    });
}

/**
 * Mark a task as blocked
 * @param taskNumber Task number to update
 * @param reason Optional reason for blocking
 */
export function markTaskBlocked(taskNumber: number, reason?: string): void {
    const updates: Partial<Task> = {
        status: 'Blocked',
    };

    if (reason) {
        updates.notes = reason;
    }

    updateTask(taskNumber, updates);
}

/**
 * Mark a task as done
 * @param taskNumber Task number to update
 * @param commit Git commit hash where task was completed
 */
export function markTaskDone(taskNumber: number, commit?: string): void {
    const updates: Partial<Task> = {
        status: 'Done',
        dateCompleted: new Date().toISOString().split('T')[0],
    };

    if (commit) {
        updates.completionCommit = commit;
    }

    updateTask(taskNumber, updates);
}

/**
 * Delete a task (not recommended - prefer marking as done)
 * @param taskNumber Task number to delete
 */
export function deleteTask(taskNumber: number): void {
    if (!taskExists(taskNumber)) {
        throw new Error(`Task ${taskNumber} not found`);
    }

    const filepath = path.join(TASKS_DIR, `task-${taskNumber}.md`);
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
    }

    // Clear cache and rebuild index
    clearCache();
    rebuildTasksFile();
}

/**
 * Write a task directly to a file (used during migration)
 * @param task Complete task object
 */
export function writeTaskFile(task: Task): void {
    ensureTasksDirectory();

    const filepath = path.join(TASKS_DIR, `task-${task.number}.md`);
    const content = serializeTask(task);
    fs.writeFileSync(filepath, content, 'utf-8');
}
