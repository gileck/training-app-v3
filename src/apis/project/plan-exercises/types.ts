import { PlanExerciseClient, PlanExerciseOverrides } from '@/server/database/collections/project/planExercises/types';
import { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';

// API Handler Context
export interface ApiHandlerContext {
    userId?: string;
}

/**
 * Sparse per-plan-exercise override of the base exercise definition.
 * Only keys whose values differ from the base are stored. Applied via
 * mergeExerciseDef(base, overrides) at display time.
 *
 * This is the single source of truth for the override shape. Re-exported
 * from the DB schema type so client/API code and DB code can't drift.
 */
export type ExerciseDefinitionOverrides = PlanExerciseOverrides;

// Extended plan exercise with exercise definition details.
// exerciseDef is the MERGED effective def (base merged with overrides);
// overrides is the raw sparse override object for display-time checks
// (e.g. rendering a "customized" badge).
export interface PlanExerciseWithDefinition extends PlanExerciseClient {
    exerciseDef: ExerciseDefinitionClient;
    overrides?: ExerciseDefinitionOverrides;
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
    _id?: string; // Client-generated UUID for optimistic updates
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
    _id?: string; // Client-generated UUID for optimistic updates
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

// Upload an image for a plan-exercise override.
// Client picks an image, converts to base64, posts here, gets back the
// Vercel Blob URL, then writes that URL into overrides.imageUrl on the
// plan-exercise and lets the normal debounced sync persist it.
export interface UploadOverrideImageRequest {
    imageBase64: string;
}

export interface UploadOverrideImageResponse {
    imageUrl?: string;
    error?: string;
}

