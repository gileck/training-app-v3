import type { ApiHandlerContext } from '@/apis/types';
import type { ReorderPlanExercisesRequest, ReorderPlanExercisesResponse } from '../types';
import * as trainingPlans from '@/server/database/collections/project/trainingPlans';
import * as planExercises from '@/server/database/collections/project/planExercises';

export async function reorderPlanExercises(
    request: ReorderPlanExercisesRequest,
    context: ApiHandlerContext
): Promise<ReorderPlanExercisesResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.exerciseIds || request.exerciseIds.length === 0) {
            return { error: 'Exercise IDs are required' };
        }

        // Verify plan belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Reorder the exercises
        await planExercises.reorderExercises(request.planId, request.exerciseIds);

        return { success: true };
    } catch (error) {
        console.error('Error reordering plan exercises:', error);
        return { error: 'Failed to reorder exercises' };
    }
}


