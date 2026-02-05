import { ApiHandlerContext, GetMuscleGroupsRequest, GetMuscleGroupsResponse } from '../types';
import { exerciseDefinitions } from '@/server/database';

/**
 * Get all unique muscle groups from exercise library
 * Returns distinct values from both primaryMuscle and secondaryMuscles fields
 */
export const getMuscleGroups = async (
    request: GetMuscleGroupsRequest,
    context: ApiHandlerContext
): Promise<GetMuscleGroupsResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        // Get all exercises available to user (system + custom)
        const exerciseList = await exerciseDefinitions.findAllExercises(context.userId);

        // Collect all unique muscle groups from both primary and secondary muscles
        const muscleGroupsSet = new Set<string>();

        exerciseList.forEach((exercise) => {
            // Add primary muscle
            if (exercise.primaryMuscle && exercise.primaryMuscle.trim()) {
                muscleGroupsSet.add(exercise.primaryMuscle.trim());
            }

            // Add secondary muscles
            if (exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0) {
                exercise.secondaryMuscles.forEach((muscle) => {
                    if (muscle && muscle.trim()) {
                        muscleGroupsSet.add(muscle.trim());
                    }
                });
            }
        });

        // Convert to array and sort alphabetically
        const muscleGroups = Array.from(muscleGroupsSet).sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );

        return { muscleGroups };
    } catch (error: unknown) {
        console.error('Get muscle groups error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get muscle groups' };
    }
};
