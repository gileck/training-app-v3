import {
    GetExerciseHistoryRequest,
    GetExerciseHistoryResponse,
    ExerciseHistoryEntry,
} from '../types';
import { planExercises, setLogs, trainingPlans } from '@/server/database';
import type { ApiHandlerContext } from '@/apis/types';
import { defineApiMeta } from '@/apis/types';
import { z } from 'zod';
import { toStringId, toQueryId } from '@/server/template/utils';

export const apiMeta = defineApiMeta<GetExerciseHistoryRequest>()({
    description: "Get the user's logged history for one specific exercise over time (e.g. to see how a lift has progressed). Look up exerciseDefId via exercise-definitions/list.",
    inputSchema: {
        exerciseDefId: z.string().describe('Exercise definition id (from exercise-definitions/list).'),
        limit: z.number().int().optional().describe('Max entries to return (default 20).'),
    },
    agentExposed: true,
    mutates: false,
});

export async function getExerciseHistory(
    request: GetExerciseHistoryRequest,
    context: ApiHandlerContext
): Promise<GetExerciseHistoryResponse> {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.exerciseDefId) {
            return { error: 'Exercise definition ID is required' };
        }

        const limit = request.limit || 20;

        // Find all plan exercises that use this exercise definition (handles both ObjectId and UUID)
        const exerciseDefId = toQueryId(request.exerciseDefId);
        const planExercisesList = await planExercises.findPlanExercisesByExerciseDefId(exerciseDefId);

        if (planExercisesList.length === 0) {
            return { history: [] };
        }

        const planExerciseIds = planExercisesList.map(pe => toStringId(pe._id));

        // Get set logs for all these plan exercises
        const logs = await setLogs.findSetLogsByExerciseDefId(
            context.userId,
            request.exerciseDefId,
            planExerciseIds,
            limit * 10 // Get more to aggregate by date
        );

        if (logs.length === 0) {
            return { history: [] };
        }

        // Create maps for lookups (handles both ObjectId and UUID)
        const planExerciseMap = new Map(
            planExercisesList.map(pe => [toStringId(pe._id), pe])
        );

        // Get all plan IDs
        const planIds = [...new Set(planExercisesList.map(pe => toStringId(pe.planId)))];
        const plans = await trainingPlans.findPlansByIds(planIds);
        const planMap = new Map(plans.map(p => [toStringId(p._id), p]));

        // Aggregate logs by date and week
        const aggregated = new Map<string, ExerciseHistoryEntry>();

        for (const log of logs) {
            const date = new Date(log.completedAt).toISOString().split('T')[0];
            const planExerciseIdStr = toStringId(log.planExerciseId);
            const planIdStr = toStringId(log.planId);
            const planExercise = planExerciseMap.get(planExerciseIdStr);
            const plan = planExercise ? planMap.get(toStringId(planExercise.planId)) : null;
            
            const key = `${date}-${log.weekNumber}-${planIdStr}`;
            
            const existing = aggregated.get(key);
            if (existing) {
                existing.setsCompleted += 1;
            } else {
                aggregated.set(key, {
                    date,
                    planName: plan?.name || 'Unknown Plan',
                    weekNumber: log.weekNumber,
                    setsCompleted: 1,
                });
            }
        }

        // Sort by date (most recent first) and limit
        const history = Array.from(aggregated.values())
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, limit);

        return { history };
    } catch (error) {
        console.error('Error getting exercise history:', error);
        return { error: 'Failed to get exercise history' };
    }
}

