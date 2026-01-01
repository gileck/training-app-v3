import { DuplicateActivityRequest, DuplicateActivityResponse, ActivityLogEntry } from '../types';
import { setLogs } from '@/server/database';
import * as planExercises from '@/server/database/collections/planExercises';
import * as exerciseDefinitions from '@/server/database/collections/exerciseDefinitions';
import * as trainingPlans from '@/server/database/collections/trainingPlans';
import type { ApiHandlerContext } from '@/apis/types';
import { toStringId } from '@/server/utils';

export async function duplicateActivity(
    request: DuplicateActivityRequest,
    context: ApiHandlerContext
): Promise<DuplicateActivityResponse> {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.activityId) {
            return { error: 'Activity ID is required' };
        }

        // Find the original set log
        const original = await setLogs.findSetLogById(request.activityId, context.userId);
        if (!original) {
            return { error: 'Activity not found or unauthorized' };
        }

        // Determine the completedAt date - use provided date or original's date (not today)
        const completedAt = request.completedAt
            ? new Date(request.completedAt)
            : original.completedAt;

        if (isNaN(completedAt.getTime())) {
            return { error: 'Invalid date format' };
        }

        // Create a new set log with the same details but new date
        const newSetLog = await setLogs.createSetLog({
            _id: request._id, // Pass client-generated ID if provided
            userId: original.userId,
            planExerciseId: original.planExerciseId,
            planId: original.planId,
            weekNumber: original.weekNumber,
            setNumber: original.setNumber,
            completedAt,
        });

        // Enrich with exercise and plan info for response
        const planExercise = await planExercises.findPlanExerciseById(
            toStringId(newSetLog.planExerciseId)
        );

        let exerciseInfo = { name: 'Unknown Exercise', imageUrl: '', primaryMuscle: '' };
        if (planExercise) {
            const exerciseDef = await exerciseDefinitions.findExerciseById(
                toStringId(planExercise.exerciseDefId)
            );
            if (exerciseDef) {
                exerciseInfo = {
                    name: exerciseDef.name,
                    imageUrl: exerciseDef.imageUrl,
                    primaryMuscle: exerciseDef.primaryMuscle,
                };
            }
        }

        const plan = await trainingPlans.findPlanById(
            toStringId(newSetLog.planId),
            context.userId
        );
        const planName = plan?.name || 'Unknown Plan';

        const activity: ActivityLogEntry = {
            _id: toStringId(newSetLog._id),
            userId: toStringId(newSetLog.userId),
            planExerciseId: toStringId(newSetLog.planExerciseId),
            planId: toStringId(newSetLog.planId),
            weekNumber: newSetLog.weekNumber,
            setNumber: newSetLog.setNumber,
            completedAt: newSetLog.completedAt.toISOString(),
            exerciseName: exerciseInfo.name,
            exerciseImageUrl: exerciseInfo.imageUrl,
            primaryMuscle: exerciseInfo.primaryMuscle,
            planName,
        };

        return { activity };
    } catch (error) {
        console.error('Error duplicating activity:', error);
        return { error: 'Failed to duplicate activity' };
    }
}
