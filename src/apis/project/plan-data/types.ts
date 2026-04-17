/**
 * Plan Data API Types
 *
 * Types for bulk sync of plan exercises and weekly progress.
 */

import type { ExerciseDefinitionOverrides } from '@/apis/project/plan-exercises/types';

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
    /**
     * Optional per-instance overrides of the base exercise definition.
     * Only included in the payload when the client explicitly has overrides
     * to sync; older clients that don't know about overrides simply omit
     * the field and the server preserves whatever is already stored.
     */
    overrides?: ExerciseDefinitionOverrides;
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

// ============================================================================
// Plan Version (lightweight staleness check)
// ============================================================================

export interface GetPlanVersionRequest {
    planId: string;
}

export interface GetPlanVersionResponse {
    /**
     * Max `updatedAt` across the plan's documents (plan itself + exercises +
     * workouts + progress + notes), as unix ms. `null` if plan has no data.
     * Callers compare against their last known sync time to decide whether
     * the server has changes they haven't pulled yet.
     */
    lastModifiedAt?: number | null;
    error?: string;
}
