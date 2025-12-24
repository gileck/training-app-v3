import { ObjectId } from 'mongodb';
import {
    GetExerciseHistoryRequest,
    GetExerciseHistoryResponse,
    ExerciseHistoryEntry,
} from '../types';
import { planExercises, setLogs, trainingPlans } from '@/server/database';
import type { ApiHandlerContext } from '@/apis/types';

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

        // Find all plan exercises that use this exercise definition
        const exerciseDefIdObj = new ObjectId(request.exerciseDefId);
        const planExercisesList = await planExercises.findPlanExercisesByExerciseDefId(exerciseDefIdObj);

        if (planExercisesList.length === 0) {
            return { history: [] };
        }

        const planExerciseIds = planExercisesList.map(pe => pe._id.toHexString());

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

        // Create maps for lookups
        const planExerciseMap = new Map(
            planExercisesList.map(pe => [pe._id.toHexString(), pe])
        );

        // Get all plan IDs
        const planIds = [...new Set(planExercisesList.map(pe => pe.planId.toHexString()))];
        const plans = await trainingPlans.findPlansByIds(planIds);
        const planMap = new Map(plans.map(p => [p._id.toHexString(), p]));

        // Aggregate logs by date and week
        const aggregated = new Map<string, ExerciseHistoryEntry>();

        for (const log of logs) {
            const date = new Date(log.completedAt).toISOString().split('T')[0];
            const planExercise = planExerciseMap.get(log.planExerciseId.toHexString());
            const plan = planExercise ? planMap.get(planExercise.planId.toHexString()) : null;
            
            const key = `${date}-${log.weekNumber}-${log.planId.toHexString()}`;
            
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

