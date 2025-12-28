import { ObjectId } from 'mongodb';
import { DuplicateActivityRequest, DuplicateActivityResponse, ActivityLogEntry } from '../types';
import { setLogs } from '@/server/database';
import * as planExercises from '@/server/database/collections/planExercises';
import * as exerciseDefinitions from '@/server/database/collections/exerciseDefinitions';
import * as trainingPlans from '@/server/database/collections/trainingPlans';
import type { ApiHandlerContext } from '@/apis/types';

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

        // Determine the completedAt date
        const completedAt = request.completedAt
            ? new Date(request.completedAt)
            : new Date();

        if (isNaN(completedAt.getTime())) {
            return { error: 'Invalid date format' };
        }

        // Create a new set log with the same details but new date
        const newSetLog = await setLogs.createSetLog({
            userId: original.userId,
            planExerciseId: original.planExerciseId,
            planId: original.planId,
            weekNumber: original.weekNumber,
            setNumber: original.setNumber,
            completedAt,
        });

        // Enrich with exercise and plan info for response
        const planExercise = await planExercises.findPlanExerciseById(
            newSetLog.planExerciseId.toHexString()
        );

        let exerciseInfo = { name: 'Unknown Exercise', imageUrl: '', primaryMuscle: '' };
        if (planExercise) {
            const exerciseDef = await exerciseDefinitions.findExerciseById(
                planExercise.exerciseDefId.toHexString()
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
            newSetLog.planId.toHexString(),
            context.userId
        );
        const planName = plan?.name || 'Unknown Plan';

        const activity: ActivityLogEntry = {
            _id: newSetLog._id.toHexString(),
            userId: newSetLog.userId.toHexString(),
            planExerciseId: newSetLog.planExerciseId.toHexString(),
            planId: newSetLog.planId.toHexString(),
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
