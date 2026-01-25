/**
 * Design File Utilities
 *
 * Provides utilities for design agents to read/write design documents
 * to the design-docs directory structure.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// CONSTANTS
// ============================================================

const DESIGN_DOCS_DIR = 'design-docs';

// ============================================================
// FILE OPERATIONS
// ============================================================

/**
 * Get the full path for a design document
 * @returns Absolute path to the design document
 */
export function getDesignDocFullPath(issueNumber: number, type: 'product' | 'tech'): string {
    const filename = type === 'product' ? 'product-design.md' : 'tech-design.md';
    return path.join(process.cwd(), DESIGN_DOCS_DIR, `issue-${issueNumber}`, filename);
}

/**
 * Get the relative path for a design document (from repo root)
 * @returns Relative path: "design-docs/issue-{N}/product-design.md"
 */
export function getDesignDocRelativePath(issueNumber: number, type: 'product' | 'tech'): string {
    const filename = type === 'product' ? 'product-design.md' : 'tech-design.md';
    return path.join(DESIGN_DOCS_DIR, `issue-${issueNumber}`, filename);
}

/**
 * Get the issue directory path
 * @returns Relative path: "design-docs/issue-{N}"
 */
export function getIssueDesignDir(issueNumber: number): string {
    return path.join(DESIGN_DOCS_DIR, `issue-${issueNumber}`);
}

/**
 * Write design document to design-docs directory
 * Creates the directory structure if it doesn't exist
 *
 * @returns The relative path to the written file
 */
export function writeDesignDoc(issueNumber: number, type: 'product' | 'tech', content: string): string {
    const fullPath = getDesignDocFullPath(issueNumber, type);
    const dir = path.dirname(fullPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(fullPath, content, 'utf-8');

    return getDesignDocRelativePath(issueNumber, type);
}

/**
 * Read design document from design-docs directory
 * @returns File content, or null if file doesn't exist
 */
export function readDesignDoc(issueNumber: number, type: 'product' | 'tech'): string | null {
    const fullPath = getDesignDocFullPath(issueNumber, type);

    if (!fs.existsSync(fullPath)) {
        return null;
    }

    return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Check if design document exists
 */
export function designDocExists(issueNumber: number, type: 'product' | 'tech'): boolean {
    const fullPath = getDesignDocFullPath(issueNumber, type);
    return fs.existsSync(fullPath);
}

/**
 * Delete design document
 * @returns true if file was deleted, false if it didn't exist
 */
export function deleteDesignDoc(issueNumber: number, type: 'product' | 'tech'): boolean {
    const fullPath = getDesignDocFullPath(issueNumber, type);

    if (!fs.existsSync(fullPath)) {
        return false;
    }

    fs.unlinkSync(fullPath);
    return true;
}

/**
 * Delete entire issue design directory
 * @returns true if directory was deleted, false if it didn't exist
 */
export function deleteIssueDesignDir(issueNumber: number): boolean {
    const dirPath = path.join(process.cwd(), getIssueDesignDir(issueNumber));

    if (!fs.existsSync(dirPath)) {
        return false;
    }

    fs.rmSync(dirPath, { recursive: true });
    return true;
}
