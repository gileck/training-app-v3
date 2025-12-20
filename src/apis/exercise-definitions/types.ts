import { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

// API Handler Context
export interface ApiHandlerContext {
    userId?: string;
}

// List exercises
export interface ListExercisesRequest {
    includeCustom?: boolean; // Include user's custom exercises (default: true)
}

export interface ListExercisesResponse {
    exercises?: ExerciseDefinitionClient[];
    error?: string;
}

// Get single exercise
export interface GetExerciseRequest {
    exerciseId: string;
}

export interface GetExerciseResponse {
    exercise?: ExerciseDefinitionClient;
    error?: string;
}

