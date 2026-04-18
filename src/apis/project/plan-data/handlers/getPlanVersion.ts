/**
 * Returns `plan.updatedAt` as a unix-ms timestamp. The client compares this
 * against its cached `lastSyncedAt` to detect writes from other sources
 * (other devices, the MCP server on behalf of an agent).
 *
 * Every handler that mutates data under a plan calls
 * `trainingPlans.touchPlan(planId)` so this one field is the authoritative
 * "something about this plan changed" marker.
 */

import { trainingPlans } from '@/server/database';
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

    const plan = await trainingPlans.findPlanById(request.planId, context.userId);
    if (!plan) return { error: 'Plan not found' };

    return {
        lastModifiedAt: plan.updatedAt instanceof Date ? plan.updatedAt.getTime() : null,
    };
};
