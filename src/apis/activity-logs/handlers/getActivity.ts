import { ObjectId } from 'mongodb';
import type { ApiHandlerContext } from '@/apis/types';
import type { GetActivityRequest, GetActivityResponse, ActivityLogEntry } from '../types';
import * as setLogs from '@/server/database/collections/setLogs';
import * as planExercises from '@/server/database/collections/planExercises';
import * as exerciseDefinitions from '@/server/database/collections/exerciseDefinitions';
import * as trainingPlans from '@/server/database/collections/trainingPlans';
import { toStringId, toQueryId } from '@/server/utils';

export async function getActivity(
    request: GetActivityRequest,
    context: ApiHandlerContext
): Promise<GetActivityResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        const userId = new ObjectId(context.userId);
        const limit = Math.min(request.limit || 50, 200); // Cap at 200

        // Build filter
        const filter: Record<string, unknown> = { userId };

        if (request.planId) {
            filter.planId = toQueryId(request.planId); // Handles both ObjectId and UUID formats
        }

        if (request.startDate || request.endDate) {
            filter.completedAt = {};
            if (request.startDate) {
                (filter.completedAt as Record<string, Date>).$gte = new Date(request.startDate);
            }
            if (request.endDate) {
                // Add 1 day and use $lt to include the entire end date
                // e.g., "2025-12-26" becomes < 2025-12-27T00:00:00Z
                const endDateExclusive = new Date(request.endDate);
                endDateExclusive.setDate(endDateExclusive.getDate() + 1);
                (filter.completedAt as Record<string, Date>).$lt = endDateExclusive;
            }
        }

        // Get set logs with pagination
        const logs = await setLogs.findSetLogsByFilter(filter, limit);
        const total = await setLogs.countSetLogsByFilter(filter);

        // Enrich logs with exercise and plan info
        const activities: ActivityLogEntry[] = [];

        // Cache for exercise and plan lookups
        const exerciseCache = new Map<string, { name: string; imageUrl: string; primaryMuscle: string }>();
        const planExerciseCache = new Map<string, string>(); // planExerciseId -> exerciseDefId
        const planCache = new Map<string, string>(); // planId -> planName

        for (const log of logs) {
            // Get exercise definition ID from plan exercise (handles both ObjectId and UUID)
            const planExerciseIdStr = toStringId(log.planExerciseId);
            let exerciseDefId = planExerciseCache.get(planExerciseIdStr);
            if (!exerciseDefId) {
                const planExercise = await planExercises.findPlanExerciseById(planExerciseIdStr);
                if (planExercise) {
                    exerciseDefId = toStringId(planExercise.exerciseDefId);
                    planExerciseCache.set(planExerciseIdStr, exerciseDefId);
                }
            }

            // Get exercise definition
            let exerciseInfo = exerciseDefId ? exerciseCache.get(exerciseDefId) : undefined;
            if (!exerciseInfo && exerciseDefId) {
                const exerciseDef = await exerciseDefinitions.findExerciseById(exerciseDefId);
                if (exerciseDef) {
                    exerciseInfo = {
                        name: exerciseDef.name,
                        imageUrl: exerciseDef.imageUrl,
                        primaryMuscle: exerciseDef.primaryMuscle,
                    };
                    exerciseCache.set(exerciseDefId, exerciseInfo);
                }
            }

            // Get plan name (handles both ObjectId and UUID)
            const planIdStr = toStringId(log.planId);
            let planName = planCache.get(planIdStr);
            if (!planName) {
                const plan = await trainingPlans.findPlanById(planIdStr, context.userId);
                if (plan) {
                    planName = plan.name;
                    planCache.set(planIdStr, planName);
                }
            }

            activities.push({
                _id: toStringId(log._id),
                userId: toStringId(log.userId),
                planExerciseId: planExerciseIdStr,
                planId: planIdStr,
                weekNumber: log.weekNumber,
                setNumber: log.setNumber,
                completedAt: log.completedAt.toISOString(),
                exerciseName: exerciseInfo?.name || 'Unknown Exercise',
                exerciseImageUrl: exerciseInfo?.imageUrl || '',
                primaryMuscle: exerciseInfo?.primaryMuscle || '',
                planName: planName || 'Unknown Plan',
            });
        }

        return { activities, total };
    } catch (error) {
        console.error('Error getting activity:', error);
        return { error: 'Failed to get activity' };
    }
}
