import type { ApiHandlerContext } from '@/apis/types';
import type { ReorderSavedWorkoutsRequest, ReorderSavedWorkoutsResponse } from '../types';
import * as savedWorkouts from '@/server/database/collections/savedWorkouts';

export async function reorderSavedWorkouts(
    request: ReorderSavedWorkoutsRequest,
    context: ApiHandlerContext
): Promise<ReorderSavedWorkoutsResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!request.workoutIds || request.workoutIds.length === 0) {
            return { error: 'Workout IDs are required' };
        }

        const success = await savedWorkouts.reorderWorkouts(context.userId, request.workoutIds);
        
        return { success };
    } catch (error) {
        console.error('Error reordering saved workouts:', error);
        return { error: 'Failed to reorder saved workouts' };
    }
}




