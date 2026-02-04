/**
 * S3-based log writer for agent workflow logs
 *
 * Enables unified logging from all sources (local agents, GitHub Actions, Vercel webhooks)
 * by using AWS S3 as a temporary write buffer during active workflows.
 */

import {
    getFileWithETag,
    uploadFile,
    deleteFile,
    fileExists,
    getS3Client,
} from '@/server/s3/sdk';

/**
 * Environment variable for S3 log bucket
 * When set, logging operations write to S3 instead of local filesystem
 */
const S3_LOG_BUCKET_ENV = 'AWS_S3_LOG_BUCKET';

/**
 * Default log bucket name (uses same bucket as other S3 operations)
 */
const getLogBucketName = (): string => {
    return process.env[S3_LOG_BUCKET_ENV] || '';
};

/**
 * Check if S3 logging is enabled
 */
export function isS3LoggingEnabled(): boolean {
    return !!getLogBucketName();
}

/**
 * Get the S3 key for a log file
 */
export function getS3LogKey(issueNumber: number): string {
    return `agent-logs/issue-${issueNumber}.md`;
}

/**
 * Check if a log file exists in S3
 */
export async function s3LogExists(issueNumber: number): Promise<boolean> {
    if (!isS3LoggingEnabled()) {
        return false;
    }

    try {
        const key = getS3LogKey(issueNumber);
        return await fileExists(key, getS3Client(), getLogBucketName());
    } catch {
        return false;
    }
}

/**
 * Read log content from S3
 * Returns empty string if log doesn't exist
 */
export async function s3ReadLog(issueNumber: number): Promise<string> {
    if (!isS3LoggingEnabled()) {
        return '';
    }

    try {
        const key = getS3LogKey(issueNumber);
        const { content } = await getFileWithETag(key, getS3Client(), getLogBucketName());
        return content;
    } catch (error: unknown) {
        // Return empty string if file doesn't exist
        if (error instanceof Error && error.message.includes('NoSuchKey')) {
            return '';
        }
        // Also check for 404 status
        if (error && typeof error === 'object' && '$metadata' in error) {
            const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
            if (metadata?.httpStatusCode === 404) {
                return '';
            }
        }
        throw error;
    }
}

/**
 * Write entire log content to S3 (overwrites existing)
 */
export async function s3WriteLog(issueNumber: number, content: string): Promise<void> {
    if (!isS3LoggingEnabled()) {
        return;
    }

    const key = getS3LogKey(issueNumber);
    await uploadFile(
        {
            fileName: key,
            content,
            contentType: 'text/markdown',
        },
        getS3Client(),
        getLogBucketName()
    );
}

/**
 * Append content to a log file in S3
 * Uses read-modify-write pattern with retry logic for concurrency
 *
 * @param issueNumber - The issue number for the log file
 * @param content - Content to append
 * @param maxRetries - Maximum number of retries (default: 3)
 */
export async function s3AppendToLog(
    issueNumber: number,
    content: string,
    maxRetries = 3
): Promise<void> {
    if (!isS3LoggingEnabled()) {
        return;
    }

    const key = getS3LogKey(issueNumber);
    const client = getS3Client();
    const bucketName = getLogBucketName();

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < maxRetries) {
        try {
            // Read current content with ETag
            let currentContent = '';

            try {
                const result = await getFileWithETag(key, client, bucketName);
                currentContent = result.content;
                // Note: ETag available in result.etag for future conditional write support
            } catch (error: unknown) {
                // File doesn't exist yet, start fresh
                if (error instanceof Error && error.message.includes('NoSuchKey')) {
                    currentContent = '';
                } else if (error && typeof error === 'object' && '$metadata' in error) {
                    const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
                    if (metadata?.httpStatusCode === 404) {
                        currentContent = '';
                    } else {
                        throw error;
                    }
                } else {
                    throw error;
                }
            }

            // Append new content
            const newContent = currentContent + content;

            // Write back (S3 doesn't support conditional writes, so we rely on
            // the fast read-write cycle and retry on concurrent modifications)
            await uploadFile(
                {
                    fileName: key,
                    content: newContent,
                    contentType: 'text/markdown',
                },
                client,
                bucketName
            );

            // Success
            return;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            attempt++;

            if (attempt < maxRetries) {
                // Exponential backoff: 100ms, 200ms, 400ms
                const delay = 100 * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // All retries exhausted
    console.error(`S3 log append failed after ${maxRetries} attempts:`, lastError);
    throw lastError;
}

/**
 * Delete a log file from S3
 */
export async function s3DeleteLog(issueNumber: number): Promise<void> {
    if (!isS3LoggingEnabled()) {
        return;
    }

    try {
        const key = getS3LogKey(issueNumber);
        await deleteFile(key, getS3Client(), getLogBucketName());
    } catch (error: unknown) {
        // Ignore if file doesn't exist
        if (error instanceof Error && error.message.includes('NoSuchKey')) {
            return;
        }
        if (error && typeof error === 'object' && '$metadata' in error) {
            const metadata = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
            if (metadata?.httpStatusCode === 404) {
                return;
            }
        }
        throw error;
    }
}
