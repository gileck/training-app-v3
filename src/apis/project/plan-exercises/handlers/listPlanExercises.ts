import {
    ApiHandlerContext,
    ListPlanExercisesRequest,
    ListPlanExercisesResponse,
    PlanExerciseWithDefinition,
} from '../types';
import { mergeExerciseDef, stripEmptyOverrides } from '../mergeExerciseDef';
import { trainingPlans, planExercises, exerciseDefinitions } from '@/server/database';
import { toStringId } from '@/server/template/utils';
import type { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';

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

        // Create a map for quick lookup (handles both ObjectId and UUID string IDs)
        const exerciseDefMap = new Map(exerciseDefs.map((def) => [toStringId(def._id), def]));

        // Combine plan exercises with their definitions, applying any
        // per-instance overrides so clients see the effective merged def.
        const exercisesWithDefs: PlanExerciseWithDefinition[] = [];
        for (const exercise of exerciseList) {
            const def = exerciseDefMap.get(toStringId(exercise.exerciseDefId));
            if (!def) continue;

            const baseDef: ExerciseDefinitionClient = {
                _id: toStringId(def._id),
                name: def.name,
                imageUrl: def.imageUrl,
                primaryMuscle: def.primaryMuscle,
                secondaryMuscles: def.secondaryMuscles,
                type: def.type,
                isBodyweight: def.isBodyweight,
                isStatic: def.isStatic,
                isSystem: def.isSystem,
                userId: def.userId ? toStringId(def.userId) : undefined,
                createdAt: def.createdAt.toISOString(),
                updatedAt: def.updatedAt.toISOString(),
            };

            // Strip any stored override fields that now coincide with the
            // base (e.g. because the base definition was updated after the
            // override was saved). This keeps the "is customized?" check
            // honest and prevents stale overrides from sticking around
            // silently after a no-op.
            const strippedOverrides = exercise.overrides
                ? stripEmptyOverrides(exercise.overrides, baseDef)
                : undefined;
            const mergedDef = mergeExerciseDef(baseDef, strippedOverrides);

            exercisesWithDefs.push({
                _id: toStringId(exercise._id),
                planId: toStringId(exercise.planId),
                exerciseDefId: toStringId(exercise.exerciseDefId),
                sets: exercise.sets,
                reps: exercise.reps,
                weight: exercise.weight,
                durationSeconds: exercise.durationSeconds,
                comments: exercise.comments,
                order: exercise.order,
                overrides:
                    strippedOverrides && Object.keys(strippedOverrides).length > 0
                        ? strippedOverrides
                        : undefined,
                createdAt: exercise.createdAt.toISOString(),
                updatedAt: exercise.updatedAt.toISOString(),
                exerciseDef: mergedDef,
            });
        }

        return { exercises: exercisesWithDefs };
    } catch (error: unknown) {
        console.error('List plan exercises error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to list plan exercises' };
    }
};

