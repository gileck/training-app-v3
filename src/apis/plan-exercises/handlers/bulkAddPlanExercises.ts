import type { ApiHandlerContext } from '@/apis/types';
import type { BulkAddPlanExercisesRequest, BulkAddPlanExercisesResponse, BulkAddResult, PlanExerciseWithDefinition } from '../types';
import * as planExercises from '@/server/database/collections/planExercises';
import * as exerciseDefinitions from '@/server/database/collections/exerciseDefinitions';
import * as trainingPlans from '@/server/database/collections/trainingPlans';
import { toStringId, toDocumentId } from '@/server/utils';

export async function bulkAddPlanExercises(
    request: BulkAddPlanExercisesRequest,
    context: ApiHandlerContext
): Promise<BulkAddPlanExercisesResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.exercises || request.exercises.length === 0) {
            return { error: 'At least one exercise is required' };
        }

        // Verify plan exists and belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found or unauthorized' };
        }

        // Get current exercise count for ordering
        const existingExercises = await planExercises.findExercisesByPlanId(request.planId);
        let currentOrder = existingExercises.length;

        // Get all unique exercise definition IDs
        const exerciseDefIds = [...new Set(request.exercises.map(e => e.exerciseDefId))];

        // Batch fetch all exercise definitions (single query instead of N parallel queries)
        const exerciseDefsArray = await exerciseDefinitions.findExercisesByIds(exerciseDefIds);
        const exerciseDefsMap = new Map(
            exerciseDefsArray.map(def => [toStringId(def._id), def])
        );

        const results: BulkAddResult[] = [];
        const exercisesToCreate: Array<{
            item: typeof request.exercises[0];
            exerciseDef: NonNullable<typeof exerciseDefsArray[0]>;
            order: number;
        }> = [];

        // Validate all exercises first
        for (const item of request.exercises) {
            const exerciseDef = exerciseDefsMap.get(item.exerciseDefId);
            
            if (!exerciseDef) {
                results.push({
                    exerciseDefId: item.exerciseDefId,
                    error: 'Exercise definition not found',
                });
                continue;
            }

            // Check if user has access to this exercise (system or own custom)
            if (!exerciseDef.isSystem && (exerciseDef.userId ? toStringId(exerciseDef.userId) : undefined) !== context.userId) {
                results.push({
                    exerciseDefId: item.exerciseDefId,
                    error: 'Unauthorized to use this exercise',
                });
                continue;
            }

            // Validate sets/reps
            if (item.sets < 1 || item.sets > 20) {
                results.push({
                    exerciseDefId: item.exerciseDefId,
                    error: 'Sets must be between 1 and 20',
                });
                continue;
            }

            if (item.reps < 0 || item.reps > 100) {
                results.push({
                    exerciseDefId: item.exerciseDefId,
                    error: 'Reps must be between 0 and 100',
                });
                continue;
            }

            // Valid - add to creation list
            exercisesToCreate.push({
                item,
                exerciseDef,
                order: currentOrder++,
            });
        }

        // Create all valid exercises
        const now = new Date();
        for (const { item, exerciseDef, order } of exercisesToCreate) {
            try {
                const exerciseData = {
                    _id: item._id, // Pass client-generated ID if provided
                    planId: toDocumentId(request.planId), // Handles both ObjectId and UUID formats
                    exerciseDefId: toDocumentId(item.exerciseDefId),
                    sets: item.sets,
                    reps: item.reps,
                    weight: item.weight || 0,
                    durationSeconds: item.durationSeconds || 0,
                    comments: item.comments || '',
                    order,
                    createdAt: now,
                    updatedAt: now,
                };

                const created = await planExercises.createPlanExercise(exerciseData);

                const planExerciseWithDef: PlanExerciseWithDefinition = {
                    _id: toStringId(created._id),
                    planId: toStringId(created.planId),
                    exerciseDefId: toStringId(created.exerciseDefId),
                    sets: created.sets,
                    reps: created.reps,
                    weight: created.weight,
                    durationSeconds: created.durationSeconds,
                    comments: created.comments,
                    order: created.order,
                    createdAt: created.createdAt.toISOString(),
                    updatedAt: created.updatedAt.toISOString(),
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

                results.push({
                    exerciseDefId: item.exerciseDefId,
                    exercise: planExerciseWithDef,
                });
            } catch (err) {
                results.push({
                    exerciseDefId: item.exerciseDefId,
                    error: err instanceof Error ? err.message : 'Failed to create exercise',
                });
            }
        }

        const addedCount = results.filter(r => r.exercise).length;
        const failedCount = results.filter(r => r.error).length;

        return {
            results,
            addedCount,
            failedCount,
        };
    } catch (error) {
        console.error('Error bulk adding exercises:', error);
        return { error: 'Failed to add exercises' };
    }
}
