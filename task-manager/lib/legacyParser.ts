/**
 * Legacy Parser - Parse Monolithic tasks.md File
 *
 * This parser handles the original monolithic tasks.md format for backward compatibility.
 * It will be used during the migration period to support both old and new formats.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Task, TaskStatus, TaskPriority } from './types';

const TASKS_FILE = path.join(process.cwd(), 'task-manager', 'tasks.md');

/**
 * Parse the legacy monolithic tasks.md file
 * @returns Array of Task objects
 */
export function parseLegacyTasksFile(filePath: string = TASKS_FILE): Task[] {
    if (!fs.existsSync(filePath)) {
        throw new Error(`tasks.md not found at ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
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
            if (currentTask && isValidTask(currentTask)) {
                tasks.push(buildTask(currentTask, taskContent.join('\n')));
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
                status: isDone ? 'Done' : 'TODO',
            };
            taskContent = [];
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
                    currentTask.priority = cells[0].replace(/\*\*/g, '').trim() as TaskPriority;
                    currentTask.complexity = cells[1].trim() as Task['complexity'];
                    currentTask.size = cells[2].trim() as Task['size'];
                    // Check for status in 4th column (if exists and not already Done)
                    if (cells.length >= 4 && currentTask.status !== 'Done') {
                        const statusCell = cells[3].toLowerCase();
                        if (statusCell.includes('in progress')) {
                            currentTask.status = 'In Progress';
                        } else if (statusCell.includes('blocked')) {
                            currentTask.status = 'Blocked';
                        }
                    }
                }
            }
        }

        // Parse completion info: > **Completed:** 2026-01-24 - Fixed in commit `78c0e44`
        if (currentTask && line.includes('**Completed:**')) {
            const completedMatch = line.match(/\*\*Completed:\*\*\s+(\d{4}-\d{2}-\d{2}).*?`([a-f0-9]+)`/);
            if (completedMatch) {
                currentTask.dateCompleted = completedMatch[1];
                currentTask.completionCommit = completedMatch[2];
            }
        }

        // Parse summary: **Summary:** Text here
        if (currentTask && line.includes('**Summary:**')) {
            const summaryMatch = line.match(/\*\*Summary:\*\*\s+(.+)/);
            if (summaryMatch) {
                currentTask.summary = summaryMatch[1].trim();
            }
        }

        if (currentTask) {
            taskContent.push(line);
        }
    }

    // Save last task
    if (currentTask && isValidTask(currentTask)) {
        tasks.push(buildTask(currentTask, taskContent.join('\n')));
    }

    return tasks;
}

/**
 * Check if a partial task has all required fields
 */
function isValidTask(task: Partial<Task>): task is Task {
    return !!(
        task.number &&
        task.title &&
        task.priority &&
        task.complexity &&
        task.size &&
        task.status &&
        task.summary
    );
}

/**
 * Build a complete Task object from partial data and content
 */
function buildTask(partial: Partial<Task>, content: string): Task {
    // Extract date added from content if available
    // Look for "Date Added:" pattern in content
    const dateAddedMatch = content.match(/Date Added:\s+(\d{4}-\d{2}-\d{2})/i);
    const dateAdded = dateAddedMatch ? dateAddedMatch[1] : new Date().toISOString().split('T')[0];

    return {
        number: partial.number!,
        title: partial.title!,
        priority: partial.priority!,
        complexity: partial.complexity!,
        size: partial.size!,
        status: partial.status as TaskStatus,
        dateAdded,
        dateCompleted: partial.dateCompleted,
        completionCommit: partial.completionCommit,
        summary: partial.summary || '',
        details: extractDetails(content),
        implementationNotes: extractImplementationNotes(content),
        filesToModify: extractFilesToModify(content),
        dependencies: extractDependencies(content),
        risks: extractRisks(content),
        notes: extractNotes(content),
    };
}

/**
 * Extract details section from task content
 */
function extractDetails(content: string): string | undefined {
    const detailsMatch = content.match(/\*\*Details?:\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|$)/);
    if (detailsMatch) {
        return detailsMatch[1].trim();
    }
    return undefined;
}

/**
 * Extract implementation notes from task content
 */
function extractImplementationNotes(content: string): string | undefined {
    const notesMatch = content.match(/\*\*Implementation Notes?:\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|$)/);
    if (notesMatch) {
        return notesMatch[1].trim();
    }
    return undefined;
}

/**
 * Extract files to modify from task content
 */
function extractFilesToModify(content: string): string[] | undefined {
    const filesMatch = content.match(/\*\*Files to Modify:\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|$)/);
    if (filesMatch) {
        const files = filesMatch[1]
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('-'))
            .map(line => line.replace(/^-\s*/, '').trim())
            .filter(Boolean);
        return files.length > 0 ? files : undefined;
    }
    return undefined;
}

/**
 * Extract dependencies from task content
 */
function extractDependencies(content: string): string[] | undefined {
    const depsMatch = content.match(/\*\*Dependenc(?:y|ies):\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|$)/);
    if (depsMatch) {
        const deps = depsMatch[1]
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('-'))
            .map(line => line.replace(/^-\s*/, '').trim())
            .filter(Boolean);
        return deps.length > 0 ? deps : undefined;
    }
    return undefined;
}

/**
 * Extract risks from task content
 */
function extractRisks(content: string): string[] | undefined {
    const risksMatch = content.match(/\*\*Risks?:\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|$)/);
    if (risksMatch) {
        const risks = risksMatch[1]
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('-'))
            .map(line => line.replace(/^-\s*/, '').trim())
            .filter(Boolean);
        return risks.length > 0 ? risks : undefined;
    }
    return undefined;
}

/**
 * Extract notes from task content
 */
function extractNotes(content: string): string | undefined {
    const notesMatch = content.match(/\*\*Notes?:\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|$)/);
    if (notesMatch) {
        return notesMatch[1].trim();
    }
    return undefined;
}
