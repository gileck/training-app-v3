/**
 * Vercel Blob Storage Provider
 * 
 * Implementation using @vercel/blob.
 * Requires BLOB_READ_WRITE_TOKEN environment variable.
 */

import { put, del } from '@vercel/blob';
import type { BlobStorageProvider, BlobUploadResult, BlobUploadOptions } from '../types';
import { parseBase64Image, generateFilename } from '../utils';

export class VercelBlobProvider implements BlobStorageProvider {
    name = 'vercel' as const;

    async uploadBase64Image(
        base64Data: string,
        options: BlobUploadOptions = {}
    ): Promise<BlobUploadResult> {
        const { buffer, contentType, extension } = parseBase64Image(base64Data);
        
        const filename = generateFilename(options.filename, extension);
        const folder = options.folder || '';
        const pathname = folder ? `${folder}/${filename}` : filename;

        const blob = await put(pathname, buffer, {
            access: 'public',
            contentType: options.contentType || contentType,
        });

        return {
            url: blob.url,
            key: blob.pathname,
            size: buffer.length,
        };
    }

    async uploadBuffer(
        buffer: Buffer,
        contentType: string,
        options: BlobUploadOptions = {}
    ): Promise<BlobUploadResult> {
        const extension = this.getExtensionFromContentType(contentType);
        const filename = generateFilename(options.filename, extension);
        const folder = options.folder || '';
        const pathname = folder ? `${folder}/${filename}` : filename;

        const blob = await put(pathname, buffer, {
            access: 'public',
            contentType: options.contentType || contentType,
        });

        return {
            url: blob.url,
            key: blob.pathname,
            size: buffer.length,
        };
    }

    async delete(urlOrKey: string): Promise<void> {
        await del(urlOrKey);
    }

    async getUrl(key: string): Promise<string> {
        // Vercel Blob URLs are already public and permanent
        // If key is already a URL, return it
        if (key.startsWith('http')) {
            return key;
        }
        // Otherwise, we can't reconstruct the URL without storing it
        throw new Error('Vercel Blob requires storing the full URL. Key-only lookups are not supported.');
    }

    private getExtensionFromContentType(contentType: string): string {
        if (contentType.includes('png')) return 'png';
        if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
        if (contentType.includes('gif')) return 'gif';
        if (contentType.includes('webp')) return 'webp';
        if (contentType.includes('svg')) return 'svg';
        return 'bin';
    }
}

