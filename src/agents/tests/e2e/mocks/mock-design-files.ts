/**
 * Mock design files — in-memory design document storage.
 * Supports both filesystem and S3 operations (all in-memory).
 */

const designDocs = new Map<string, string>();
const s3Docs = new Map<string, string>();

function makeKey(issueNumber: number, type: string): string {
    return `${issueNumber}:${type}`;
}

// ============================================================
// S3 KEY HELPERS
// ============================================================

export function getDesignS3Key(issueNumber: number, type: string): string {
    return `design-docs/issue-${issueNumber}/${type}.md`;
}

// ============================================================
// S3 OPERATIONS (mock)
// ============================================================

export async function saveDesignToS3(issueNumber: number, type: string, content: string): Promise<string> {
    const key = makeKey(issueNumber, type);
    s3Docs.set(key, content);
    return getDesignS3Key(issueNumber, type);
}

export async function readDesignFromS3(issueNumber: number, type: string): Promise<string | null> {
    return s3Docs.get(makeKey(issueNumber, type)) || null;
}

export async function deleteDesignFromS3(issueNumber: number, type?: string): Promise<void> {
    if (type) {
        s3Docs.delete(makeKey(issueNumber, type));
    } else {
        for (const key of s3Docs.keys()) {
            if (key.startsWith(`${issueNumber}:`)) {
                s3Docs.delete(key);
            }
        }
    }
}

// ============================================================
// FILESYSTEM OPERATIONS (mock)
// ============================================================

export function getDesignDocFullPath(issueNumber: number, type: string): string {
    return `/mock/design-docs/issue-${issueNumber}/${type}.md`;
}

export function getDesignDocRelativePath(issueNumber: number, type: string): string {
    return `design-docs/issue-${issueNumber}/${type}.md`;
}

export function getIssueDesignDir(issueNumber: number): string {
    return `/mock/design-docs/issue-${issueNumber}`;
}

export function writeDesignDoc(issueNumber: number, type: string, content: string): string {
    designDocs.set(makeKey(issueNumber, type), content);
    return getDesignDocFullPath(issueNumber, type);
}

export function readDesignDoc(issueNumber: number, type: string): string | null {
    return designDocs.get(makeKey(issueNumber, type)) || null;
}

/**
 * Async read — tries S3 first, falls back to filesystem (in-memory mock).
 */
export async function readDesignDocAsync(issueNumber: number, type: string): Promise<string | null> {
    const s3Content = s3Docs.get(makeKey(issueNumber, type));
    if (s3Content) return s3Content;
    return designDocs.get(makeKey(issueNumber, type)) || null;
}

export function designDocExists(issueNumber: number, type: string): boolean {
    return designDocs.has(makeKey(issueNumber, type));
}

export function deleteDesignDoc(issueNumber: number, type: string): boolean {
    return designDocs.delete(makeKey(issueNumber, type));
}

export function deleteIssueDesignDir(issueNumber: number): boolean {
    let deleted = false;
    for (const key of designDocs.keys()) {
        if (key.startsWith(`${issueNumber}:`)) {
            designDocs.delete(key);
            deleted = true;
        }
    }
    return deleted;
}

// ============================================================
// TEST HELPERS
// ============================================================

export function resetDesignFiles(): void {
    designDocs.clear();
    s3Docs.clear();
}

export function getS3Docs(): Map<string, string> {
    return s3Docs;
}

/**
 * Direct access to set S3 docs for tests (used by S3 SDK mock)
 */
export function setS3Doc(key: string, content: string): void {
    // Extract issue number and type from key pattern: design-docs/issue-{N}/{type}.md
    // or design-docs/issue-{N}/product-design-{optionId}.md
    s3Docs.set(key, content);
}

export function getS3Doc(key: string): string | undefined {
    return s3Docs.get(key);
}
