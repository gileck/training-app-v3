/**
 * Mock S3 SDK — in-memory storage for S3 operations.
 * Used by tests where agents call `import('@/server/template/s3/sdk')` directly.
 */

const storage = new Map<string, { content: string; contentType: string }>();

export async function uploadFile(opts: {
    content: string;
    fileName: string;
    contentType?: string;
}): Promise<void> {
    storage.set(opts.fileName, {
        content: opts.content,
        contentType: opts.contentType || 'text/plain',
    });
}

export async function getFileAsString(key: string): Promise<string> {
    const item = storage.get(key);
    if (!item) throw new Error(`S3 key not found: ${key}`);
    return item.content;
}

export async function deleteFile(key: string): Promise<void> {
    storage.delete(key);
}

export async function fileExists(key: string): Promise<boolean> {
    return storage.has(key);
}

export async function listFiles(prefix: string): Promise<{ key: string }[]> {
    const results: { key: string }[] = [];
    for (const key of storage.keys()) {
        if (key.startsWith(prefix)) {
            results.push({ key });
        }
    }
    return results;
}

// ============================================================
// TEST HELPERS
// ============================================================

export function resetS3Storage(): void {
    storage.clear();
}

export function getS3Storage(): Map<string, { content: string; contentType: string }> {
    return storage;
}

export function getS3Content(key: string): string | undefined {
    return storage.get(key)?.content;
}
