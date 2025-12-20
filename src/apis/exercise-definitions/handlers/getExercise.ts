import { ApiHandlerContext, GetExerciseRequest, GetExerciseResponse } from '../types';
import { exerciseDefinitions } from '@/server/database';

export const getExercise = async (
    request: GetExerciseRequest,
    context: ApiHandlerContext
): Promise<GetExerciseResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.exerciseId) {
            return { error: 'Exercise ID is required' };
        }

        const exercise = await exerciseDefinitions.findExerciseById(request.exerciseId);

        if (!exercise) {
            return { error: 'Exercise not found' };
        }

        // Check if user has access to this exercise
        // User can access system exercises OR their own custom exercises
        if (!exercise.isSystem && exercise.userId?.toHexString() !== context.userId) {
            return { error: 'Exercise not found' };
        }

        // Convert to client format
        const exerciseClient = {
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
        };

        return { exercise: exerciseClient };
    } catch (error: unknown) {
        console.error('Get exercise error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get exercise' };
    }
};


