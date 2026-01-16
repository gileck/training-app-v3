import type { PlanWorkoutClient } from '@/server/database/collections/planWorkouts/types';
import type { ExerciseWeekProgressFromStore } from '@/client/features/plan-data';

/**
 * AUTO-FILL SET ALLOCATION LOGIC
 *
 * Strategy: When a user adds/removes sets from the Exercise Tab or an ad-hoc
 * workout (not a saved workout), we automatically assign sets to workouts
 * WITHOUT prompting the user.
 *
 * - ADDING SETS: Fill workouts in order (first → last) until each reaches
 *   its allocated capacity, then move to the next workout.
 *   Example: Exercise has 10 sets split into Workout A (5) and Workout B (5).
 *   First 5 sets go to Workout A, next 5 go to Workout B.
 *
 * - REMOVING SETS: Remove from last workout first (last → first), reversing
 *   the add order for intuitive LIFO behavior.
 *   Example: If Workout A has 5/5 and Workout B has 3/5, removing a set
 *   decrements Workout B first (to 2/5).
 *
 * - If exercise is not in any saved workout, workoutId is null and only
 *   the total weekly progress is updated (no per-workout tracking).
 */

/**
 * Find the first workout with remaining capacity for an exercise.
 * Used when ADDING sets - fills workouts in order (first to last).
 *
 * @returns workoutId of first workout with capacity, or null if:
 *   - Exercise is not in any saved workout
 *   - All workouts are already at full capacity
 */
export function getFirstWorkoutWithCapacity(
    exerciseId: string,
    planWorkoutsList: PlanWorkoutClient[],
    exercises: ExerciseWeekProgressFromStore[],
    weekWorkoutSets: Record<string, Record<string, number>>
): string | null {
    // Step 1: Get all saved workouts that include this exercise
    const containingWorkouts = planWorkoutsList.filter((workout) =>
        workout.items.some((item) => item.planExerciseId === exerciseId)
    );

    // No workouts contain this exercise - return null (only total will be updated)
    if (containingWorkouts.length === 0) return null;

    // Step 2: Iterate through workouts in order to find first with capacity
    for (const workout of containingWorkouts) {
        const item = workout.items.find((i) => i.planExerciseId === exerciseId);
        if (!item) continue;

        // Get how many sets this workout should have for this exercise
        // item.sets = per-workout allocation (e.g., 5 sets for this workout)
        // Falls back to exercise's total weekly sets if no specific allocation
        const exercise = exercises.find((e) => e.planExerciseId === exerciseId);
        const allocatedSets = item.sets ?? exercise?.targetSets ?? 0;

        // Get how many sets have already been completed in THIS workout
        const completedInWorkout = weekWorkoutSets[workout._id]?.[exerciseId] ?? 0;

        // If there's room in this workout, assign the new set here
        if (completedInWorkout < allocatedSets) {
            return workout._id;
        }
        // Otherwise, continue to check the next workout
    }

    // All workouts are at capacity - return null (only total will be updated)
    return null;
}

/**
 * Find the last workout with completed sets for an exercise.
 * Used when REMOVING sets - removes from last workout first (LIFO order).
 *
 * @returns workoutId of last workout with sets, or null if:
 *   - Exercise is not in any saved workout
 *   - No workout has any completed sets for this exercise
 */
export function getLastWorkoutWithSets(
    exerciseId: string,
    planWorkoutsList: PlanWorkoutClient[],
    weekWorkoutSets: Record<string, Record<string, number>>
): string | null {
    // Step 1: Get all saved workouts that include this exercise
    const containingWorkouts = planWorkoutsList.filter((workout) =>
        workout.items.some((item) => item.planExerciseId === exerciseId)
    );

    // No workouts contain this exercise - return null (only total will be updated)
    if (containingWorkouts.length === 0) return null;

    // Step 2: Iterate through workouts in REVERSE order to find last with sets
    // This ensures LIFO behavior: last workout to receive sets loses them first
    for (let i = containingWorkouts.length - 1; i >= 0; i--) {
        const workout = containingWorkouts[i];
        const completedInWorkout = weekWorkoutSets[workout._id]?.[exerciseId] ?? 0;

        // If this workout has any completed sets, remove from here
        if (completedInWorkout > 0) {
            return workout._id;
        }
        // Otherwise, continue checking earlier workouts
    }

    // No workout has any sets to remove - return null (only total will be updated)
    return null;
}
