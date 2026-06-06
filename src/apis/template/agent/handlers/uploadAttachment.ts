/**
 * Upload a single attachment file for use in an agent conversation.
 *
 * Client → this handler (base64 body) → fileStorageAPI.uploadBuffer →
 * Vercel Blob (or S3 depending on `BLOB_PROVIDER`). Returns the
 * public URL + metadata, which the client then attaches to a
 * `sendMessage` call.
 *
 * Cap: 10 MB. Anything larger should be split / linked externally.
 */

import { fileStorageAPI } from '@/server/template/blob';
import type { ApiHandlerContext } from '@/apis/types';
import type {
    UploadAttachmentRequest,
    UploadAttachmentResponse,
} from '../types';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export const uploadAttachment = async (
    request: UploadAttachmentRequest,
    context: ApiHandlerContext
): Promise<UploadAttachmentResponse> => {
    if (!context.userId) return { error: 'Not authenticated' };
    if (!request.base64) return { error: 'base64 is required' };
    if (!request.name) return { error: 'name is required' };
    if (!request.contentType) return { error: 'contentType is required' };

    let buffer: Buffer;
    try {
        buffer = Buffer.from(request.base64, 'base64');
    } catch (err) {
        return {
            error:
                err instanceof Error
                    ? `Invalid base64 payload: ${err.message}`
                    : 'Invalid base64 payload',
        };
    }
    if (buffer.byteLength === 0) {
        return { error: 'Attachment is empty (decoded to 0 bytes)' };
    }
    if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
        return {
            error: `Attachment is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB; max is ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`,
        };
    }

    try {
        const result = await fileStorageAPI.uploadBuffer(
            buffer,
            request.contentType,
            {
                // Per-user folder so a malicious filename can't collide
                // across users. Random suffix is added by the provider
                // (Vercel Blob: addRandomSuffix; S3: timestamp+uuid).
                folder: `agent-attachments/${context.userId}`,
                filename: request.name,
            }
        );
        return {
            attachment: {
                url: result.url,
                contentType: request.contentType,
                name: request.name,
                size: buffer.byteLength,
            },
        };
    } catch (err) {
        console.error('uploadAttachment failed:', err);
        return {
            error:
                err instanceof Error
                    ? err.message
                    : 'Failed to upload attachment',
        };
    }
};
