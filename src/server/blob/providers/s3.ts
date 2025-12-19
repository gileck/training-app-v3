/**
 * AWS S3 Blob Storage Provider
 * 
 * Implementation using @aws-sdk/client-s3.
 * Requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION environment variables.
 */

import { uploadFile, deleteFile, getSignedFileUrl } from '@/server/s3/sdk';
import type { BlobStorageProvider, BlobUploadResult, BlobUploadOptions } from '../types';
import { parseBase64Image, generateFilename } from '../utils';

export class S3BlobProvider implements BlobStorageProvider {
    name = 's3' as const;

    private signedUrlExpiry: number;

    constructor(signedUrlExpiry = 86400) { // Default 24 hours
        this.signedUrlExpiry = signedUrlExpiry;
    }

    async uploadBase64Image(
        base64Data: string,
        options: BlobUploadOptions = {}
    ): Promise<BlobUploadResult> {
        const { buffer, contentType, extension } = parseBase64Image(base64Data);
        
        const filename = generateFilename(options.filename, extension);
        const folder = options.folder || '';
        const key = folder ? `${folder}/${filename}` : filename;

        await uploadFile({
            content: buffer,
            fileName: key,
            contentType: options.contentType || contentType,
        });

        // Generate signed URL for immediate use
        const url = await getSignedFileUrl(key, this.signedUrlExpiry);

        return {
            url,
            key,
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
        const key = folder ? `${folder}/${filename}` : filename;

        await uploadFile({
            content: buffer,
            fileName: key,
            contentType: options.contentType || contentType,
        });

        const url = await getSignedFileUrl(key, this.signedUrlExpiry);

        return {
            url,
            key,
            size: buffer.length,
        };
    }

    async delete(urlOrKey: string): Promise<void> {
        // Extract key from URL if needed
        const key = this.extractKeyFromUrl(urlOrKey);
        await deleteFile(key);
    }

    async getUrl(key: string): Promise<string> {
        return getSignedFileUrl(key, this.signedUrlExpiry);
    }

    private extractKeyFromUrl(urlOrKey: string): string {
        if (!urlOrKey.startsWith('http')) {
            return urlOrKey;
        }
        // Extract key from S3 URL
        try {
            const url = new URL(urlOrKey);
            // Remove leading slash and bucket prefix if present
            return url.pathname.replace(/^\//, '').split('/').slice(1).join('/');
        } catch {
            return urlOrKey;
        }
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

