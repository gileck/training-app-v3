/**
 * Training Plans Utilities
 * 
 * Shared utility functions for training plan operations.
 */

import type { 
    PlanExportData,
    DraftPlan,
    DraftExercise,
    DraftWorkout,
} from '@/apis/training-plans/types';

/**
 * Convert PlanExportData to DraftPlan format (client-side, no matching)
 * 
 * Used by both Import and Share flows to convert export data to draft format
 * without calling the server-side matching API.
 * 
 * All exercises are marked as 'custom' - the backend will handle matching
 * by name when `autoResolveUnmatched=true` is passed to createPlanFromText.
 */
export function exportDataToDraftPlan(exportData: PlanExportData): DraftPlan {
    const exercises: DraftExercise[] = [];
    const workouts: DraftWorkout[] = [];
    
    exportData.workouts.forEach((exportWorkout, workoutIndex) => {
        const workoutItems: DraftWorkout['items'] = [];
        
        exportWorkout.exercises.forEach((exportExercise, exerciseIndex) => {
            // Generate a unique key for this exercise
            const draftExerciseKey = `w${workoutIndex}-e${exerciseIndex}`;
            
            // Create draft exercise - mark as 'custom' (will be matched by backend)
            const draftExercise: DraftExercise = {
                draftExerciseKey,
                name: exportExercise.name,
                matchStatus: 'custom', // Backend will handle matching
                sets: exportExercise.sets ?? 3,
                reps: exportExercise.reps ?? 0,
                weightKg: exportExercise.weightKg ?? 0,
                durationSeconds: exportExercise.durationSeconds ?? 0,
                notes: exportExercise.notes ?? '',
            };
            
            exercises.push(draftExercise);
            
            // Add to workout items
            workoutItems.push({
                draftExerciseKey,
                order: exerciseIndex,
            });
        });
        
        // Create draft workout
        workouts.push({
            name: exportWorkout.name,
            items: workoutItems,
        });
    });
    
    return {
        planName: exportData.planName,
        durationWeeks: exportData.durationWeeks,
        exercises,
        workouts,
    };
}
