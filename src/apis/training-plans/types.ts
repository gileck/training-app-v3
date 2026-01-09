import { TrainingPlanClient, PlanCreationSource } from '@/server/database/collections/trainingPlans/types';

// API Handler Context
export interface ApiHandlerContext {
    userId?: string;
}

// List plans
export interface ListPlansRequest {
    _?: never; // No parameters - uses userId from context
}

export interface ListPlansResponse {
    plans?: TrainingPlanClient[];
    error?: string;
}

// Get single plan
export interface GetPlanRequest {
    planId: string;
}

export interface GetPlanResponse {
    plan?: TrainingPlanClient;
    error?: string;
}

// Create plan
export interface CreatePlanRequest {
    _id?: string; // Client-generated UUID for optimistic updates
    name: string;
    durationWeeks: number;
}

export interface CreatePlanResponse {
    plan?: TrainingPlanClient;
    error?: string;
}

// Update plan
export interface UpdatePlanRequest {
    planId: string;
    name?: string;
    durationWeeks?: number;
}

export interface UpdatePlanResponse {
    plan?: TrainingPlanClient;
    error?: string;
}

// Duplicate plan
export interface DuplicatePlanRequest {
    planId: string;
}

export interface DuplicatePlanResponse {
    plan?: TrainingPlanClient;
    error?: string;
}

// Delete plan
export interface DeletePlanRequest {
    planId: string;
}

export interface DeletePlanResponse {
    success?: boolean;
    error?: string;
}

// Set active plan
export interface SetActivePlanRequest {
    planId: string;
}

export interface SetActivePlanResponse {
    plan?: TrainingPlanClient;
    error?: string;
}

// ============================================================================
// AI Plan Generation Types
// ============================================================================

// Error codes for consistent client UX
export type GeneratePlanErrorCode =
    | 'AI_UNCLEAR_INPUT'
    | 'AI_INVALID_OUTPUT'
    | 'DRAFT_MISMATCH'
    | 'VALIDATION'
    | 'UNAUTHORIZED'
    | 'SERVER_ERROR';

// Suggested match for unresolved exercises
export interface SuggestedMatch {
    exerciseDefId: string;
    name: string;
    primaryMuscle: string;
    imageUrl?: string;
    score: number; // 0-100, higher is better
    isSystem: boolean; // true = library exercise, false = custom exercise
}

// Match status for draft exercises
export type ExerciseMatchStatus = 'matched' | 'unresolved' | 'custom';

// Draft exercise (not yet persisted)
export interface DraftExercise {
    draftExerciseKey: string;
    name: string;
    sets?: number;
    reps?: number;
    durationSeconds?: number;
    weightKg?: number;
    notes?: string;
    
    // Matching status
    matchStatus: ExerciseMatchStatus;
    matchedExerciseDefId?: string;      // Set when matched or user-resolved
    matchedExerciseName?: string;       // Display name of matched exercise
    suggestedMatches?: SuggestedMatch[]; // Top suggestions for unresolved
}

// Draft workout item (references exercise by key)
export interface DraftWorkoutItem {
    draftExerciseKey: string;
    order: number;
}

// Draft workout (not yet persisted)
export interface DraftWorkout {
    name: string;
    items: DraftWorkoutItem[];
}

// Complete draft plan structure
export interface DraftPlan {
    planName: string;
    durationWeeks: number;
    exercises: DraftExercise[];
    workouts: DraftWorkout[];
}

// Generate plan from text (preview)
export interface GeneratePlanFromTextRequest {
    modelId: string;
    planName: string;
    durationWeeks: number;
    text: string;
}

export interface GeneratePlanFromTextResponse {
    preview?: DraftPlan;
    matchedCount?: number;      // Number of auto-matched exercises
    unresolvedCount?: number;   // Number requiring user resolution
    cost?: { totalCost: number };
    isFromCache?: boolean;
    error?: string;
    errorCode?: GeneratePlanErrorCode;
}

// Create plan from text (commit)
export interface CreatePlanFromTextRequest {
    planName: string;
    durationWeeks: number;
    draft: DraftPlan;
    /** 
     * When true, unresolved exercises are auto-created as custom exercises.
     * When false (default), unresolved exercises cause validation to fail.
     * Use true for share/import flows, false for AI flow (requires user resolution).
     */
    autoResolveUnmatched?: boolean;
    /**
     * How the plan was created (ai, import, share).
     * Default: 'ai' for backward compatibility.
     */
    creationSource?: PlanCreationSource;
}

export interface CreatePlanFromTextResponse {
    plan?: TrainingPlanClient;
    createdExerciseCount?: number;
    createdPlanWorkoutsCount?: number;
    error?: string;
    errorCode?: GeneratePlanErrorCode;
}

// ============================================================================
// Plan Export/Import Types
// ============================================================================

// Error codes for export/import operations
export type PlanExportImportErrorCode =
    | 'PLAN_NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'VALIDATION'
    | 'SERVER_ERROR';

// Exercise in export format (extends AI format with exerciseDefId)
export interface ExportExercise {
    name: string;
    exerciseDefId?: string;  // For fast matching on import
    sets?: number;
    reps?: number;
    durationSeconds?: number;
    weightKg?: number;
    notes?: string;
}

// Workout in export format
export interface ExportWorkout {
    name: string;
    exercises: ExportExercise[];
}

// Complete export data structure
export interface PlanExportData {
    version: string;         // "1.0"
    planName: string;
    durationWeeks: number;
    workouts: ExportWorkout[];
}

// Export plan request/response
export interface ExportPlanRequest {
    planId: string;
}

export interface ExportPlanResponse {
    exportData?: PlanExportData;
    error?: string;
    errorCode?: PlanExportImportErrorCode;
}

// Match imported plan request/response
export interface MatchImportedPlanRequest {
    importData: PlanExportData;
}

export interface MatchImportedPlanResponse {
    preview?: DraftPlan;
    matchedCount?: number;
    unresolvedCount?: number;
    error?: string;
    errorCode?: PlanExportImportErrorCode | GeneratePlanErrorCode;
}

// ============================================================================
// Shared Plan Types (Public API - no auth required)
// ============================================================================

// Error codes for shared plan operations
export type SharedPlanErrorCode =
    | 'INVALID_TOKEN'
    | 'PLAN_NOT_FOUND'
    | 'SERVER_ERROR';

// Get shared plan request/response
export interface GetSharedPlanRequest {
    token: string;  // base64url encoded { u: userId, p: planId }
}

export interface GetSharedPlanResponse {
    exportData?: PlanExportData;
    ownerName?: string;  // Plan owner's display name (for UI)
    error?: string;
    errorCode?: SharedPlanErrorCode;
}
