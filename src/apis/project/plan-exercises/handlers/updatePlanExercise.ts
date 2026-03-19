import {
    ApiHandlerContext,
    UpdatePlanExerciseRequest,
    UpdatePlanExerciseResponse,
} from '../types';
import { trainingPlans, planExercises } from '@/server/database';
import { toStringId } from '@/server/template/utils';

export const updatePlanExercise = async (
    request: UpdatePlanExerciseRequest,
    context: ApiHandlerContext
): Promise<UpdatePlanExerciseResponse> => {
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

        // Validate values if provided
        if (request.sets !== undefined && request.sets < 1) {
            return { error: 'Sets must be at least 1' };
        }

        if (request.reps !== undefined && request.reps < 1) {
            return { error: 'Reps must be at least 1' };
        }

        // Build update object
        const update = {
            updatedAt: new Date(),
            ...(request.sets !== undefined && { sets: request.sets }),
            ...(request.reps !== undefined && { reps: request.reps }),
            ...(request.weight !== undefined && { weight: request.weight }),
            ...(request.durationSeconds !== undefined && { durationSeconds: request.durationSeconds }),
            ...(request.comments !== undefined && { comments: request.comments }),
        };

        const updated = await planExercises.updatePlanExercise(request.planExerciseId, update);

        if (!updated) {
            return { error: 'Failed to update exercise' };
        }

        // Convert to client format (handles both ObjectId and UUID string IDs)
        const exerciseClient = {
            _id: toStringId(updated._id),
            planId: toStringId(updated.planId),
            exerciseDefId: toStringId(updated.exerciseDefId),
            sets: updated.sets,
            reps: updated.reps,
            weight: updated.weight,
            durationSeconds: updated.durationSeconds,
            comments: updated.comments,
            order: updated.order,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        };

        return { exercise: exerciseClient };
    } catch (error: unknown) {
        console.error('Update plan exercise error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update exercise' };
    }
};

