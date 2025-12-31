import { ObjectId } from 'mongodb';
import { ApiHandlerContext, DeletePlanWorkoutRequest, DeletePlanWorkoutResponse } from '../types';
import { planWorkouts, trainingPlans } from '@/server/database';

export const deletePlanWorkout = async (
    request: DeletePlanWorkoutRequest,
    context: ApiHandlerContext
): Promise<DeletePlanWorkoutResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.workoutId) {
            return { error: 'Workout ID is required' };
        }

        // Handle temp IDs from optimistic updates - these workouts were never persisted
        // Return success since the optimistic UI already removed it
        if (request.workoutId.startsWith('temp-') || !ObjectId.isValid(request.workoutId)) {
            return { success: true };
        }

        // Verify plan exists and belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Delete the workout (scoped to user and plan)
        const deleted = await planWorkouts.deletePlanWorkout(
            request.workoutId,
            context.userId,
            request.planId
        );

        if (!deleted) {
            return { error: 'Workout not found' };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('Delete plan workout error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to delete plan workout' };
    }
};
