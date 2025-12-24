import { UpdateWeeklyNoteRequest, UpdateWeeklyNoteResponse, ApiHandlerContext } from '../types';
import { weeklyNotes, trainingPlans } from '@/server/database';

export const updateWeeklyNote = async (
    request: UpdateWeeklyNoteRequest,
    context: ApiHandlerContext
): Promise<UpdateWeeklyNoteResponse> => {
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

        // Check if content is empty - if so, delete the note
        if (!request.content || request.content.trim() === '') {
            await weeklyNotes.deleteNote(context.userId, request.planId, request.weekNumber);
            return { note: '' };
        }

        // Upsert the note
        const note = await weeklyNotes.upsertNote(
            context.userId,
            request.planId,
            request.weekNumber,
            request.content.trim()
        );

        return { note: note.content };
    } catch (error) {
        console.error('Error updating weekly note:', error);
        return { error: 'Failed to update weekly note' };
    }
};

