import { ApiHandlerContext, CreatePlanWorkoutRequest, CreatePlanWorkoutResponse } from '../types';
import { planWorkouts, trainingPlans, planExercises } from '@/server/database';
import { toStringId, toDocumentId } from '@/server/utils';

export const createPlanWorkout = async (
    request: CreatePlanWorkoutRequest,
    context: ApiHandlerContext
): Promise<CreatePlanWorkoutResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.name || request.name.trim() === '') {
            return { error: 'Workout name is required' };
        }

        if (!request.items || request.items.length === 0) {
            return { error: 'At least one exercise is required' };
        }

        // Verify plan exists and belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Batch fetch all plan exercises for validation (single query instead of N queries)
        const planExerciseIds = request.items.map(item => item.planExerciseId);
        const planExerciseList = await planExercises.findPlanExercisesByIds(planExerciseIds);
        const planExerciseMap = new Map(planExerciseList.map(pe => [toStringId(pe._id), pe]));

        // Validate all planExerciseIds belong to this plan
        for (const item of request.items) {
            const planExercise = planExerciseMap.get(item.planExerciseId);
            if (!planExercise) {
                return { error: `Exercise ${item.planExerciseId} not found` };
            }
            if (toStringId(planExercise.planId) !== request.planId) {
                return { error: `Exercise ${item.planExerciseId} does not belong to this plan` };
            }
        }

        const workoutData = {
            _id: request._id, // Pass client-generated ID if provided
            userId: toDocumentId(context.userId),
            planId: toDocumentId(request.planId), // Handles both ObjectId and UUID formats
            name: request.name.trim(),
            items: request.items.map((item, index) => ({
                planExerciseId: toDocumentId(item.planExerciseId),
                order: index,
                // Include sets only if explicitly provided (undefined means use exercise's weekly sets)
                ...(item.sets !== undefined && { sets: item.sets }),
            })),
        };

        const newWorkout = await planWorkouts.createPlanWorkout(workoutData);

        // Convert to client format (handle both ObjectId and UUID string)
        const workoutClient = {
            _id: toStringId(newWorkout._id),
            userId: toStringId(newWorkout.userId),
            planId: toStringId(newWorkout.planId),
            name: newWorkout.name,
            items: newWorkout.items.map((item) => ({
                planExerciseId: toStringId(item.planExerciseId),
                order: item.order,
                ...(item.sets !== undefined && { sets: item.sets }),
            })),
            order: newWorkout.order,
            createdAt: newWorkout.createdAt.toISOString(),
            updatedAt: newWorkout.updatedAt.toISOString(),
        };

        return { workout: workoutClient };
    } catch (error: unknown) {
        console.error('Create plan workout error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to create plan workout' };
    }
};
