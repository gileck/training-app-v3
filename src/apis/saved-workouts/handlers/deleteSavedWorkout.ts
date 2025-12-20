import type { ApiHandlerContext } from '@/apis/types';
import type { DeleteSavedWorkoutRequest, DeleteSavedWorkoutResponse } from '../types';
import * as savedWorkouts from '@/server/database/collections/savedWorkouts';

export async function deleteSavedWorkout(
    request: DeleteSavedWorkoutRequest,
    context: ApiHandlerContext
): Promise<DeleteSavedWorkoutResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!request.workoutId) {
            return { error: 'Workout ID is required' };
        }

        const deleted = await savedWorkouts.deleteWorkout(request.workoutId, context.userId);
        if (!deleted) {
            return { error: 'Workout not found or already deleted' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error deleting saved workout:', error);
        return { error: 'Failed to delete saved workout' };
    }
}


