import {
    ApiHandlerContext,
    ListPlanExercisesRequest,
    ListPlanExercisesResponse,
    PlanExerciseWithDefinition,
} from '../types';
import { trainingPlans, planExercises, exerciseDefinitions } from '@/server/database';

export const listPlanExercises = async (
    request: ListPlanExercisesRequest,
    context: ApiHandlerContext
): Promise<ListPlanExercisesResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        // Verify plan belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Get all exercises in this plan
        const exerciseList = await planExercises.findExercisesByPlanId(request.planId);

        // Get exercise definitions for all exercises
        const exerciseDefIds = exerciseList.map((e) => e.exerciseDefId);
        const exerciseDefs = await exerciseDefinitions.findExercisesByIds(exerciseDefIds);

        // Create a map for quick lookup
        const exerciseDefMap = new Map(exerciseDefs.map((def) => [def._id.toHexString(), def]));

        // Combine plan exercises with their definitions
        const exercisesWithDefs: PlanExerciseWithDefinition[] = [];
        for (const exercise of exerciseList) {
            const def = exerciseDefMap.get(exercise.exerciseDefId.toHexString());
            if (!def) continue;

            exercisesWithDefs.push({
                _id: exercise._id.toHexString(),
                planId: exercise.planId.toHexString(),
                exerciseDefId: exercise.exerciseDefId.toHexString(),
                sets: exercise.sets,
                reps: exercise.reps,
                weight: exercise.weight,
                durationSeconds: exercise.durationSeconds,
                comments: exercise.comments,
                order: exercise.order,
                createdAt: exercise.createdAt.toISOString(),
                updatedAt: exercise.updatedAt.toISOString(),
                exerciseDef: {
                    _id: def._id.toHexString(),
                    name: def.name,
                    imageUrl: def.imageUrl,
                    primaryMuscle: def.primaryMuscle,
                    secondaryMuscles: def.secondaryMuscles,
                    type: def.type,
                    isBodyweight: def.isBodyweight,
                    isStatic: def.isStatic,
                    isSystem: def.isSystem,
                    userId: def.userId?.toHexString(),
                    createdAt: def.createdAt.toISOString(),
                    updatedAt: def.updatedAt.toISOString(),
                },
            });
        }

        return { exercises: exercisesWithDefs };
    } catch (error: unknown) {
        console.error('List plan exercises error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to list plan exercises' };
    }
};

