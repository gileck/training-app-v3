import type { SetLogClient } from '@/server/database/collections/setLogs/types';

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

