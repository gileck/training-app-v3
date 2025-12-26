import { ObjectId } from 'mongodb';
import type { ApiHandlerContext } from '@/apis/types';
import type { GetActivitySummaryRequest, GetActivitySummaryResponse, DailySummary } from '../types';
import * as setLogs from '@/server/database/collections/setLogs';
import * as planExercises from '@/server/database/collections/planExercises';
import * as exerciseDefinitions from '@/server/database/collections/exerciseDefinitions';

export async function getActivitySummary(
    request: GetActivitySummaryRequest,
    context: ApiHandlerContext
): Promise<GetActivitySummaryResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        const userId = new ObjectId(context.userId);

        // Build filter
        const filter: Record<string, unknown> = { userId };

        if (request.planId) {
            filter.planId = new ObjectId(request.planId);
        }

        // Default date range based on period if not specified
        const now = new Date();
        let startDate = request.startDate ? new Date(request.startDate) : null;

        // For endDate: if provided as date string, add 1 day for exclusive upper bound
        // to include the entire end date. Otherwise use current time.
        let endDateFilter: { $lte?: Date; $lt?: Date };
        if (request.endDate) {
            const endDateExclusive = new Date(request.endDate);
            endDateExclusive.setDate(endDateExclusive.getDate() + 1);
            endDateFilter = { $lt: endDateExclusive };
        } else {
            endDateFilter = { $lte: now };
        }

        if (!startDate) {
            switch (request.period) {
                case 'day':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
                    break;
                case 'month':
                    startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // Last year
                    break;
            }
        }

        filter.completedAt = {
            $gte: startDate,
            ...endDateFilter,
        };

        // Get all logs in the date range
        const logs = await setLogs.findSetLogsByFilter(filter, 10000); // High limit for aggregation

        // Cache for exercise lookups
        const exerciseCache = new Map<string, string>(); // planExerciseId -> primaryMuscle
        const planExerciseToDefCache = new Map<string, string>(); // planExerciseId -> exerciseDefId

        // Group by date
        const dailyMap = new Map<string, {
            sets: number;
            exerciseIds: Set<string>;
            muscles: Set<string>;
        }>();

        for (const log of logs) {
            // Get date key based on period
            const logDate = new Date(log.completedAt);
            let dateKey: string;

            switch (request.period) {
                case 'day':
                    dateKey = logDate.toISOString().split('T')[0]; // YYYY-MM-DD
                    break;
                case 'week': {
                    // Get start of week (Monday)
                    const day = logDate.getDay();
                    const diff = logDate.getDate() - day + (day === 0 ? -6 : 1);
                    const weekStartDate = new Date(logDate);
                    weekStartDate.setDate(diff);
                    dateKey = weekStartDate.toISOString().split('T')[0];
                    break;
                }
                case 'month':
                    dateKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-01`;
                    break;
            }

            // Initialize daily entry if not exists
            if (!dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, {
                    sets: 0,
                    exerciseIds: new Set(),
                    muscles: new Set(),
                });
            }

            const entry = dailyMap.get(dateKey)!;
            entry.sets += 1;
            entry.exerciseIds.add(log.planExerciseId.toHexString());

            // Get primary muscle for this exercise
            let primaryMuscle = exerciseCache.get(log.planExerciseId.toHexString());
            if (!primaryMuscle) {
                // Get exercise def ID from plan exercise
                let exerciseDefId = planExerciseToDefCache.get(log.planExerciseId.toHexString());
                if (!exerciseDefId) {
                    const planExercise = await planExercises.findPlanExerciseById(log.planExerciseId.toHexString());
                    if (planExercise) {
                        exerciseDefId = planExercise.exerciseDefId.toHexString();
                        planExerciseToDefCache.set(log.planExerciseId.toHexString(), exerciseDefId);
                    }
                }

                if (exerciseDefId) {
                    const exerciseDef = await exerciseDefinitions.findExerciseById(exerciseDefId);
                    if (exerciseDef) {
                        primaryMuscle = exerciseDef.primaryMuscle;
                        exerciseCache.set(log.planExerciseId.toHexString(), primaryMuscle);
                    }
                }
            }

            if (primaryMuscle) {
                entry.muscles.add(primaryMuscle);
            }
        }

        // Convert map to sorted array
        const summaries: DailySummary[] = Array.from(dailyMap.entries())
            .map(([date, data]) => ({
                date,
                totalSets: data.sets,
                totalExercises: data.exerciseIds.size,
                muscleGroups: Array.from(data.muscles),
            }))
            .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first

        const totalSets = summaries.reduce((sum, s) => sum + s.totalSets, 0);
        const totalWorkoutDays = summaries.filter(s => s.totalSets > 0).length;

        return { summaries, totalSets, totalWorkoutDays };
    } catch (error) {
        console.error('Error getting activity summary:', error);
        return { error: 'Failed to get activity summary' };
    }
}
