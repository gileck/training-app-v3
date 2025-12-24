import { ObjectId } from 'mongodb';
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

        // Check if this is a temporary ID (from optimistic update that hasn't synced)
        if (request.workoutId.startsWith('temp-')) {
            // Temporary IDs don't exist on server - just return success
            // The optimistic update already removed it from UI
            return { success: true };
        }

        // Validate ObjectId format
        if (!ObjectId.isValid(request.workoutId)) {
            return { error: 'Invalid workout ID format' };
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


