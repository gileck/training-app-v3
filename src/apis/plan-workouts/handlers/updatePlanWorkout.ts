import { ApiHandlerContext, UpdatePlanWorkoutRequest, UpdatePlanWorkoutResponse } from '../types';
import { planWorkouts, trainingPlans, planExercises } from '@/server/database';
import { toStringId, toDocumentId, isObjectIdFormat, isUuidFormat } from '@/server/utils';

export const updatePlanWorkout = async (
    request: UpdatePlanWorkoutRequest,
    context: ApiHandlerContext
): Promise<UpdatePlanWorkoutResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.workoutId) {
            return { error: 'Workout ID is required' };
        }

        // Handle temp IDs from optimistic updates - can't update a workout that wasn't persisted yet
        // Accept both ObjectId format (legacy) and UUID format (new client-generated IDs)
        if (request.workoutId.startsWith('temp-') || (!isObjectIdFormat(request.workoutId) && !isUuidFormat(request.workoutId))) {
            return { error: 'Cannot update a workout that is still being created' };
        }

        // Verify plan exists and belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Verify workout exists and belongs to this plan/user
        const existingWorkout = await planWorkouts.getPlanWorkout(
            request.workoutId,
            context.userId,
            request.planId
        );
        if (!existingWorkout) {
            return { error: 'Workout not found' };
        }

        // Validate inputs
        if (request.name !== undefined && request.name.trim() === '') {
            return { error: 'Workout name cannot be empty' };
        }

        // If items are being updated, validate they belong to this plan
        if (request.items !== undefined) {
            if (request.items.length === 0) {
                return { error: 'At least one exercise is required' };
            }

            // Batch fetch all plan exercises for validation (single query instead of N queries)
            const planExerciseIds = request.items.map(item => item.planExerciseId);
            const planExerciseList = await planExercises.findPlanExercisesByIds(planExerciseIds);
            const planExerciseMap = new Map(planExerciseList.map(pe => [toStringId(pe._id), pe]));

            for (const item of request.items) {
                const planExercise = planExerciseMap.get(item.planExerciseId);
                if (!planExercise) {
                    return { error: `Exercise ${item.planExerciseId} not found` };
                }
                if (toStringId(planExercise.planId) !== request.planId) {
                    return { error: `Exercise ${item.planExerciseId} does not belong to this plan` };
                }
            }
        }

        // Build update object
        const update: {
            name?: string;
            items?: { planExerciseId: ReturnType<typeof toDocumentId>; order: number; sets: number }[];
            updatedAt: Date;
        } = {
            updatedAt: new Date(),
        };

        if (request.name !== undefined) {
            update.name = request.name.trim();
        }

        if (request.items !== undefined) {
            update.items = request.items.map((item, index) => ({
                planExerciseId: toDocumentId(item.planExerciseId),
                order: index,
                sets: item.sets,
            }));
        }

        const updatedWorkout = await planWorkouts.updatePlanWorkout(
            request.workoutId,
            context.userId,
            request.planId,
            update
        );

        if (!updatedWorkout) {
            return { error: 'Failed to update workout' };
        }

        // Convert to client format (handles both ObjectId and UUID string IDs)
        // Note: sets defaults to 0 for backward compatibility with existing data
        const workoutClient = {
            _id: toStringId(updatedWorkout._id),
            userId: toStringId(updatedWorkout.userId),
            planId: toStringId(updatedWorkout.planId),
            name: updatedWorkout.name,
            items: updatedWorkout.items.map((item) => ({
                planExerciseId: toStringId(item.planExerciseId),
                order: item.order,
                sets: (item as { sets?: number }).sets ?? 0,
            })),
            order: updatedWorkout.order,
            createdAt: updatedWorkout.createdAt.toISOString(),
            updatedAt: updatedWorkout.updatedAt.toISOString(),
        };

        return { workout: workoutClient };
    } catch (error: unknown) {
        console.error('Update plan workout error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update plan workout' };
    }
};
