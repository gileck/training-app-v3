/**
 * Blob Storage Utilities
 * 
 * Shared utilities for blob storage operations.
 */

export interface ParsedBase64Image {
    buffer: Buffer;
    contentType: string;
    extension: string;
}

/**
 * Parse a base64 data URL into buffer and metadata
 */
export function parseBase64Image(base64Data: string): ParsedBase64Image {
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
        throw new Error('Invalid base64 image format. Expected data:image/...;base64,...');
    }

    const contentType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    const extension = getExtensionFromContentType(contentType);

    return { buffer, contentType, extension };
}

/**
 * Get file extension from content type
 */
export function getExtensionFromContentType(contentType: string): string {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('svg')) return 'svg';
    if (contentType.includes('pdf')) return 'pdf';
    return 'bin';
}

/**
 * Generate a unique filename with timestamp
 */
export function generateFilename(customName?: string, extension = 'bin'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const baseName = customName || `file-${timestamp}-${random}`;
    return `${baseName}.${extension}`;
}

/**
 * Check if a string is a URL
 */
export function isUrl(str: string): boolean {
    return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Check if a string is base64 data
 */
export function isBase64Data(str: string): boolean {
    return str.startsWith('data:');
}

