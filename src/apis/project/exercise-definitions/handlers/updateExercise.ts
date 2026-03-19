import type { ApiHandlerContext } from '@/apis/types';
import type { UpdateExerciseRequest, UpdateExerciseResponse } from '../types';
import * as exerciseDefinitions from '@/server/database/collections/project/exerciseDefinitions';
import { fileStorageAPI, isBase64Data } from '@/server/template/blob';
import { toStringId } from '@/server/template/utils';

export async function updateExercise(
    request: UpdateExerciseRequest,
    context: ApiHandlerContext
): Promise<UpdateExerciseResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!request.exerciseId) {
            return { error: 'Exercise ID is required' };
        }

        // Check exercise exists and belongs to user (not a system exercise)
        const existingExercise = await exerciseDefinitions.findExerciseById(request.exerciseId);
        if (!existingExercise) {
            return { error: 'Exercise not found' };
        }

        if (existingExercise.isSystem) {
            return { error: 'Cannot modify system exercises' };
        }

        if ((existingExercise.userId ? toStringId(existingExercise.userId) : undefined) !== context.userId) {
            return { error: 'You can only modify your own exercises' };
        }

        // Build update object
        const update: Record<string, unknown> = {
            updatedAt: new Date(),
        };

        if (request.name !== undefined) {
            update.name = request.name.trim();
        }

        if (request.primaryMuscle !== undefined) {
            update.primaryMuscle = request.primaryMuscle.trim();
        }

        if (request.secondaryMuscles !== undefined) {
            update.secondaryMuscles = request.secondaryMuscles;
        }

        if (request.type !== undefined) {
            update.type = request.type;
        }

        if (request.isBodyweight !== undefined) {
            update.isBodyweight = request.isBodyweight;
        }

        if (request.isStatic !== undefined) {
            update.isStatic = request.isStatic;
        }

        // Handle image upload
        if (request.imageBase64 && isBase64Data(request.imageBase64)) {
            try {
                // Delete old image if it exists
                if (existingExercise.imageUrl) {
                    await fileStorageAPI.delete(existingExercise.imageUrl).catch(() => {});
                }

                const uploadResult = await fileStorageAPI.uploadBase64Image(request.imageBase64, {
                    folder: `exercises/${context.userId}`,
                    filename: (request.name || existingExercise.name).toLowerCase().replace(/\s+/g, '-'),
                });
                update.imageUrl = uploadResult.url;
            } catch (uploadError) {
                console.error('Failed to upload exercise image:', uploadError);
                // Continue without image update rather than fail
            }
        }

        const updatedExercise = await exerciseDefinitions.updateExercise(
            request.exerciseId,
            context.userId,
            update as exerciseDefinitions.ExerciseDefinitionUpdate
        );

        if (!updatedExercise) {
            return { error: 'Failed to update exercise' };
        }

        return {
            exercise: {
                _id: toStringId(updatedExercise._id),
                name: updatedExercise.name,
                imageUrl: updatedExercise.imageUrl,
                primaryMuscle: updatedExercise.primaryMuscle,
                secondaryMuscles: updatedExercise.secondaryMuscles,
                type: updatedExercise.type,
                isBodyweight: updatedExercise.isBodyweight,
                isStatic: updatedExercise.isStatic,
                isSystem: updatedExercise.isSystem,
                userId: updatedExercise.userId ? toStringId(updatedExercise.userId) : undefined,
                createdAt: updatedExercise.createdAt.toISOString(),
                updatedAt: updatedExercise.updatedAt.toISOString(),
            },
        };
    } catch (error) {
        console.error('Error updating exercise:', error);
        return { error: 'Failed to update exercise' };
    }
}


