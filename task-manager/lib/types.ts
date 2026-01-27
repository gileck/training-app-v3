/**
 * Task Management Library - Type Definitions
 *
 * Centralized type definitions for the task management system.
 */

export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TaskComplexity = 'Low' | 'Medium' | 'High';
export type TaskSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type TaskStatus = 'TODO' | 'In Progress' | 'Blocked' | 'Done';

/**
 * Core task metadata extracted from task files
 */
export interface TaskMetadata {
    /** Unique task number (sequential, never reused) */
    number: number;
    /** Task title */
    title: string;
    /** Task priority */
    priority: TaskPriority;
    /** Implementation complexity */
    complexity: TaskComplexity;
    /** Estimated size */
    size: TaskSize;
    /** Current status */
    status: TaskStatus;
    /** Date task was added (ISO string) */
    dateAdded: string;
    /** Date task was last updated (ISO string) */
    dateUpdated?: string;
    /** Date task was completed (ISO string) */
    dateCompleted?: string;
    /** Git commit hash where task was completed */
    completionCommit?: string;
    /** Path to implementation plan file (e.g., task-manager/plans/task-5-plan.md) */
    planFile?: string;
}

/**
 * Complete task with all details
 */
export interface Task extends TaskMetadata {
    /** One-sentence summary */
    summary: string;
    /** Detailed description */
    details?: string;
    /** Implementation guidance and notes */
    implementationNotes?: string;
    /** Files expected to be modified */
    filesToModify?: string[];
    /** Task dependencies (task numbers) */
    dependencies?: string[];
    /** Known risks or concerns */
    risks?: string[];
    /** Additional notes */
    notes?: string;
}

/**
 * Task index for quick lookups and summaries
 */
export interface TaskIndex {
    /** All tasks indexed by number */
    tasks: Map<number, Task>;
    /** Tasks grouped by status */
    byStatus: {
        open: Task[];
        inProgress: Task[];
        blocked: Task[];
        done: Task[];
    };
    /** Tasks grouped by priority */
    byPriority: {
        Critical: Task[];
        High: Task[];
        Medium: Task[];
        Low: Task[];
    };
    /** Last updated timestamp */
    lastUpdated: string;
}
