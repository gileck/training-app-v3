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
 * Exercises are marked as 'unresolved' with their original exerciseDefId passed through.
 * The backend will handle matching when `autoResolveUnmatched=true`:
 * 1. First tries to match by exerciseDefId (fast path for system exercises)
 * 2. Then tries to match by name
 * 3. Creates as custom exercise only if no match found
 */
export function exportDataToDraftPlan(exportData: PlanExportData): DraftPlan {
    const exercises: DraftExercise[] = [];
    const workouts: DraftWorkout[] = [];
    
    exportData.workouts.forEach((exportWorkout, workoutIndex) => {
        const workoutItems: DraftWorkout['items'] = [];
        
        exportWorkout.exercises.forEach((exportExercise, exerciseIndex) => {
            // Generate a unique key for this exercise
            const draftExerciseKey = `w${workoutIndex}-e${exerciseIndex}`;
            
            // Create draft exercise - mark as 'unresolved' so backend handles matching
            // Pass exerciseDefId for ID-based matching (works for system exercises)
            const draftExercise: DraftExercise = {
                draftExerciseKey,
                name: exportExercise.name,
                matchStatus: 'unresolved', // Backend will match by ID then name
                matchedExerciseDefId: exportExercise.exerciseDefId, // Original ID for matching
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
