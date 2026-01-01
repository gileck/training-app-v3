/**
 * Plan Data API Types
 * 
 * Types for bulk sync of plan exercises and weekly progress.
 */

// API Handler Context
export interface ApiHandlerContext {
    userId?: string;
}

// ============================================================================
// Exercise Sync Data
// ============================================================================

export interface ExerciseSyncData {
    _id: string;
    exerciseDefId: string;
    sets: number;
    reps: number;
    weight: number;
    durationSeconds: number;
    comments: string;
    order: number;
}

// ============================================================================
// Week Progress Sync Data
// ============================================================================

export interface ExerciseProgressData {
    setsCompleted: number;
    isDone: boolean;
}

/** Week number -> Exercise ID -> Progress */
export type WeekProgressSyncData = Record<number, Record<string, ExerciseProgressData>>;

// ============================================================================
// Sync Plan Data Request/Response
// ============================================================================

export interface SyncPlanDataRequest {
    planId: string;
    exercises: ExerciseSyncData[];
    weekProgress: WeekProgressSyncData;
}

export interface SyncPlanDataResponse {
    success?: boolean;
    syncedAt?: string;
    error?: string;
}
