/**
 * Task Parser - Parse Individual Task Files
 *
 * Parser for individual task files with YAML frontmatter format.
 * This is the new format that individual task files will use.
 */

import * as fs from 'fs';
import { Task, TaskMetadata } from './types';

/**
 * Parse a single task file with YAML frontmatter
 * @param filepath Path to the task file
 * @returns Parsed Task object
 */
export function parseTaskFile(filepath: string): Task {
    if (!fs.existsSync(filepath)) {
        throw new Error(`Task file not found: ${filepath}`);
    }

    const content = fs.readFileSync(filepath, 'utf-8');

    // Split frontmatter and body
    const parts = content.split('---');
    if (parts.length < 3) {
        throw new Error(`Invalid task file format: ${filepath} (missing YAML frontmatter)`);
    }

    const frontmatterText = parts[1].trim();
    const bodyText = parts.slice(2).join('---').trim();

    // Parse frontmatter
    const metadata = parseFrontmatter(frontmatterText);

    // Parse body sections
    const summary = extractSummary(bodyText);
    const details = extractSection(bodyText, 'Details');
    const implementationNotes = extractSection(bodyText, 'Implementation Notes');
    const filesToModify = extractListSection(bodyText, 'Files to Modify');
    const dependencies = extractListSection(bodyText, 'Dependencies');
    const risks = extractListSection(bodyText, 'Risks');
    const notes = extractSection(bodyText, 'Notes');

    return {
        ...metadata,
        summary: summary || '',
        details,
        implementationNotes,
        filesToModify,
        dependencies,
        risks,
        notes,
    };
}

/**
 * Serialize a Task object to markdown with YAML frontmatter
 * @param task Task object to serialize
 * @returns Markdown string with YAML frontmatter
 */
export function serializeTask(task: Task): string {
    const lines: string[] = [];

    // YAML frontmatter
    lines.push('---');
    lines.push(`number: ${task.number}`);
    lines.push(`title: ${escapeYaml(task.title)}`);
    lines.push(`priority: ${task.priority}`);
    lines.push(`size: ${task.size}`);
    lines.push(`complexity: ${task.complexity}`);
    lines.push(`status: ${task.status}`);
    lines.push(`dateAdded: ${task.dateAdded}`);
    if (task.dateUpdated) {
        lines.push(`dateUpdated: ${task.dateUpdated}`);
    }
    if (task.dateCompleted) {
        lines.push(`dateCompleted: ${task.dateCompleted}`);
    }
    if (task.completionCommit) {
        lines.push(`completionCommit: ${task.completionCommit}`);
    }
    if (task.planFile) {
        lines.push(`planFile: ${task.planFile}`);
    }
    lines.push('---');
    lines.push('');

    // Header
    lines.push(`# Task ${task.number}: ${task.title}`);
    lines.push('');

    // Summary
    lines.push(`**Summary:** ${task.summary}`);
    lines.push('');

    // Optional sections
    if (task.details) {
        lines.push('## Details');
        lines.push('');
        lines.push(task.details);
        lines.push('');
    }

    if (task.implementationNotes) {
        lines.push('## Implementation Notes');
        lines.push('');
        lines.push(task.implementationNotes);
        lines.push('');
    }

    if (task.filesToModify && task.filesToModify.length > 0) {
        lines.push('## Files to Modify');
        lines.push('');
        task.filesToModify.forEach(file => lines.push(`- ${file}`));
        lines.push('');
    }

    if (task.dependencies && task.dependencies.length > 0) {
        lines.push('## Dependencies');
        lines.push('');
        task.dependencies.forEach(dep => lines.push(`- ${dep}`));
        lines.push('');
    }

    if (task.risks && task.risks.length > 0) {
        lines.push('## Risks');
        lines.push('');
        task.risks.forEach(risk => lines.push(`- ${risk}`));
        lines.push('');
    }

    if (task.notes) {
        lines.push('## Notes');
        lines.push('');
        lines.push(task.notes);
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Parse YAML frontmatter into TaskMetadata
 */
function parseFrontmatter(text: string): TaskMetadata {
    const lines = text.split('\n');
    const metadata: Partial<TaskMetadata> = {};

    for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (!key || valueParts.length === 0) continue;

        const value = valueParts.join(':').trim();
        const trimmedKey = key.trim();

        switch (trimmedKey) {
            case 'number':
                metadata.number = parseInt(value);
                break;
            case 'title':
                metadata.title = unescapeYaml(value);
                break;
            case 'priority':
                metadata.priority = value as TaskMetadata['priority'];
                break;
            case 'size':
                metadata.size = value as TaskMetadata['size'];
                break;
            case 'complexity':
                metadata.complexity = value as TaskMetadata['complexity'];
                break;
            case 'status':
                metadata.status = value as TaskMetadata['status'];
                break;
            case 'dateAdded':
                metadata.dateAdded = value;
                break;
            case 'dateUpdated':
                metadata.dateUpdated = value;
                break;
            case 'dateCompleted':
                metadata.dateCompleted = value;
                break;
            case 'completionCommit':
                metadata.completionCommit = value;
                break;
            case 'planFile':
                metadata.planFile = value;
                break;
        }
    }

    // Validate required fields
    if (!metadata.number || !metadata.title || !metadata.priority ||
        !metadata.size || !metadata.complexity || !metadata.status || !metadata.dateAdded) {
        throw new Error('Missing required metadata fields in frontmatter');
    }

    return metadata as TaskMetadata;
}

/**
 * Extract summary from body (first line after header with **Summary:** prefix)
 */
function extractSummary(body: string): string | undefined {
    const summaryMatch = body.match(/\*\*Summary:\*\*\s*(.+)/);
    return summaryMatch ? summaryMatch[1].trim() : undefined;
}

/**
 * Extract a section by heading
 */
function extractSection(body: string, heading: string): string | undefined {
    const regex = new RegExp(`## ${heading}\\s*\\n\\n([\\s\\S]*?)(?=\\n## |$)`);
    const match = body.match(regex);
    return match ? match[1].trim() : undefined;
}

/**
 * Extract a list section (bullet points)
 */
function extractListSection(body: string, heading: string): string[] | undefined {
    const section = extractSection(body, heading);
    if (!section) return undefined;

    const items = section
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('-'))
        .map(line => line.replace(/^-\s*/, '').trim())
        .filter(Boolean);

    return items.length > 0 ? items : undefined;
}

/**
 * Escape YAML special characters in string values
 */
function escapeYaml(value: string): string {
    // If string contains special characters, quote it
    if (/[:#{}[\]|>*&!%@`]/.test(value) || value.includes('\n')) {
        return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
}

/**
 * Unescape YAML quoted strings
 */
function unescapeYaml(value: string): string {
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    // Unescape escaped quotes
    return value.replace(/\\"/g, '"').replace(/\\'/g, "'");
}
