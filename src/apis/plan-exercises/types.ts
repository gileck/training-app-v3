import { PlanExerciseClient } from '@/server/database/collections/planExercises/types';
import { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

// API Handler Context
export interface ApiHandlerContext {
    userId?: string;
}

// Extended plan exercise with exercise definition details
export interface PlanExerciseWithDefinition extends PlanExerciseClient {
    exerciseDef: ExerciseDefinitionClient;
}

// List plan exercises
export interface ListPlanExercisesRequest {
    planId: string;
}

export interface ListPlanExercisesResponse {
    exercises?: PlanExerciseWithDefinition[];
    error?: string;
}

// Add exercise to plan
export interface AddPlanExerciseRequest {
    planId: string;
    exerciseDefId: string;
    sets: number;
    reps: number;
    weight?: number;
    durationSeconds?: number;
    comments?: string;
}

export interface AddPlanExerciseResponse {
    exercise?: PlanExerciseWithDefinition;
    error?: string;
}

// Update plan exercise
export interface UpdatePlanExerciseRequest {
    planExerciseId: string;
    sets?: number;
    reps?: number;
    weight?: number;
    durationSeconds?: number;
    comments?: string;
}

export interface UpdatePlanExerciseResponse {
    exercise?: PlanExerciseClient;
    error?: string;
}

// Delete plan exercise
export interface DeletePlanExerciseRequest {
    planExerciseId: string;
}

export interface DeletePlanExerciseResponse {
    success?: boolean;
    error?: string;
}

// Reorder plan exercises
export interface ReorderPlanExercisesRequest {
    planId: string;
    exerciseIds: string[]; // Ordered array of plan exercise IDs
}

export interface ReorderPlanExercisesResponse {
    success?: boolean;
    error?: string;
}

// Bulk add exercises to plan
export interface BulkAddExerciseItem {
    exerciseDefId: string;
    sets: number;
    reps: number;
    weight?: number;
    durationSeconds?: number;
    comments?: string;
}

export interface BulkAddPlanExercisesRequest {
    planId: string;
    exercises: BulkAddExerciseItem[];
}

export interface BulkAddResult {
    exerciseDefId: string;
    exercise?: PlanExerciseWithDefinition;
    error?: string;
}

export interface BulkAddPlanExercisesResponse {
    results?: BulkAddResult[];
    addedCount?: number;
    failedCount?: number;
    error?: string;
}

