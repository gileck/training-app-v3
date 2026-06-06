import {
    ApiHandlerContext,
    DeletePlanExerciseRequest,
    DeletePlanExerciseResponse,
} from '../types';
import { trainingPlans, planExercises, exerciseProgress, setLogs } from '@/server/database';
import { defineApiMeta } from '@/apis/types';
import { z } from 'zod';

export const apiMeta = defineApiMeta<DeletePlanExerciseRequest>()({
    description: "Remove an exercise from a plan. Destructive — confirm with the user first.",
    inputSchema: {
        planExerciseId: z.string().describe('The plan-exercise id to delete.'),
    },
    agentExposed: true,
    mutates: true,
});

export const deletePlanExercise = async (
    request: DeletePlanExerciseRequest,
    context: ApiHandlerContext
): Promise<DeletePlanExerciseResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planExerciseId) {
            return { error: 'Plan exercise ID is required' };
        }

        // Get the plan exercise
        const exercise = await planExercises.findPlanExerciseById(request.planExerciseId);
        if (!exercise) {
            return { error: 'Exercise not found' };
        }

        // Verify plan belongs to user
        const plan = await trainingPlans.findPlanById(exercise.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Cascade delete related data
        // 1. Delete all set logs for this exercise
        await setLogs.deleteSetLogsByPlanExerciseId(request.planExerciseId);

        // 2. Delete all exercise progress for this exercise
        await exerciseProgress.deleteExerciseProgressByPlanExerciseId(request.planExerciseId);

        // 3. Delete the plan exercise itself
        const deleted = await planExercises.deletePlanExercise(request.planExerciseId);

        if (!deleted) {
            return { error: 'Failed to delete exercise' };
        }

        await trainingPlans.touchPlan(exercise.planId);
        return { success: true };
    } catch (error: unknown) {
        console.error('Delete plan exercise error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to delete exercise' };
    }
};


