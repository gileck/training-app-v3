import {
    ApiHandlerContext,
    AddPlanExerciseRequest,
    AddPlanExerciseResponse,
} from '../types';
import { trainingPlans, planExercises, exerciseDefinitions } from '@/server/database';
import { toStringId, toDocumentId } from '@/server/template/utils';
import { defineApiMeta } from '@/apis/types';
import { z } from 'zod';

export const apiMeta = defineApiMeta<AddPlanExerciseRequest>()({
    description: "Add an exercise to a training plan. Look up exerciseDefId via exercise-definitions/list first.",
    inputSchema: {
        planId: z.string().describe('Plan id to add the exercise to.'),
        exerciseDefId: z.string().describe('Exercise definition id (from exercise-definitions/list).'),
        sets: z.number().int().min(1).describe('Number of sets.'),
        reps: z.number().int().min(0).describe('Reps per set.'),
        weight: z.number().optional().describe('Weight in kg (optional).'),
        durationSeconds: z.number().int().optional().describe('Duration in seconds for timed exercises (optional).'),
        comments: z.string().optional().describe('Optional notes for this exercise.'),
        weekNumber: z
            .number()
            .int()
            .optional()
            .describe(
                'Optional week number. When set, the exercise is scoped to that week only and will not appear in other weeks. Omit to add a plan-wide exercise that appears in every week.'
            ),
    },
    agentExposed: true,
    mutates: true,
});

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
        if (!exerciseDef.isSystem && toStringId(exerciseDef.userId!) !== context.userId) {
            return { error: 'Exercise not found' };
        }

        // Get next order number
        const nextOrder = await planExercises.getNextOrder(request.planId);

        const now = new Date();
        const exerciseData = {
            _id: request._id, // Pass client-generated ID if provided
            planId: toDocumentId(request.planId), // Handles both ObjectId and UUID formats
            exerciseDefId: toDocumentId(request.exerciseDefId),
            sets: request.sets,
            reps: request.reps,
            weight: request.weight || 0,
            durationSeconds: request.durationSeconds || 0,
            comments: request.comments || '',
            order: nextOrder,
            // Only persist weekNumber when scoping to a week; omitting it
            // keeps the exercise plan-wide (the default).
            ...(request.weekNumber != null ? { weekNumber: request.weekNumber } : {}),
            createdAt: now,
            updatedAt: now,
        };

        const newExercise = await planExercises.createPlanExercise(exerciseData);
        await trainingPlans.touchPlan(request.planId);

        // Return with exercise definition (handle both ObjectId and UUID string)
        const result = {
            _id: toStringId(newExercise._id),
            planId: toStringId(newExercise.planId),
            exerciseDefId: toStringId(newExercise.exerciseDefId),
            sets: newExercise.sets,
            reps: newExercise.reps,
            weight: newExercise.weight,
            durationSeconds: newExercise.durationSeconds,
            comments: newExercise.comments,
            order: newExercise.order,
            weekNumber: newExercise.weekNumber,
            createdAt: newExercise.createdAt.toISOString(),
            updatedAt: newExercise.updatedAt.toISOString(),
            exerciseDef: {
                _id: toStringId(exerciseDef._id),
                name: exerciseDef.name,
                imageUrl: exerciseDef.imageUrl,
                primaryMuscle: exerciseDef.primaryMuscle,
                secondaryMuscles: exerciseDef.secondaryMuscles,
                type: exerciseDef.type,
                isBodyweight: exerciseDef.isBodyweight,
                isStatic: exerciseDef.isStatic,
                isSystem: exerciseDef.isSystem,
                userId: exerciseDef.userId ? toStringId(exerciseDef.userId) : undefined,
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
