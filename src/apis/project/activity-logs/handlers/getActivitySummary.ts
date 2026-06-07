import type { ApiHandlerContext } from '@/apis/types';
import { defineApiMeta } from '@/apis/types';
import { z } from 'zod';
import type { GetActivitySummaryRequest, GetActivitySummaryResponse, DailySummary } from '../types';
import * as setLogs from '@/server/database/collections/project/setLogs';
import * as planExercises from '@/server/database/collections/project/planExercises';
import * as exerciseDefinitions from '@/server/database/collections/project/exerciseDefinitions';
import { toStringId, toQueryId, toDocumentId } from '@/server/template/utils';

export const apiMeta = defineApiMeta<GetActivitySummaryRequest>()({
    description: "Get the user's training volume summarized per day, week, or month (aggregated activity). Use for 'how active was I this week/month' questions and trend analysis.",
    inputSchema: {
        period: z.enum(['day', 'week', 'month']).describe('Aggregation period for the summary.'),
        planId: z.string().optional().describe('Filter to a specific plan (optional).'),
        startDate: z.string().optional().describe('ISO date string — start of range (optional).'),
        endDate: z.string().optional().describe('ISO date string — end of range (optional).'),
    },
    agentExposed: true,
    mutates: false,
});

/**
 * Get date key for grouping based on aggregation period
 */
function getDateKey(logDate: Date, period: 'day' | 'week' | 'month'): string {
    switch (period) {
        case 'day':
            return logDate.toISOString().split('T')[0]; // YYYY-MM-DD
        case 'week': {
            // Get start of week (Monday)
            const day = logDate.getDay();
            const diff = logDate.getDate() - day + (day === 0 ? -6 : 1);
            const weekStartDate = new Date(logDate);
            weekStartDate.setDate(diff);
            return weekStartDate.toISOString().split('T')[0];
        }
        case 'month':
            return `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-01`;
    }
}

export async function getActivitySummary(
    request: GetActivitySummaryRequest,
    context: ApiHandlerContext
): Promise<GetActivitySummaryResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        const userId = toDocumentId(context.userId);

        // Build filter
        const filter: Record<string, unknown> = { userId };

        if (request.planId) {
            filter.planId = toQueryId(request.planId); // Handles both ObjectId and UUID formats
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

        // Get all logs in the date range (1 query)
        const logs = await setLogs.findSetLogsByFilter(filter, 10000); // High limit for aggregation

        if (logs.length === 0) {
            return { summaries: [], totalSets: 0, totalWorkoutDays: 0 };
        }

        // Collect unique planExerciseIds for batch lookup
        const uniquePlanExerciseIds = [...new Set(logs.map((log) => toStringId(log.planExerciseId)))];

        // Batch fetch planExercises (1 query)
        const planExerciseList = await planExercises.findPlanExercisesByIds(uniquePlanExerciseIds);

        // Build planExercise lookup map and collect unique exerciseDefIds
        const planExerciseMap = new Map<string, string>(); // planExerciseId -> exerciseDefId
        const uniqueExerciseDefIds: string[] = [];
        for (const pe of planExerciseList) {
            const peId = toStringId(pe._id);
            const exDefId = toStringId(pe.exerciseDefId);
            planExerciseMap.set(peId, exDefId);
            if (!uniqueExerciseDefIds.includes(exDefId)) {
                uniqueExerciseDefIds.push(exDefId);
            }
        }

        // Batch fetch exercise definitions (1 query)
        const exerciseDefList = await exerciseDefinitions.findExercisesByIds(uniqueExerciseDefIds);

        // Build exercise lookup map: exerciseDefId -> primaryMuscle
        const exerciseDefMap = new Map<string, string>();
        for (const exDef of exerciseDefList) {
            exerciseDefMap.set(toStringId(exDef._id), exDef.primaryMuscle);
        }

        // Build combined lookup: planExerciseId -> primaryMuscle
        const muscleMap = new Map<string, string>();
        for (const [peId, exDefId] of planExerciseMap) {
            const muscle = exerciseDefMap.get(exDefId);
            if (muscle) {
                muscleMap.set(peId, muscle);
            }
        }

        // Group by date (no DB calls)
        const dailyMap = new Map<string, {
            sets: number;
            exerciseIds: Set<string>;
            muscles: Set<string>;
        }>();

        for (const log of logs) {
            const dateKey = getDateKey(new Date(log.completedAt), request.period);

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

            const planExerciseIdStr = toStringId(log.planExerciseId);
            entry.exerciseIds.add(planExerciseIdStr);

            // Get primary muscle from lookup map (no DB call)
            const primaryMuscle = muscleMap.get(planExerciseIdStr);
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
