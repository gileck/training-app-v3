import { ObjectId } from 'mongodb';
import { ApiHandlerContext, CreatePlanWorkoutRequest, CreatePlanWorkoutResponse } from '../types';
import { planWorkouts, trainingPlans, planExercises } from '@/server/database';
import { toStringId } from '@/server/utils';

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

        // Validate all planExerciseIds belong to this plan
        for (const item of request.items) {
            const planExercise = await planExercises.findPlanExerciseById(item.planExerciseId);
            if (!planExercise) {
                return { error: `Exercise ${item.planExerciseId} not found` };
            }
            if (toStringId(planExercise.planId) !== request.planId) {
                return { error: `Exercise ${item.planExerciseId} does not belong to this plan` };
            }
        }

        const workoutData = {
            _id: request._id, // Pass client-generated ID if provided
            userId: new ObjectId(context.userId),
            planId: new ObjectId(request.planId),
            name: request.name.trim(),
            items: request.items.map((item, index) => ({
                planExerciseId: new ObjectId(item.planExerciseId),
                order: index,
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
