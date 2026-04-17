/**
 * Returns `max(updatedAt)` across the plan's tracked documents, used by the
 * client's local-first sync as a cheap staleness check to pick up writes
 * made by other sources (another device, the MCP server acting on behalf of
 * an agent). Each underlying read uses a `{ planId, updatedAt }` compound
 * index ensured on first call.
 */

import { trainingPlans, planExercises, planWorkouts, weeklyNotes } from '@/server/database';
import type {
    ApiHandlerContext,
    GetPlanVersionRequest,
    GetPlanVersionResponse,
} from '../types';

export const getPlanVersion = async (
    request: GetPlanVersionRequest,
    context: ApiHandlerContext,
): Promise<GetPlanVersionResponse> => {
    if (!context.userId) return { error: 'Not authenticated' };
    if (!request.planId) return { error: 'Plan ID is required' };

    const [plan, exercises, workouts, notes] = await Promise.all([
        trainingPlans.findPlanById(request.planId, context.userId),
        planExercises.findLatestUpdatedAtByPlanId(request.planId),
        planWorkouts.findLatestUpdatedAtByPlanId(request.planId),
        weeklyNotes.findLatestUpdatedAtByPlanId(request.planId),
    ]);

    if (!plan) return { error: 'Plan not found' };

    const times = [plan.updatedAt, exercises, workouts, notes]
        .filter((d): d is Date => d instanceof Date)
        .map((d) => d.getTime());

    return { lastModifiedAt: times.length ? Math.max(...times) : null };
};
