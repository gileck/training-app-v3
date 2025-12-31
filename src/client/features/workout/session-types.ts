import type { ExerciseWeekProgress } from '@/apis/weekly-progress/types';

export interface WorkoutSession {
    isActive: boolean;
    startedAt: number | null;
    currentExerciseIndex: number;
    exercises: ExerciseWeekProgress[];
    restTimerEndAt: number | null;
    restTimerDuration: number; // in seconds
    completedSetsThisSession: number;
    /** Whether to auto-start the rest timer after completing a set */
    autoStartTimer: boolean;
    /** ID of the plan-workout this session is based on (null = ad-hoc unsaved) */
    planWorkoutId: string | null;
    /** Name of the plan-workout this session is based on */
    planWorkoutName: string | null;
    /** Whether user is actively performing a set (vs resting) */
    isInSet: boolean;
    /** Super set mode state */
    supersetEnabled: boolean;
    supersetExerciseIds: string[]; // planExerciseIds (2 items when enabled)
}

export interface WorkoutSessionState extends WorkoutSession {
    // Actions
    startSession: (exercises: ExerciseWeekProgress[]) => void;
    endSession: () => void;
    setCurrentExercise: (index: number) => void;
    startRestTimer: (durationSeconds?: number) => void;
    setRestTimerDuration: (durationSeconds: number) => void;
    cancelRestTimer: () => void;
    incrementCompletedSets: () => void;
    updateExercises: (exercises: ExerciseWeekProgress[]) => void;
    toggleAutoStartTimer: () => void;
    setPlanWorkoutId: (id: string | null) => void;
    setPlanWorkoutName: (name: string | null) => void;
    setIsInSet: (isInSet: boolean) => void;
    setSupersetEnabled: (enabled: boolean) => void;
    setSupersetExerciseIds: (exerciseIds: string[]) => void;
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


