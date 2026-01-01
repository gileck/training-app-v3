import { ApiHandlerContext, ListPlanWorkoutsRequest, ListPlanWorkoutsResponse } from '../types';
import { planWorkouts, trainingPlans } from '@/server/database';
import { toStringId } from '@/server/utils';

export const listPlanWorkouts = async (
    request: ListPlanWorkoutsRequest,
    context: ApiHandlerContext
): Promise<ListPlanWorkoutsResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        // Verify plan exists and belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        const workoutList = await planWorkouts.listPlanWorkouts(context.userId, request.planId);

        // Convert to client format (handles both ObjectId and UUID string IDs)
        const workoutsClient = workoutList.map((workout) => ({
            _id: toStringId(workout._id),
            userId: toStringId(workout.userId),
            planId: toStringId(workout.planId),
            name: workout.name,
            items: workout.items.map((item) => ({
                planExerciseId: toStringId(item.planExerciseId),
                order: item.order,
            })),
            order: workout.order,
            createdAt: workout.createdAt.toISOString(),
            updatedAt: workout.updatedAt.toISOString(),
        }));

        return { workouts: workoutsClient };
    } catch (error: unknown) {
        console.error('List plan workouts error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to list plan workouts' };
    }
};
