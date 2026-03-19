/**
 * Design File Utilities
 *
 * Provides utilities for design agents to read/write design documents
 * to the design-docs directory structure and S3 storage.
 *
 * S3 is the primary storage for design documents (decoupled from PR merge).
 * Filesystem is used during agent execution (write to branch, commit, push).
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// CONSTANTS
// ============================================================

const DESIGN_DOCS_DIR = 'design-docs';
const S3_DESIGN_PREFIX = 'design-docs';

// ============================================================
// TYPES
// ============================================================

/**
 * Design document types:
 * - 'product-dev': Product Development document (requirements, acceptance criteria)
 * - 'product': Product Design document (UX/UI design)
 * - 'tech': Technical Design document (architecture, implementation plan)
 */
export type DesignDocType = 'product-dev' | 'product' | 'tech';

// ============================================================
// S3 KEY HELPERS
// ============================================================

/**
 * Get the filename for a design document type
 */
function getDesignDocFilename(type: DesignDocType): string {
    switch (type) {
        case 'product-dev': return 'product-development.md';
        case 'product': return 'product-design.md';
        case 'tech': return 'tech-design.md';
    }
}

/**
 * Get the S3 key for a design document
 * @returns S3 key: "design-docs/issue-{N}/product-design.md"
 */
export function getDesignS3Key(issueNumber: number, type: DesignDocType): string {
    const filename = getDesignDocFilename(type);
    return `${S3_DESIGN_PREFIX}/issue-${issueNumber}/${filename}`;
}

// ============================================================
// S3 OPERATIONS
// ============================================================

/**
 * Save design content to S3.
 * Used after agent completion so content is available for approval without PR merge.
 */
export async function saveDesignToS3(issueNumber: number, type: DesignDocType, content: string): Promise<string> {
    const { uploadFile } = await import('@/server/template/s3/sdk');
    const s3Key = getDesignS3Key(issueNumber, type);
    await uploadFile({
        content,
        fileName: s3Key,
        contentType: 'text/markdown',
    });
    return s3Key;
}

/**
 * Read design content from S3.
 * @returns Content string, or null if not found
 */
export async function readDesignFromS3(issueNumber: number, type: DesignDocType): Promise<string | null> {
    const { getFileAsString, fileExists } = await import('@/server/template/s3/sdk');
    const s3Key = getDesignS3Key(issueNumber, type);
    try {
        const exists = await fileExists(s3Key);
        if (!exists) return null;
        return await getFileAsString(s3Key);
    } catch {
        return null;
    }
}

/**
 * Delete design files from S3.
 * If type is provided, deletes a single file. Otherwise deletes all design files for the issue.
 */
export async function deleteDesignFromS3(issueNumber: number, type?: DesignDocType): Promise<void> {
    const { deleteFile, listFiles } = await import('@/server/template/s3/sdk');
    if (type) {
        const s3Key = getDesignS3Key(issueNumber, type);
        try {
            await deleteFile(s3Key);
        } catch {
            // File may not exist, ignore
        }
    } else {
        // Delete all design files for this issue
        const prefix = `${S3_DESIGN_PREFIX}/issue-${issueNumber}/`;
        const files = await listFiles(prefix);
        await Promise.all(files.map(f => deleteFile(f.key)));
    }
}

// ============================================================
// FILESYSTEM OPERATIONS
// ============================================================

/**
 * Get the full path for a design document
 * @returns Absolute path to the design document
 */
export function getDesignDocFullPath(issueNumber: number, type: DesignDocType): string {
    const filename = getDesignDocFilename(type);
    return path.join(process.cwd(), DESIGN_DOCS_DIR, `issue-${issueNumber}`, filename);
}

/**
 * Get the relative path for a design document (from repo root)
 * @returns Relative path: "design-docs/issue-{N}/product-design.md"
 */
export function getDesignDocRelativePath(issueNumber: number, type: DesignDocType): string {
    const filename = getDesignDocFilename(type);
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
export function writeDesignDoc(issueNumber: number, type: DesignDocType, content: string): string {
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
 * Read design document — tries S3 first, falls back to filesystem.
 * Async version that supports the new S3-backed storage.
 * @returns File content, or null if not found in either location
 */
export async function readDesignDocAsync(issueNumber: number, type: DesignDocType): Promise<string | null> {
    // Try S3 first
    const s3Content = await readDesignFromS3(issueNumber, type);
    if (s3Content) return s3Content;

    // Fall back to filesystem for backward compat
    return readDesignDoc(issueNumber, type);
}

/**
 * Read design document from design-docs directory (filesystem only, sync).
 * Kept for backward compatibility and for use during agent execution
 * (when the file is on the current branch).
 * @returns File content, or null if file doesn't exist
 */
export function readDesignDoc(issueNumber: number, type: DesignDocType): string | null {
    const fullPath = getDesignDocFullPath(issueNumber, type);

    if (!fs.existsSync(fullPath)) {
        return null;
    }

    return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Check if design document exists
 */
export function designDocExists(issueNumber: number, type: DesignDocType): boolean {
    const fullPath = getDesignDocFullPath(issueNumber, type);
    return fs.existsSync(fullPath);
}

/**
 * Delete design document
 * @returns true if file was deleted, false if it didn't exist
 */
export function deleteDesignDoc(issueNumber: number, type: DesignDocType): boolean {
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
