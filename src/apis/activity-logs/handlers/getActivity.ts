import type { ApiHandlerContext } from '@/apis/types';
import type { GetActivityRequest, GetActivityResponse, ActivityLogEntry } from '../types';
import * as setLogs from '@/server/database/collections/setLogs';
import * as planExercises from '@/server/database/collections/planExercises';
import * as exerciseDefinitions from '@/server/database/collections/exerciseDefinitions';
import * as trainingPlans from '@/server/database/collections/trainingPlans';
import { toStringId, toQueryId, toDocumentId } from '@/server/utils';

export async function getActivity(
    request: GetActivityRequest,
    context: ApiHandlerContext
): Promise<GetActivityResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        const userId = toDocumentId(context.userId);
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

        // Fetch logs and count in parallel
        const [logs, total] = await Promise.all([
            setLogs.findSetLogsByFilter(filter, limit),
            setLogs.countSetLogsByFilter(filter),
        ]);

        if (logs.length === 0) {
            return { activities: [], total };
        }

        // Collect unique IDs for batch lookups
        const uniquePlanExerciseIds = [...new Set(logs.map((log) => toStringId(log.planExerciseId)))];
        const uniquePlanIds = [...new Set(logs.map((log) => toStringId(log.planId)))];

        // Batch fetch planExercises and plans in parallel
        const [planExerciseList, planList] = await Promise.all([
            planExercises.findPlanExercisesByIds(uniquePlanExerciseIds),
            trainingPlans.findPlansByIds(uniquePlanIds),
        ]);

        // Build planExercise lookup map: planExerciseId -> exerciseDefId
        const planExerciseMap = new Map<string, string>();
        const uniqueExerciseDefIds: string[] = [];
        for (const pe of planExerciseList) {
            const peId = toStringId(pe._id);
            const exDefId = toStringId(pe.exerciseDefId);
            planExerciseMap.set(peId, exDefId);
            if (!uniqueExerciseDefIds.includes(exDefId)) {
                uniqueExerciseDefIds.push(exDefId);
            }
        }

        // Batch fetch exercise definitions
        const exerciseDefList = await exerciseDefinitions.findExercisesByIds(uniqueExerciseDefIds);

        // Build lookup maps
        const exerciseMap = new Map<string, { name: string; imageUrl: string; primaryMuscle: string }>();
        for (const exDef of exerciseDefList) {
            exerciseMap.set(toStringId(exDef._id), {
                name: exDef.name,
                imageUrl: exDef.imageUrl,
                primaryMuscle: exDef.primaryMuscle,
            });
        }

        const planMap = new Map<string, string>();
        for (const plan of planList) {
            planMap.set(toStringId(plan._id), plan.name);
        }

        // Map logs to activities using lookup maps (no DB calls)
        const activities: ActivityLogEntry[] = logs.map((log) => {
            const planExerciseIdStr = toStringId(log.planExerciseId);
            const planIdStr = toStringId(log.planId);
            const exerciseDefId = planExerciseMap.get(planExerciseIdStr);
            const exerciseInfo = exerciseDefId ? exerciseMap.get(exerciseDefId) : undefined;
            const planName = planMap.get(planIdStr);

            return {
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
            };
        });

        return { activities, total };
    } catch (error) {
        console.error('Error getting activity:', error);
        return { error: 'Failed to get activity' };
    }
}
