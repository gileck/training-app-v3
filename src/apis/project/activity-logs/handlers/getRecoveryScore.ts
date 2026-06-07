import type { GetRecoveryScoreRequest, GetRecoveryScoreResponse } from '../types';
import type { ApiHandlerContext } from '@/apis/types';
import { defineApiMeta } from '@/apis/types';
import { z } from 'zod';
import { getActivitySummary } from './getActivitySummary';
import { calculateRecoveryScore } from '@/shared/utils/recoveryScore';

export const apiMeta = defineApiMeta<GetRecoveryScoreRequest>()({
    description: "Get the user's recovery score, derived from recent training volume vs a longer baseline. Use to advise on readiness, fatigue, and whether to push or deload.",
    inputSchema: {
        planId: z.string().optional().describe('Filter to a specific plan (optional).'),
        lookbackDays: z.number().int().optional().describe('Days of recent load for the weighted score (default 10).'),
        baselineDays: z.number().int().optional().describe('Days used for the baseline (default 30).'),
    },
    agentExposed: true,
    mutates: false,
});

/**
 * Calculate recovery score based on recent training volume
 */
export async function getRecoveryScore(
    request: GetRecoveryScoreRequest,
    context: ApiHandlerContext
): Promise<GetRecoveryScoreResponse> {
    try {
        const { planId, lookbackDays = 10, baselineDays = 30 } = request;

        // Fetch activity summaries - we need enough days for baseline calculation
        const summaryResponse = await getActivitySummary(
            {
                period: 'day',
                // Get a bit more than baselineDays to ensure we have enough data
                startDate: new Date(Date.now() - baselineDays * 2 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split('T')[0],
                ...(planId ? { planId } : {}),
            },
            context
        );

        if (summaryResponse.error) {
            return { error: summaryResponse.error };
        }

        const summaries = summaryResponse.summaries ?? [];

        // Calculate recovery score
        const result = calculateRecoveryScore(summaries, lookbackDays, baselineDays);

        return {
            score: result.score,
            label: result.label,
            color: result.color,
            dailyLoads: result.dailyLoads,
            baseline: result.baseline,
        };
    } catch (error) {
        console.error('getRecoveryScore error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to calculate recovery score',
        };
    }
}
