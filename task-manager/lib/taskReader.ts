/**
 * Task Reader - Read Operations with Format Auto-Detection
 *
 * Provides functions to read tasks from either legacy or new format.
 * Auto-detects format based on presence of tasks/ directory.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Task, TaskStatus } from './types';
import { parseLegacyTasksFile } from './legacyParser';
import { parseTaskFile } from './parser';

const TASK_MANAGER_DIR = path.join(process.cwd(), 'task-manager');
const TASKS_DIR = path.join(TASK_MANAGER_DIR, 'tasks');
const LEGACY_TASKS_FILE = path.join(TASK_MANAGER_DIR, 'tasks.md');

// Cache for parsed tasks (cleared on any write operation)
let taskCache: Map<number, Task> | null = null;
let cacheTimestamp = 0;

/**
 * Detect which format is currently in use
 * @returns 'new' if tasks/ directory exists, 'legacy' otherwise
 */
export function detectFormat(): 'legacy' | 'new' {
    return fs.existsSync(TASKS_DIR) && fs.statSync(TASKS_DIR).isDirectory() ? 'new' : 'legacy';
}

/**
 * Get all tasks from current format
 * @returns Array of all tasks
 */
export function getAllTasks(): Task[] {
    const format = detectFormat();

    if (format === 'new') {
        return getAllTasksNew();
    } else {
        return getAllTasksLegacy();
    }
}

/**
 * Get a specific task by number
 * @param taskNumber Task number to retrieve
 * @returns Task object or null if not found
 */
export function getTask(taskNumber: number): Task | null {
    const tasks = getAllTasks();
    return tasks.find(t => t.number === taskNumber) || null;
}

/**
 * Get tasks filtered by status
 * @param status Status to filter by
 * @returns Array of tasks with the specified status
 */
export function getTasksByStatus(status: TaskStatus): Task[] {
    const tasks = getAllTasks();
    return tasks.filter(t => t.status === status);
}

/**
 * Get all task numbers
 * @returns Array of task numbers
 */
export function getAllTaskNumbers(): number[] {
    const tasks = getAllTasks();
    return tasks.map(t => t.number).sort((a, b) => a - b);
}

/**
 * Get the highest task number
 * @returns Highest task number or 0 if no tasks
 */
export function getHighestTaskNumber(): number {
    const numbers = getAllTaskNumbers();
    return numbers.length > 0 ? Math.max(...numbers) : 0;
}

/**
 * Check if a task number exists
 * @param taskNumber Task number to check
 * @returns true if task exists, false otherwise
 */
export function taskExists(taskNumber: number): boolean {
    return getTask(taskNumber) !== null;
}

/**
 * Clear the task cache
 * Should be called after any write operations
 */
export function clearCache(): void {
    taskCache = null;
    cacheTimestamp = 0;
}

/**
 * Get all tasks from new format (individual files)
 */
function getAllTasksNew(): Task[] {
    if (taskCache && Date.now() - cacheTimestamp < 5000) {
        return Array.from(taskCache.values());
    }

    const tasks: Task[] = [];

    if (!fs.existsSync(TASKS_DIR)) {
        return tasks;
    }

    const files = fs.readdirSync(TASKS_DIR);
    const taskFiles = files.filter(f => f.match(/^task-\d+\.md$/));

    for (const file of taskFiles) {
        try {
            const filepath = path.join(TASKS_DIR, file);
            const task = parseTaskFile(filepath);
            tasks.push(task);
        } catch (error) {
            console.error(`Warning: Failed to parse ${file}:`, error);
        }
    }

    // Sort by task number
    tasks.sort((a, b) => a.number - b.number);

    // Update cache
    taskCache = new Map(tasks.map(t => [t.number, t]));
    cacheTimestamp = Date.now();

    return tasks;
}

/**
 * Get all tasks from legacy format (monolithic file)
 */
function getAllTasksLegacy(): Task[] {
    if (taskCache && Date.now() - cacheTimestamp < 5000) {
        return Array.from(taskCache.values());
    }

    if (!fs.existsSync(LEGACY_TASKS_FILE)) {
        return [];
    }

    const tasks = parseLegacyTasksFile(LEGACY_TASKS_FILE);

    // Update cache
    taskCache = new Map(tasks.map(t => [t.number, t]));
    cacheTimestamp = Date.now();

    return tasks;
}

/**
 * Get task file path for a given task number (new format only)
 * @param taskNumber Task number
 * @returns File path or null if not found
 */
export function getTaskFilePath(taskNumber: number): string | null {
    const format = detectFormat();
    if (format === 'legacy') {
        return null;
    }

    const filepath = path.join(TASKS_DIR, `task-${taskNumber}.md`);
    return fs.existsSync(filepath) ? filepath : null;
}
