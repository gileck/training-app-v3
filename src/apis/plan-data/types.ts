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
// Exercise Overrides (for sync)
// ============================================================================

export interface ExerciseOverridesSyncData {
    name?: string;
    imageUrl?: string;
    primaryMuscle?: string;
    secondaryMuscles?: string[];
    type?: string;
    isBodyweight?: boolean;
    isStatic?: boolean;
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
    /** User overrides for exercise definition fields */
    overrides?: ExerciseOverridesSyncData;
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
    /** Client's last known sync timestamp (for conflict detection) */
    clientLastSyncedAt?: number | null;
    /** Force sync even if conflict detected */
    forceSync?: boolean;
}

export interface SyncPlanDataResponse {
    success?: boolean;
    syncedAt?: string;
    error?: string;
    /** Conflict detected - server has newer changes */
    conflict?: boolean;
    /** Server's last sync timestamp (when conflict detected) */
    serverLastSyncedAt?: number;
}
