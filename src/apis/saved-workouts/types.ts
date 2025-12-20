import { SavedWorkoutClient, SavedWorkoutExerciseClient } from '@/server/database/collections/savedWorkouts/types';
import { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

// Extended saved workout with exercise details
export interface SavedWorkoutExerciseWithDef extends SavedWorkoutExerciseClient {
    exerciseDef: ExerciseDefinitionClient;
}

export interface SavedWorkoutWithExercises extends Omit<SavedWorkoutClient, 'exercises'> {
    exercises: SavedWorkoutExerciseWithDef[];
}

// List saved workouts
export interface ListSavedWorkoutsRequest {
    _?: never;
}

export interface ListSavedWorkoutsResponse {
    workouts?: SavedWorkoutWithExercises[];
    error?: string;
}

// Get saved workout
export interface GetSavedWorkoutRequest {
    workoutId: string;
}

export interface GetSavedWorkoutResponse {
    workout?: SavedWorkoutWithExercises;
    error?: string;
}

// Create saved workout
export interface CreateSavedWorkoutExercise {
    exerciseDefId: string;
    sets: number;
    reps: number;
    weight: number;
    durationSeconds?: number;
}

export interface CreateSavedWorkoutRequest {
    name: string;
    exercises: CreateSavedWorkoutExercise[];
}

export interface CreateSavedWorkoutResponse {
    workout?: SavedWorkoutClient;
    error?: string;
}

// Update saved workout
export interface UpdateSavedWorkoutRequest {
    workoutId: string;
    name?: string;
    exercises?: CreateSavedWorkoutExercise[];
}

export interface UpdateSavedWorkoutResponse {
    workout?: SavedWorkoutClient;
    error?: string;
}

// Delete saved workout
export interface DeleteSavedWorkoutRequest {
    workoutId: string;
}

export interface DeleteSavedWorkoutResponse {
    success?: boolean;
    error?: string;
}


