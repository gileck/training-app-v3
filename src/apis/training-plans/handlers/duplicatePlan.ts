import { ApiHandlerContext, DuplicatePlanRequest, DuplicatePlanResponse } from '../types';
import { trainingPlans, planExercises } from '@/server/database';
import { toStringId, toDocumentId } from '@/server/utils';

export const duplicatePlan = async (
    request: DuplicatePlanRequest,
    context: ApiHandlerContext
): Promise<DuplicatePlanResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        // Get the original plan
        const originalPlan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!originalPlan) {
            return { error: 'Plan not found' };
        }

        const now = new Date();

        // Create the new plan with "(Copy)" suffix
        const newPlanData = {
            userId: toDocumentId(context.userId),
            name: `${originalPlan.name} (Copy)`,
            durationWeeks: originalPlan.durationWeeks,
            isActive: false, // Duplicated plan is not active by default
            createdAt: now,
            updatedAt: now,
        };

        const newPlan = await trainingPlans.createPlan(newPlanData);

        // Get all exercises from the original plan
        const originalExercises = await planExercises.findExercisesByPlanId(request.planId);

        // TODO: [N+1 QUERY] This loop creates exercises one-by-one (N inserts).
        // Fix: Add `bulkCreatePlanExercises()` to planExercises collection using `collection.insertMany()`.
        // This would reduce N insert operations to 1 bulk insert.
        // Example implementation:
        //   const exercisesToCreate = originalExercises.map(ex => ({...}));
        //   await planExercises.bulkCreatePlanExercises(exercisesToCreate);
        for (const exercise of originalExercises) {
            await planExercises.createPlanExercise({
                planId: newPlan._id,
                exerciseDefId: exercise.exerciseDefId,
                sets: exercise.sets,
                reps: exercise.reps,
                weight: exercise.weight,
                durationSeconds: exercise.durationSeconds,
                comments: exercise.comments,
                order: exercise.order,
                createdAt: now,
                updatedAt: now,
            });
        }

        // Convert to client format (handles both ObjectId and UUID string IDs)
        const planClient = {
            _id: toStringId(newPlan._id),
            userId: toStringId(newPlan.userId),
            name: newPlan.name,
            durationWeeks: newPlan.durationWeeks,
            isActive: newPlan.isActive,
            createdAt: newPlan.createdAt.toISOString(),
            updatedAt: newPlan.updatedAt.toISOString(),
        };

        return { plan: planClient };
    } catch (error: unknown) {
        console.error('Duplicate plan error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to duplicate plan' };
    }
};

