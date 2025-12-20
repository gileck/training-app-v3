import { ObjectId } from 'mongodb';
import {
    ApiHandlerContext,
    AddPlanExerciseRequest,
    AddPlanExerciseResponse,
} from '../types';
import { trainingPlans, planExercises, exerciseDefinitions } from '@/server/database';

export const addPlanExercise = async (
    request: AddPlanExerciseRequest,
    context: ApiHandlerContext
): Promise<AddPlanExerciseResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.exerciseDefId) {
            return { error: 'Exercise definition ID is required' };
        }

        if (!request.sets || request.sets < 1) {
            return { error: 'Sets must be at least 1' };
        }

        if (!request.reps || request.reps < 1) {
            return { error: 'Reps must be at least 1' };
        }

        // Verify plan belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Verify exercise definition exists and user has access
        const exerciseDef = await exerciseDefinitions.findExerciseById(request.exerciseDefId);
        if (!exerciseDef) {
            return { error: 'Exercise not found' };
        }

        // Check if user has access (system exercises OR their own custom)
        if (!exerciseDef.isSystem && exerciseDef.userId?.toHexString() !== context.userId) {
            return { error: 'Exercise not found' };
        }

        // Get next order number
        const nextOrder = await planExercises.getNextOrder(request.planId);

        const now = new Date();
        const exerciseData = {
            planId: new ObjectId(request.planId),
            exerciseDefId: new ObjectId(request.exerciseDefId),
            sets: request.sets,
            reps: request.reps,
            weight: request.weight || 0,
            durationSeconds: request.durationSeconds || 0,
            comments: request.comments || '',
            order: nextOrder,
            createdAt: now,
            updatedAt: now,
        };

        const newExercise = await planExercises.createPlanExercise(exerciseData);

        // Return with exercise definition
        const result = {
            _id: newExercise._id.toHexString(),
            planId: newExercise.planId.toHexString(),
            exerciseDefId: newExercise.exerciseDefId.toHexString(),
            sets: newExercise.sets,
            reps: newExercise.reps,
            weight: newExercise.weight,
            durationSeconds: newExercise.durationSeconds,
            comments: newExercise.comments,
            order: newExercise.order,
            createdAt: newExercise.createdAt.toISOString(),
            updatedAt: newExercise.updatedAt.toISOString(),
            exerciseDef: {
                _id: exerciseDef._id.toHexString(),
                name: exerciseDef.name,
                imageUrl: exerciseDef.imageUrl,
                primaryMuscle: exerciseDef.primaryMuscle,
                secondaryMuscles: exerciseDef.secondaryMuscles,
                type: exerciseDef.type,
                isBodyweight: exerciseDef.isBodyweight,
                isStatic: exerciseDef.isStatic,
                isSystem: exerciseDef.isSystem,
                userId: exerciseDef.userId?.toHexString(),
                createdAt: exerciseDef.createdAt.toISOString(),
                updatedAt: exerciseDef.updatedAt.toISOString(),
            },
        };

        return { exercise: result };
    } catch (error: unknown) {
        console.error('Add plan exercise error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to add exercise to plan' };
    }
};

