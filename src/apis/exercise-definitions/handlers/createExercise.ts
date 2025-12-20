import { ObjectId } from 'mongodb';
import type { ApiHandlerContext } from '@/apis/types';
import type { CreateExerciseRequest, CreateExerciseResponse } from '../types';
import * as exerciseDefinitions from '@/server/database/collections/exerciseDefinitions';
import { fileStorageAPI, isBase64Data } from '@/server/blob';

export async function createExercise(
    request: CreateExerciseRequest,
    context: ApiHandlerContext
): Promise<CreateExerciseResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        // Validate required fields
        if (!request.name || request.name.trim().length === 0) {
            return { error: 'Exercise name is required' };
        }

        if (!request.primaryMuscle || request.primaryMuscle.trim().length === 0) {
            return { error: 'Primary muscle is required' };
        }

        // Upload image if provided
        let imageUrl = '';
        if (request.imageBase64 && isBase64Data(request.imageBase64)) {
            try {
                const uploadResult = await fileStorageAPI.uploadBase64Image(request.imageBase64, {
                    folder: `exercises/${context.userId}`,
                    filename: request.name.toLowerCase().replace(/\s+/g, '-'),
                });
                imageUrl = uploadResult.url;
            } catch (uploadError) {
                console.error('Failed to upload exercise image:', uploadError);
                // Continue without image rather than fail the entire request
            }
        }

        // Create exercise
        const now = new Date();
        const exerciseData = {
            name: request.name.trim(),
            imageUrl,
            primaryMuscle: request.primaryMuscle.trim(),
            secondaryMuscles: request.secondaryMuscles || [],
            type: request.type || 'Strength',
            isBodyweight: request.isBodyweight || false,
            isStatic: request.isStatic || false,
            isSystem: false,
            userId: new ObjectId(context.userId),
            createdAt: now,
            updatedAt: now,
        };

        const exercise = await exerciseDefinitions.createExercise(exerciseData);

        return {
            exercise: {
                _id: exercise._id.toHexString(),
                name: exercise.name,
                imageUrl: exercise.imageUrl,
                primaryMuscle: exercise.primaryMuscle,
                secondaryMuscles: exercise.secondaryMuscles,
                type: exercise.type,
                isBodyweight: exercise.isBodyweight,
                isStatic: exercise.isStatic,
                isSystem: exercise.isSystem,
                userId: exercise.userId?.toHexString(),
                createdAt: exercise.createdAt.toISOString(),
                updatedAt: exercise.updatedAt.toISOString(),
            },
        };
    } catch (error) {
        console.error('Error creating exercise:', error);
        return { error: 'Failed to create exercise' };
    }
}


