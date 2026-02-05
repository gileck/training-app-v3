import type { PlanWorkoutClient, PlanWorkoutItemClient } from '@/server/database/collections/project/planWorkouts/types';

// Re-export for convenience
export type { PlanWorkoutClient, PlanWorkoutItemClient };

// Handler context
export interface ApiHandlerContext {
    userId?: string;
}

// ============================================================================
// List Plan Workouts
// ============================================================================

export interface ListPlanWorkoutsRequest {
    planId: string;
}

export interface ListPlanWorkoutsResponse {
    workouts?: PlanWorkoutClient[];
    error?: string;
}

// ============================================================================
// Create Plan Workout
// ============================================================================

export interface CreatePlanWorkoutRequest {
    _id?: string; // Client-generated UUID for optimistic updates
    planId: string;
    name: string;
    items: { planExerciseId: string; order: number; sets?: number }[];
}

export interface CreatePlanWorkoutResponse {
    workout?: PlanWorkoutClient;
    error?: string;
}

// ============================================================================
// Update Plan Workout
// ============================================================================

export interface UpdatePlanWorkoutRequest {
    planId: string;
    workoutId: string;
    name?: string;
    items?: { planExerciseId: string; order: number; sets?: number }[];
}

export interface UpdatePlanWorkoutResponse {
    workout?: PlanWorkoutClient;
    error?: string;
}

// ============================================================================
// Delete Plan Workout
// ============================================================================

export interface DeletePlanWorkoutRequest {
    planId: string;
    workoutId: string;
}

export interface DeletePlanWorkoutResponse {
    success?: boolean;
    error?: string;
}

// ============================================================================
// Reorder Plan Workouts
// ============================================================================

export interface ReorderPlanWorkoutsRequest {
    planId: string;
    workoutIds: string[];
}

export interface ReorderPlanWorkoutsResponse {
    success?: boolean;
    error?: string;
}
