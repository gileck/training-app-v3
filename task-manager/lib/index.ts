/**
 * Task Management Library
 *
 * Centralized library for task management operations.
 * Supports both legacy (monolithic tasks.md) and new (individual files) formats.
 */

// Types
export * from './types';

// Parsers
export { parseLegacyTasksFile } from './legacyParser';
export { parseTaskFile, serializeTask } from './parser';

// Readers
export {
    detectFormat,
    getAllTasks,
    getTask,
    getTasksByStatus,
    getAllTaskNumbers,
    getHighestTaskNumber,
    taskExists,
    clearCache,
    getTaskFilePath,
} from './taskReader';

// Writers
export {
    createTask,
    updateTask,
    markTaskInProgress,
    markTaskBlocked,
    markTaskDone,
    deleteTask,
    writeTaskFile,
} from './taskWriter';

// Index Builder
export {
    buildIndex,
    generateIndexMarkdown,
    rebuildTasksFile,
} from './indexBuilder';
