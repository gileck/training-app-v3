import { ObjectId } from 'mongodb';
import { ApiHandlerContext, UpdateSetsRequest, UpdateSetsResponse } from '../types';
import {
    trainingPlans,
    planExercises,
    weeklyProgress,
    exerciseProgress,
    setLogs,
} from '@/server/database';

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

        // Verify exercise exists in plan
        const exercise = await planExercises.findPlanExerciseById(request.planExerciseId);
        if (!exercise || exercise.planId.toHexString() !== request.planId) {
            return { error: 'Exercise not found in plan' };
        }

        // Get or create weekly progress
        const weekProgress = await weeklyProgress.findOrCreateWeeklyProgress(
            request.planId,
            request.weekNumber
        );

        // Get current progress for this exercise
        const currentProgress = await exerciseProgress.findExerciseProgress(
            weekProgress._id,
            request.planExerciseId
        );

        let setsCompleted = currentProgress?.setsCompleted || 0;

        if (request.action === 'add') {
            // Only add if not already at max sets
            if (setsCompleted < exercise.sets) {
                setsCompleted += 1;

                // Create set log entry
                await setLogs.createSetLog({
                    userId: new ObjectId(context.userId),
                    planExerciseId: new ObjectId(request.planExerciseId),
                    planId: new ObjectId(request.planId),
                    weekNumber: request.weekNumber,
                    setNumber: setsCompleted,
                    completedAt: new Date(),
                });
            }
        } else if (request.action === 'complete-all') {
            // Complete all remaining sets at once
            const remaining = exercise.sets - setsCompleted;
            if (remaining > 0) {
                // Create set log entries for all remaining sets
                const setLogPromises = [];
                for (let i = 1; i <= remaining; i++) {
                    setLogPromises.push(
                        setLogs.createSetLog({
                            userId: new ObjectId(context.userId),
                            planExerciseId: new ObjectId(request.planExerciseId),
                            planId: new ObjectId(request.planId),
                            weekNumber: request.weekNumber,
                            setNumber: setsCompleted + i,
                            completedAt: new Date(),
                        })
                    );
                }
                await Promise.all(setLogPromises);
                setsCompleted = exercise.sets;
            }
        } else {
            // Remove action
            if (setsCompleted > 0) {
                // Delete the most recent set log
                await setLogs.deleteLatestSetLog(
                    context.userId,
                    request.planExerciseId,
                    request.weekNumber
                );
                setsCompleted -= 1;
            }
        }

        const isDone = setsCompleted >= exercise.sets;

        // Update exercise progress
        await exerciseProgress.updateExerciseProgress(weekProgress._id, request.planExerciseId, {
            setsCompleted,
            isDone,
        });

        return { setsCompleted, isDone };
    } catch (error: unknown) {
        console.error('Update sets error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update sets' };
    }
};

