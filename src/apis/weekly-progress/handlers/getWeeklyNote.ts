import { GetWeeklyNoteRequest, GetWeeklyNoteResponse, ApiHandlerContext } from '../types';
import { weeklyNotes, trainingPlans } from '@/server/database';

export const getWeeklyNote = async (
    request: GetWeeklyNoteRequest,
    context: ApiHandlerContext
): Promise<GetWeeklyNoteResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.weekNumber || request.weekNumber < 1) {
            return { error: 'Week number must be at least 1' };
        }

        // Verify plan belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // Get the note
        const note = await weeklyNotes.findNote(context.userId, request.planId, request.weekNumber);

        return { note: note?.content || '' };
    } catch (error) {
        console.error('Error getting weekly note:', error);
        return { error: 'Failed to get weekly note' };
    }
};

