import { ApiHandlerContext, ListPlansRequest, ListPlansResponse } from '../types';
import { trainingPlans } from '@/server/database';
import { toStringId } from '@/server/template/utils';
import { defineApiMeta } from '@/apis/types';

export const apiMeta = defineApiMeta<ListPlansRequest>()({
    description: "List all of the user's training plans (id, name, duration in weeks, and which one is active). Use this first to see what plans exist before reading or changing one.",
    inputSchema: {},
    agentExposed: true,
    mutates: false,
});

export const listPlans = async (
    _: ListPlansRequest,
    context: ApiHandlerContext
): Promise<ListPlansResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        const planList = await trainingPlans.findPlansByUserId(context.userId);

        // Convert to client format (handles both ObjectId and UUID string IDs)
        const plansClient = planList.map((plan) => ({
            _id: toStringId(plan._id),
            userId: toStringId(plan.userId),
            name: plan.name,
            durationWeeks: plan.durationWeeks,
            isActive: plan.isActive,
            createdAt: plan.createdAt.toISOString(),
            updatedAt: plan.updatedAt.toISOString(),
            creationSource: plan.creationSource,
        }));

        return { plans: plansClient };
    } catch (error: unknown) {
        console.error('List plans error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to list plans' };
    }
};


