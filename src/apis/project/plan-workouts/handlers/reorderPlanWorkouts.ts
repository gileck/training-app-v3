import { isObjectIdFormat, isUuidFormat } from '@/server/template/utils';
import { ApiHandlerContext, ReorderPlanWorkoutsRequest, ReorderPlanWorkoutsResponse } from '../types';
import { planWorkouts, trainingPlans } from '@/server/database';

export const reorderPlanWorkouts = async (
    request: ReorderPlanWorkoutsRequest,
    context: ApiHandlerContext
): Promise<ReorderPlanWorkoutsResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.workoutIds || request.workoutIds.length === 0) {
            return { error: 'Workout IDs are required' };
        }

        // Filter out temp IDs from optimistic updates - only reorder persisted workouts
        // Accept both MongoDB ObjectId format (legacy) and UUID format (client-generated)
        const validWorkoutIds = request.workoutIds.filter(
            (id) => !id.startsWith('temp-') && (isObjectIdFormat(id) || isUuidFormat(id))
        );

        // If all IDs are temp IDs, return success (nothing to reorder on server)
        if (validWorkoutIds.length === 0) {
            return { success: true };
        }

        // Verify plan exists and belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Reorder the workouts (only valid IDs)
        const success = await planWorkouts.reorderPlanWorkouts(
            context.userId,
            request.planId,
            validWorkoutIds
        );

        if (!success) {
            return { error: 'Failed to reorder workouts' };
        }

        await trainingPlans.touchPlan(request.planId);
        return { success: true };
    } catch (error: unknown) {
        console.error('Reorder plan workouts error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to reorder plan workouts' };
    }
};
