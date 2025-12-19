/**
 * Image Compression Utilities
 * 
 * Client-side image compression to reduce file sizes before upload.
 */

// Maximum dimensions for screenshots
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

// JPEG quality for compression (0.0 - 1.0)
const JPEG_QUALITY = 0.85;

export interface ImageCompressionResult {
    dataUrl: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
}

/**
 * Compress an image file to reduce size before upload
 * 
 * @param file - The image file to compress
 * @param maxSizeBytes - Maximum allowed size in bytes (default: 1MB)
 * @returns Promise with compressed image data
 */
export async function compressImage(
    file: File,
    maxSizeBytes = 1024 * 1024 // 1MB default
): Promise<ImageCompressionResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => reject(new Error('Failed to read image file'));

        reader.onload = (e) => {
            const img = new Image();

            img.onerror = () => reject(new Error('Failed to load image'));

            img.onload = () => {
                try {
                    // Calculate new dimensions while maintaining aspect ratio
                    let { width, height } = img;

                    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                        width = Math.floor(width * ratio);
                        height = Math.floor(height * ratio);
                    }

                    // Create canvas for compression
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Failed to get canvas context'));
                        return;
                    }

                    // Draw resized image
                    ctx.drawImage(img, 0, 0, width, height);

                    // Try different compression qualities if needed
                    let quality = JPEG_QUALITY;
                    let dataUrl = canvas.toDataURL('image/jpeg', quality);

                    // If still too large, reduce quality further
                    while (dataUrl.length > maxSizeBytes && quality > 0.3) {
                        quality -= 0.1;
                        dataUrl = canvas.toDataURL('image/jpeg', quality);
                    }

                    const originalSize = file.size;
                    const compressedSize = Math.round(dataUrl.length * 0.75); // Approximate base64 overhead
                    const compressionRatio = compressedSize / originalSize;

                    resolve({
                        dataUrl,
                        originalSize,
                        compressedSize,
                        compressionRatio,
                    });
                } catch (error) {
                    reject(error instanceof Error ? error : new Error('Compression failed'));
                }
            };

            img.src = e.target?.result as string;
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Validate image size before upload
 */
export function validateImageSize(file: File, maxSizeBytes: number): { valid: boolean; message?: string } {
    if (file.size > maxSizeBytes) {
        return {
            valid: false,
            message: `Image is too large (${formatBytes(file.size)}). Maximum size is ${formatBytes(maxSizeBytes)}.`,
        };
    }
    return { valid: true };
}

