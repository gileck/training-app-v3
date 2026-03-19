import { ApiHandlerContext, UpdateSetsRequest, UpdateSetsResponse } from '../types';
import {
    trainingPlans,
    planExercises,
    weeklyProgress,
    exerciseProgress,
    setLogs,
} from '@/server/database';
import {
    atomicIncrementSets,
    atomicDecrementSets,
    findOrCreateExerciseProgress,
} from '@/server/database/collections/project/exerciseProgress';
import { toStringId, toDocumentId } from '@/server/template/utils';

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

        // Get or create weekly progress
        const weekProgress = await weeklyProgress.findOrCreateWeeklyProgress(
            request.planId,
            request.weekNumber
        );

        // Ensure exercise progress document exists before atomic operations
        const weekProgressId = toStringId(weekProgress._id);
        await findOrCreateExerciseProgress(weekProgressId, request.planExerciseId);

        let setsCompleted: number;
        let isDone: boolean;

        if (request.action === 'add') {
            // Use atomic increment to prevent race conditions from rapid clicks
            const updated = await atomicIncrementSets(
                weekProgressId,
                request.planExerciseId,
                exercise.sets
            );

            if (updated) {
                setsCompleted = updated.setsCompleted;
                isDone = setsCompleted >= exercise.sets;

                // Create set log entry (handles both ObjectId and UUID formats)
                await setLogs.createSetLog({
                    userId: toDocumentId(context.userId),
                    planExerciseId: toDocumentId(request.planExerciseId),
                    planId: toDocumentId(request.planId),
                    weekNumber: request.weekNumber,
                    setNumber: setsCompleted,
                    completedAt: new Date(),
                });

                // Update isDone flag if needed
                if (isDone) {
                    await exerciseProgress.updateExerciseProgress(
                        weekProgressId,
                        request.planExerciseId,
                        { isDone: true }
                    );
                }
            } else {
                // Already at max sets, return current state
                const current = await exerciseProgress.findExerciseProgress(
                    weekProgressId,
                    request.planExerciseId
                );
                setsCompleted = current?.setsCompleted || exercise.sets;
                isDone = true;
            }
        } else if (request.action === 'remove') {
            // Use atomic decrement to prevent race conditions from rapid clicks
            const updated = await atomicDecrementSets(
                weekProgressId,
                request.planExerciseId
            );

            if (updated) {
                setsCompleted = updated.setsCompleted;
                isDone = setsCompleted >= exercise.sets;

                // Delete the most recent set log
                await setLogs.deleteLatestSetLog(
                    context.userId,
                    request.planExerciseId,
                    request.weekNumber
                );

                // Update isDone flag if it changed
                await exerciseProgress.updateExerciseProgress(
                    weekProgressId,
                    request.planExerciseId,
                    { isDone }
                );
            } else {
                // Already at 0, return current state
                setsCompleted = 0;
                isDone = false;
            }
        } else {
            // complete-all action - get current state first
            const currentProgress = await exerciseProgress.findExerciseProgress(
                weekProgressId,
                request.planExerciseId
            );
            const currentSets = currentProgress?.setsCompleted || 0;
            const remaining = exercise.sets - currentSets;

            if (remaining > 0) {
                // Create set log entries for all remaining sets (handles both ObjectId and UUID formats)
                const setLogPromises = [];
                for (let i = 1; i <= remaining; i++) {
                    setLogPromises.push(
                        setLogs.createSetLog({
                            userId: toDocumentId(context.userId),
                            planExerciseId: toDocumentId(request.planExerciseId),
                            planId: toDocumentId(request.planId),
                            weekNumber: request.weekNumber,
                            setNumber: currentSets + i,
                            completedAt: new Date(),
                        })
                    );
                }
                await Promise.all(setLogPromises);
            }

            setsCompleted = exercise.sets;
            isDone = true;

            // Update to full completion
            await exerciseProgress.updateExerciseProgress(
                weekProgressId,
                request.planExerciseId,
                { setsCompleted, isDone }
            );
        }

        return { setsCompleted, isDone };
    } catch (error: unknown) {
        console.error('Update sets error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update sets' };
    }
};

