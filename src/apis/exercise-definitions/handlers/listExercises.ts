import { ApiHandlerContext, ListExercisesRequest, ListExercisesResponse } from '../types';
import { exerciseDefinitions } from '@/server/database';

export const listExercises = async (
    request: ListExercisesRequest,
    context: ApiHandlerContext
): Promise<ListExercisesResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        const includeCustom = request.includeCustom !== false; // Default to true

        let exerciseList;
        if (includeCustom) {
            // Get all exercises available to user (system + custom)
            exerciseList = await exerciseDefinitions.findAllExercises(context.userId);
        } else {
            // Get only system exercises
            exerciseList = await exerciseDefinitions.findSystemExercises();
        }

        // Convert to client format
        const exercisesClient = exerciseList.map((exercise) => ({
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
        }));

        return { exercises: exercisesClient };
    } catch (error: unknown) {
        console.error('List exercises error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to list exercises' };
    }
};


