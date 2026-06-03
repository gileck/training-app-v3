import { ApiHandlerContext, UpdateSetsRequest, UpdateSetsResponse } from '../types';
import {
    trainingPlans,
    planExercises,
    setLogs,
} from '@/server/database';
import { toStringId, toDocumentId } from '@/server/template/utils';

/**
 * Add / remove / complete-all sets for a (plan, exercise, week).
 *
 * Source of truth: `setLogs` — we count rows in the activity log to derive
 * `setsCompleted`. We don't touch `exerciseProgress.setsCompleted` here any
 * more; it's been demoted to a pure `isSkipped` flag store (see
 * weekly-progress/getWeekProgress.ts and plan-data/syncPlanData.ts).
 *
 * This endpoint is kept for SDK / MCP callers (agents and scripts). The PWA
 * client itself doesn't call it — it uses the local-first sync path plus
 * direct activity-log APIs.
 */
export const updateSets = async (
    request: UpdateSetsRequest,
    context: ApiHandlerContext
): Promise<UpdateSetsResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.planExerciseId) {
            return { error: 'Plan exercise ID is required' };
        }

        if (!request.weekNumber || request.weekNumber < 1) {
            return { error: 'Week number must be at least 1' };
        }

        if (!request.action || !['add', 'remove', 'complete-all'].includes(request.action)) {
            return { error: 'Action must be "add", "remove", or "complete-all"' };
        }

        // Verify plan belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Verify week number
        if (request.weekNumber > plan.durationWeeks) {
            return { error: 'Week number exceeds plan duration' };
        }

        // Verify exercise exists in plan (handles both ObjectId and UUID)
        const exercise = await planExercises.findPlanExerciseById(request.planExerciseId);
        if (!exercise || toStringId(exercise.planId) !== request.planId) {
            return { error: 'Exercise not found in plan' };
        }

        // Current count (source of truth)
        const currentCount = await setLogs.countSetsForExerciseWeek(
            context.userId,
            request.planExerciseId,
            request.weekNumber
        );

        if (request.action === 'add') {
            if (currentCount < exercise.sets) {
                await setLogs.createSetLog({
                    userId: toDocumentId(context.userId),
                    planExerciseId: toDocumentId(request.planExerciseId),
                    planId: toDocumentId(request.planId),
                    weekNumber: request.weekNumber,
                    setNumber: currentCount + 1,
                    completedAt: new Date(),
                });
            }
        } else if (request.action === 'remove') {
            if (currentCount > 0) {
                await setLogs.deleteLatestSetLog(
                    context.userId,
                    request.planExerciseId,
                    request.weekNumber
                );
            }
        } else {
            // complete-all
            const remaining = exercise.sets - currentCount;
            if (remaining > 0) {
                const now = new Date();
                await Promise.all(
                    Array.from({ length: remaining }, (_, i) =>
                        setLogs.createSetLog({
                            userId: toDocumentId(context.userId!),
                            planExerciseId: toDocumentId(request.planExerciseId),
                            planId: toDocumentId(request.planId),
                            weekNumber: request.weekNumber,
                            setNumber: currentCount + i + 1,
                            completedAt: now,
                        })
                    )
                );
            }
        }

        // Re-read for an accurate response (and to honor the cap at exercise.sets)
        const newRawCount = await setLogs.countSetsForExerciseWeek(
            context.userId,
            request.planExerciseId,
            request.weekNumber
        );
        const setsCompleted = Math.min(newRawCount, exercise.sets);
        const isDone = setsCompleted >= exercise.sets;

        await trainingPlans.touchPlan(request.planId);
        return { setsCompleted, isDone };
    } catch (error: unknown) {
        console.error('Update sets error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update sets' };
    }
};

