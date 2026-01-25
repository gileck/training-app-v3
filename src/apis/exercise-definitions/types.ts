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

// Create custom exercise
export interface CreateExerciseRequest {
    name: string;
    imageBase64?: string; // Base64 encoded image data
    primaryMuscle: string;
    secondaryMuscles?: string[];
    type?: string;
    isBodyweight?: boolean;
    isStatic?: boolean;
}

export interface CreateExerciseResponse {
    exercise?: ExerciseDefinitionClient;
    error?: string;
}

// Update custom exercise
export interface UpdateExerciseRequest {
    exerciseId: string;
    name?: string;
    imageBase64?: string; // Base64 encoded image data
    primaryMuscle?: string;
    secondaryMuscles?: string[];
    type?: string;
    isBodyweight?: boolean;
    isStatic?: boolean;
}

export interface UpdateExerciseResponse {
    exercise?: ExerciseDefinitionClient;
    error?: string;
}

// Delete custom exercise
export interface DeleteExerciseRequest {
    exerciseId: string;
}

export interface DeleteExerciseResponse {
    success?: boolean;
    error?: string;
}

// Get unique muscle groups from exercise library
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GetMuscleGroupsRequest {
    // No parameters needed - returns all unique muscle groups from exercises
}

export interface GetMuscleGroupsResponse {
    muscleGroups?: string[];
    error?: string;
}

