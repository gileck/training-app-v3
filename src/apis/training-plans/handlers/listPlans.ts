import { ApiHandlerContext, ListPlansRequest, ListPlansResponse } from '../types';
import { trainingPlans } from '@/server/database';

export const listPlans = async (
    _: ListPlansRequest,
    context: ApiHandlerContext
): Promise<ListPlansResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        const planList = await trainingPlans.findPlansByUserId(context.userId);

        // Convert to client format
        const plansClient = planList.map((plan) => ({
            _id: plan._id.toHexString(),
            userId: plan.userId.toHexString(),
            name: plan.name,
            durationWeeks: plan.durationWeeks,
            isActive: plan.isActive,
            createdAt: plan.createdAt.toISOString(),
            updatedAt: plan.updatedAt.toISOString(),
        }));

        return { plans: plansClient };
    } catch (error: unknown) {
        console.error('List plans error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to list plans' };
    }
};


