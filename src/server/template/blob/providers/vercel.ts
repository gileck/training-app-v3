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
        return this.putBuffer(buffer, contentType, extension, options);
    }

    async uploadBuffer(
        buffer: Buffer,
        contentType: string,
        options: BlobUploadOptions = {}
    ): Promise<BlobUploadResult> {
        const extension = this.getExtensionFromContentType(contentType);
        return this.putBuffer(buffer, contentType, extension, options);
    }

    /**
     * Shared upload path. Builds the pathname (with sane handling of
     * a caller-supplied filename + extension) and calls Vercel `put`
     * with `addRandomSuffix: true` so colliding filenames (e.g. the
     * browser names every paste-screenshot "image.png") still land at
     * unique URLs. The suffix lives in the URL, not the pathname.
     */
    private async putBuffer(
        buffer: Buffer,
        contentType: string,
        extension: string,
        options: BlobUploadOptions
    ): Promise<BlobUploadResult> {
        const callerName = options.filename;
        // Use callerName as-is when it already has an extension —
        // otherwise generateFilename's unconditional append produces
        // "image.png.png".
        const callerHasExt =
            !!callerName && /\.[^./\\]+$/.test(callerName);
        const filename = callerHasExt
            ? callerName
            : generateFilename(callerName, extension);
        const pathname = options.folder
            ? `${options.folder}/${filename}`
            : filename;

        const blob = await put(pathname, buffer, {
            access: 'public',
            contentType: options.contentType || contentType,
            addRandomSuffix: true,
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

