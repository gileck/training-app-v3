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

// Update sets (add, remove, or complete all remaining sets)
export interface UpdateSetsRequest {
    planId: string;
    planExerciseId: string;
    weekNumber: number;
    action: 'add' | 'remove' | 'complete-all';
    targetSets?: number; // Required for complete-all to know how many sets to add
}

export interface UpdateSetsResponse {
    setsCompleted?: number;
    isDone?: boolean;
    error?: string;
}

// Weekly Notes - Per Exercise Per Week
export interface ExerciseNoteClient {
    weekNumber: number;
    content: string;
    updatedAt: string;
}

export interface GetExerciseNotesRequest {
    planId: string;
    exerciseDefId: string;
    weekNumber: number; // Current week to highlight
}

export interface GetExerciseNotesResponse {
    currentNote?: string; // Note for current week (if exists)
    previousNotes?: ExerciseNoteClient[]; // Notes from other weeks
    error?: string;
}

export interface UpdateExerciseNoteRequest {
    planId: string;
    exerciseDefId: string;
    weekNumber: number;
    content: string;
}

export interface UpdateExerciseNoteResponse {
    note?: string;
    error?: string;
}

