import { ApiHandlerContext, DeletePlanRequest, DeletePlanResponse } from '../types';
import {
    trainingPlans,
    planExercises,
    weeklyProgress,
    exerciseProgress,
    setLogs,
} from '@/server/database';
import { toStringId } from '@/server/template/utils';
import { defineApiMeta } from '@/apis/types';
import { z } from 'zod';

export const apiMeta = defineApiMeta<DeletePlanRequest>()({
    description: "Permanently delete a training plan and its exercises. Destructive — confirm with the user first.",
    inputSchema: {
        planId: z.string().describe('Plan id to delete.'),
    },
    agentExposed: true,
    mutates: true,
});

export const deletePlan = async (
    request: DeletePlanRequest,
    context: ApiHandlerContext
): Promise<DeletePlanResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        // Verify plan exists and belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Cascade delete all related data
        // 1. Delete all set logs for this plan
        await setLogs.deleteSetLogsByPlanId(request.planId);

        // 2. Get all weekly progress for this plan and delete exercise progress
        // TODO: [N+1 QUERY] This loop deletes exercise progress one week at a time (N delete operations).
        // Fix: Add `deleteExerciseProgressByWeekIds(weekIds: string[])` to exerciseProgress collection.
        // This would use `collection.deleteMany({ weeklyProgressId: { $in: weekIds } })`.
        const weeklyProgressList = await weeklyProgress.findAllWeeklyProgress(request.planId);
        for (const wp of weeklyProgressList) {
            await exerciseProgress.deleteExerciseProgressByWeekId(toStringId(wp._id));
        }

        // 3. Delete all weekly progress
        await weeklyProgress.deleteWeeklyProgressByPlanId(request.planId);

        // 4. Delete all plan exercises
        await planExercises.deleteExercisesByPlanId(request.planId);

        // 5. Finally delete the plan itself
        const deleted = await trainingPlans.deletePlan(request.planId, context.userId);

        if (!deleted) {
            return { error: 'Failed to delete plan' };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('Delete plan error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to delete plan' };
    }
};


