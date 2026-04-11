import type { ApiHandlerContext } from '@/apis/types';
import type { UploadOverrideImageRequest, UploadOverrideImageResponse } from '../types';
import { fileStorageAPI, isBase64Data } from '@/server/template/blob';

/**
 * Upload an image to be used as a plan-exercise override `imageUrl`.
 *
 * The client converts a picked file to a base64 data URL, posts it here,
 * and receives the Vercel Blob URL. The client then writes that URL into
 * the plan-exercise override via the store, and the normal debounced
 * `plan-data/sync` persists it alongside the rest of the overrides.
 *
 * Kept deliberately separate from the bulk sync path so image payloads
 * never enter the offline sync queue.
 */
export async function uploadOverrideImage(
    request: UploadOverrideImageRequest,
    context: ApiHandlerContext
): Promise<UploadOverrideImageResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!request.imageBase64 || !isBase64Data(request.imageBase64)) {
            return { error: 'A base64-encoded image is required' };
        }

        if (!process.env.BLOB_READ_WRITE_TOKEN) {
            return {
                error: 'Image upload is not available. Please configure blob storage (BLOB_READ_WRITE_TOKEN).',
            };
        }

        try {
            const uploadResult = await fileStorageAPI.uploadBase64Image(request.imageBase64, {
                folder: `plan-exercise-overrides/${context.userId}`,
                filename: `override-${Date.now()}`,
            });
            return { imageUrl: uploadResult.url };
        } catch (uploadError) {
            const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown error';
            console.error('Failed to upload plan-exercise override image:', errorMessage);
            return { error: `Failed to upload image: ${errorMessage}` };
        }
    } catch (error) {
        console.error('Error in uploadOverrideImage:', error);
        return { error: 'Failed to upload image' };
    }
}
