import { ApiHandlerContext, UpdatePlanRequest, UpdatePlanResponse } from '../types';
import { trainingPlans } from '@/server/database';
import { toStringId } from '@/server/template/utils';
import { defineApiMeta } from '@/apis/types';
import { z } from 'zod';

export const apiMeta = defineApiMeta<UpdatePlanRequest>()({
    description: "Update a training plan's name and/or duration. Only the fields you pass are changed.",
    inputSchema: {
        planId: z.string().describe('Plan id to update.'),
        name: z.string().optional().describe('New plan name (optional).'),
        durationWeeks: z.number().int().min(1).optional().describe('New duration in weeks (optional).'),
    },
    agentExposed: true,
    mutates: true,
});

export const updatePlan = async (
    request: UpdatePlanRequest,
    context: ApiHandlerContext
): Promise<UpdatePlanResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        // Validate inputs
        if (request.name !== undefined && request.name.trim() === '') {
            return { error: 'Plan name cannot be empty' };
        }

        if (request.durationWeeks !== undefined) {
            if (request.durationWeeks < 1) {
                return { error: 'Duration must be at least 1 week' };
            }
            if (request.durationWeeks > 52) {
                return { error: 'Duration cannot exceed 52 weeks' };
            }
        }

        // Build update object
        const update: { name?: string; durationWeeks?: number; updatedAt: Date } = {
            updatedAt: new Date(),
        };

        if (request.name !== undefined) {
            update.name = request.name.trim();
        }

        if (request.durationWeeks !== undefined) {
            update.durationWeeks = request.durationWeeks;
        }

        // Update the plan
        const updatedPlan = await trainingPlans.updatePlan(
            request.planId,
            context.userId,
            update
        );

        if (!updatedPlan) {
            return { error: 'Plan not found' };
        }

        // Convert to client format (handles both ObjectId and UUID string IDs)
        const planClient = {
            _id: toStringId(updatedPlan._id),
            userId: toStringId(updatedPlan.userId),
            name: updatedPlan.name,
            durationWeeks: updatedPlan.durationWeeks,
            isActive: updatedPlan.isActive,
            createdAt: updatedPlan.createdAt.toISOString(),
            updatedAt: updatedPlan.updatedAt.toISOString(),
            creationSource: updatedPlan.creationSource,
        };

        return { plan: planClient };
    } catch (error: unknown) {
        console.error('Update plan error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update plan' };
    }
};

