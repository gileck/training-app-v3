import { ApiHandlerContext, CreatePlanRequest, CreatePlanResponse } from '../types';
import { trainingPlans } from '@/server/database';
import { toStringId, toDocumentId } from '@/server/template/utils';

export const createPlan = async (
    request: CreatePlanRequest,
    context: ApiHandlerContext
): Promise<CreatePlanResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.name || request.name.trim() === '') {
            return { error: 'Plan name is required' };
        }

        if (!request.durationWeeks || request.durationWeeks < 1) {
            return { error: 'Duration must be at least 1 week' };
        }

        if (request.durationWeeks > 52) {
            return { error: 'Duration cannot exceed 52 weeks' };
        }

        const now = new Date();

        // Check if user has any existing plans
        const existingPlans = await trainingPlans.findPlansByUserId(context.userId);
        const isFirstPlan = existingPlans.length === 0;

        const planData = {
            _id: request._id, // Pass client-generated ID if provided
            userId: toDocumentId(context.userId),
            name: request.name.trim(),
            durationWeeks: request.durationWeeks,
            isActive: isFirstPlan, // First plan is automatically active
            createdAt: now,
            updatedAt: now,
            creationSource: 'manual' as const,
        };

        const newPlan = await trainingPlans.createPlan(planData);

        // Convert to client format (handle both ObjectId and UUID string)
        const planClient = {
            _id: toStringId(newPlan._id),
            userId: toStringId(newPlan.userId),
            name: newPlan.name,
            durationWeeks: newPlan.durationWeeks,
            isActive: newPlan.isActive,
            createdAt: newPlan.createdAt.toISOString(),
            updatedAt: newPlan.updatedAt.toISOString(),
            creationSource: newPlan.creationSource,
        };

        return { plan: planClient };
    } catch (error: unknown) {
        console.error('Create plan error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to create plan' };
    }
};
