import { ApiHandlerContext, GetPlanRequest, GetPlanResponse } from '../types';
import { trainingPlans } from '@/server/database';
import { toStringId } from '@/server/template/utils';
import { defineApiMeta } from '@/apis/types';
import { z } from 'zod';

export const apiMeta = defineApiMeta<GetPlanRequest>()({
    description: "Get one training plan in full detail by its id. Use after listing plans to inspect a specific plan.",
    inputSchema: {
        planId: z.string().describe('The training plan id (from training-plans/list).'),
    },
    agentExposed: true,
    mutates: false,
});

export const getPlan = async (
    request: GetPlanRequest,
    context: ApiHandlerContext
): Promise<GetPlanResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        const plan = await trainingPlans.findPlanById(request.planId, context.userId);

        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Convert to client format (handles both ObjectId and UUID string IDs)
        const planClient = {
            _id: toStringId(plan._id),
            userId: toStringId(plan.userId),
            name: plan.name,
            durationWeeks: plan.durationWeeks,
            isActive: plan.isActive,
            createdAt: plan.createdAt.toISOString(),
            updatedAt: plan.updatedAt.toISOString(),
            creationSource: plan.creationSource,
        };

        return { plan: planClient };
    } catch (error: unknown) {
        console.error('Get plan error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get plan' };
    }
};


