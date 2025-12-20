import { PlanExerciseClient } from '@/server/database/collections/planExercises/types';
import { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

// API Handler Context
export interface ApiHandlerContext {
    userId?: string;
}

// Exercise progress for the week
export interface ExerciseWeekProgress {
    planExerciseId: string;
    targetSets: number;
    setsCompleted: number;
    isDone: boolean;
    exerciseDef: ExerciseDefinitionClient;
    planExercise: PlanExerciseClient;
}

// Get week progress
export interface GetWeekProgressRequest {
    planId: string;
    weekNumber: number;
}

export interface GetWeekProgressResponse {
    weekNumber?: number;
    totalSets?: number;
    completedSets?: number;
    progressPercent?: number;
    exercises?: ExerciseWeekProgress[];
    error?: string;
}

// Update sets (add or remove a set)
export interface UpdateSetsRequest {
    planId: string;
    planExerciseId: string;
    weekNumber: number;
    action: 'add' | 'remove';
}

export interface UpdateSetsResponse {
    setsCompleted?: number;
    isDone?: boolean;
    error?: string;
}

