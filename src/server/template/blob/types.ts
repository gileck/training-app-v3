/**
 * Blob Storage Types
 * 
 * Provider-agnostic interfaces for blob storage operations.
 */

export type BlobProvider = 'vercel' | 's3';

export interface BlobUploadResult {
    /** Public URL to access the file */
    url: string;
    /** Storage path/key of the file */
    key: string;
    /** File size in bytes */
    size?: number;
}

export interface BlobUploadOptions {
    /** Custom filename (without extension) */
    filename?: string;
    /** Folder path prefix */
    folder?: string;
    /** Content type override */
    contentType?: string;
}

export interface BlobStorageProvider {
    /** Provider name */
    name: BlobProvider;
    
    /** Upload a base64 image */
    uploadBase64Image(base64Data: string, options?: BlobUploadOptions): Promise<BlobUploadResult>;
    
    /** Upload a buffer */
    uploadBuffer(buffer: Buffer, contentType: string, options?: BlobUploadOptions): Promise<BlobUploadResult>;
    
    /** Delete a file by URL or key */
    delete(urlOrKey: string): Promise<void>;
    
    /** Get a public/signed URL for a file */
    getUrl(key: string): Promise<string>;
}

