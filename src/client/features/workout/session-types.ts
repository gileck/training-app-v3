import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';

export type SessionSource = 'plan' | 'saved-workout';

export interface WorkoutSession {
    isActive: boolean;
    startedAt: number | null;
    currentExerciseIndex: number;
    exercises: ExerciseWeekProgress[];
    restTimerEndAt: number | null;
    restTimerDuration: number; // in seconds
    completedSetsThisSession: number;
    /** Tracks where the session originated from - affects whether sets sync to backend */
    sessionSource: SessionSource | null;
}

export interface WorkoutSessionState extends WorkoutSession {
    // Actions
    startSession: (exercises: ExerciseWeekProgress[], source?: SessionSource) => void;
    endSession: () => void;
    setCurrentExercise: (index: number) => void;
    startRestTimer: (durationSeconds?: number) => void;
    cancelRestTimer: () => void;
    incrementCompletedSets: () => void;
    updateExercises: (exercises: ExerciseWeekProgress[]) => void;
}

// Default rest times by exercise type
export const DEFAULT_REST_TIMES = {
    heavy: 180, // 3 minutes for heavy compound movements
    moderate: 90, // 90 seconds for moderate exercises
    light: 60, // 60 seconds for light exercises
    default: 90,
};

// Get recommended rest time based on exercise
export function getRecommendedRestTime(exercise: ExerciseWeekProgress): number {
    const { exerciseDef, planExercise } = exercise;
    
    // Static exercises (planks, holds) - shorter rest
    if (exerciseDef.isStatic) {
        return DEFAULT_REST_TIMES.light;
    }
    
    // Heavy compound movements (high weight, low reps)
    if (planExercise.reps <= 6 && planExercise.weight > 50) {
        return DEFAULT_REST_TIMES.heavy;
    }
    
    // Moderate exercises
    if (planExercise.reps <= 12) {
        return DEFAULT_REST_TIMES.moderate;
    }
    
    // Light exercises (high reps, low weight, bodyweight)
    return DEFAULT_REST_TIMES.light;
}


