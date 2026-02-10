/**
 * Mock design files — in-memory design document storage.
 */

const designDocs = new Map<string, string>();

function makeKey(issueNumber: number, type: string): string {
    return `${issueNumber}:${type}`;
}

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

export function resetDesignFiles(): void {
    designDocs.clear();
}
