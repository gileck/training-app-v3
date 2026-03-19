/**
 * File Storage API
 * 
 * Provider-agnostic file storage with support for Vercel Blob and AWS S3.
 * 
 * Usage:
 * ```ts
 * import { fileStorageAPI } from '@/server/template/blob';
 * 
 * // Upload an image
 * const result = await fileStorageAPI.uploadBase64Image(base64Data, {
 *     folder: 'reports/screenshots',
 * });
 * console.log(result.url); // Public URL
 * ```
 * 
 * Configuration:
 * Set BLOB_PROVIDER environment variable to 'vercel' or 's3' (defaults to 'vercel').
 * 
 * For Vercel: Set BLOB_READ_WRITE_TOKEN
 * For S3: Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 */

import type { BlobStorageProvider, BlobProvider, BlobUploadResult, BlobUploadOptions } from './types';
import { VercelBlobProvider } from './providers/vercel';
import { S3BlobProvider } from './providers/s3';

// ============================================================================
// CONFIGURATION - Change this line to switch providers
// ============================================================================
const DEFAULT_PROVIDER: BlobProvider = 'vercel';
// ============================================================================

/**
 * Get the configured blob provider
 */
function getProviderFromEnv(): BlobProvider {
    const envProvider = process.env.BLOB_PROVIDER?.toLowerCase();
    if (envProvider === 'vercel' || envProvider === 's3') {
        return envProvider;
    }
    return DEFAULT_PROVIDER;
}

/**
 * Create a blob storage provider instance
 */
function createProvider(provider?: BlobProvider): BlobStorageProvider {
    const selectedProvider = provider || getProviderFromEnv();

    switch (selectedProvider) {
        case 'vercel':
            return new VercelBlobProvider();
        case 's3':
            return new S3BlobProvider();
        default:
            throw new Error(`Unknown blob provider: ${selectedProvider}`);
    }
}

// Singleton instance using configured provider
let _blobStorage: BlobStorageProvider | null = null;

/**
 * Get the blob storage instance (lazy singleton)
 */
export function getBlobStorage(): BlobStorageProvider {
    if (!_blobStorage) {
        _blobStorage = createProvider();
    }
    return _blobStorage;
}

/**
 * Default file storage API instance
 * Use this for most operations
 */
export const fileStorageAPI = {
    /**
     * Upload a base64 encoded image
     */
    async uploadBase64Image(
        base64Data: string,
        options?: BlobUploadOptions
    ): Promise<BlobUploadResult> {
        return getBlobStorage().uploadBase64Image(base64Data, options);
    },

    /**
     * Upload a buffer
     */
    async uploadBuffer(
        buffer: Buffer,
        contentType: string,
        options?: BlobUploadOptions
    ): Promise<BlobUploadResult> {
        return getBlobStorage().uploadBuffer(buffer, contentType, options);
    },

    /**
     * Delete a file
     */
    async delete(urlOrKey: string): Promise<void> {
        return getBlobStorage().delete(urlOrKey);
    },

    /**
     * Get URL for a file (generates signed URL for S3)
     */
    async getUrl(key: string): Promise<string> {
        return getBlobStorage().getUrl(key);
    },

    /**
     * Get the current provider name
     */
    getProviderName(): BlobProvider {
        return getBlobStorage().name;
    },
};

// Re-export types and utilities
export type { BlobStorageProvider, BlobProvider, BlobUploadResult, BlobUploadOptions };
export { createProvider, VercelBlobProvider, S3BlobProvider };
export { parseBase64Image, isUrl, isBase64Data } from './utils';
