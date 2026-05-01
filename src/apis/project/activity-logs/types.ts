import type { SetLogClient } from '@/server/database/collections/project/setLogs/types';

// Extended SetLog with exercise info for display
export interface ActivityLogEntry extends SetLogClient {
    exerciseName: string;
    exerciseImageUrl: string;
    primaryMuscle: string;
    planName: string;
}

// Get Activity (recent set logs)
export interface GetActivityRequest {
    planId?: string; // Optional filter by plan
    startDate?: string; // ISO date string
    endDate?: string; // ISO date string
    limit?: number; // Max entries to return (default 50)
}

export interface GetActivityResponse {
    activities?: ActivityLogEntry[];
    total?: number;
    error?: string;
}

// Get Activity Summary (aggregated stats)
export interface GetActivitySummaryRequest {
    planId?: string; // Optional filter by plan
    period: 'day' | 'week' | 'month'; // Aggregation period
    startDate?: string; // ISO date string
    endDate?: string; // ISO date string
}

export interface DailySummary {
    date: string; // ISO date string (YYYY-MM-DD)
    totalSets: number;
    totalExercises: number; // Unique exercises
    muscleGroups: string[]; // Primary muscles worked
}

export interface GetActivitySummaryResponse {
    summaries?: DailySummary[];
    totalSets?: number;
    totalWorkoutDays?: number;
    error?: string;
}

// Get Exercise History (for exercise details)
export interface GetExerciseHistoryRequest {
    exerciseDefId: string;
    limit?: number; // Max entries to return (default 20)
}

export interface ExerciseHistoryEntry {
    date: string; // ISO date string
    planName: string;
    weekNumber: number;
    setsCompleted: number;
}

export interface GetExerciseHistoryResponse {
    history?: ExerciseHistoryEntry[];
    error?: string;
}

// Delete Activity
export interface DeleteActivityRequest {
    activityId: string;
}

export interface DeleteActivityResponse {
    success?: boolean;
    error?: string;
}

// Bulk Delete Activity
export interface BulkDeleteActivityRequest {
    activityIds: string[];
}

export interface BulkDeleteActivityResponse {
    deletedCount?: number;
    error?: string;
}

// Edit Activity (update date)
export interface EditActivityRequest {
    activityId: string;
    completedAt: string; // ISO date string
}

export interface EditActivityResponse {
    success?: boolean;
    error?: string;
}

// Duplicate Activity
export interface DuplicateActivityRequest {
    _id?: string; // Client-generated UUID for optimistic updates
    activityId: string;
    completedAt?: string; // Optional: new date, defaults to now
}

export interface DuplicateActivityResponse {
    activity?: ActivityLogEntry;
    error?: string;
}

// Get Recovery Score
export interface GetRecoveryScoreRequest {
    planId?: string; // Optional filter by plan
    lookbackDays?: number; // Days for weighted score (default 10)
    baselineDays?: number; // Days for baseline calculation (default 30)
}

export interface RecoveryScoreDailyLoad {
    date: string;
    sets: number;
    loadPercent: number;
    weight: number;
    weightedLoad: number;
}

export interface GetRecoveryScoreResponse {
    score?: number;
    label?: string;
    color?: string;
    dailyLoads?: RecoveryScoreDailyLoad[];
    baseline?: number;
    error?: string;
}

// Add Activity (create new set logs)
export interface AddActivityRequest {
    activityIds?: string[]; // Client-generated UUIDs for optimistic updates (one per set)
    planExerciseId: string;
    completedAt: string; // ISO date string
    numberOfSets: number; // How many sets to create
}

export interface AddActivityResponse {
    activities?: ActivityLogEntry[];
    error?: string;
}

