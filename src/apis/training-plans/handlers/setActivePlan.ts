import { ApiHandlerContext, SetActivePlanRequest, SetActivePlanResponse } from '../types';
import { trainingPlans } from '@/server/database';

export const setActivePlan = async (
    request: SetActivePlanRequest,
    context: ApiHandlerContext
): Promise<SetActivePlanResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        // Set as active (also deactivates other plans)
        const plan = await trainingPlans.setActivePlan(request.planId, context.userId);

        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Convert to client format
        const planClient = {
            _id: plan._id.toHexString(),
            userId: plan.userId.toHexString(),
            name: plan.name,
            durationWeeks: plan.durationWeeks,
            isActive: plan.isActive,
            createdAt: plan.createdAt.toISOString(),
            updatedAt: plan.updatedAt.toISOString(),
        };

        return { plan: planClient };
    } catch (error: unknown) {
        console.error('Set active plan error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to set active plan' };
    }
};


