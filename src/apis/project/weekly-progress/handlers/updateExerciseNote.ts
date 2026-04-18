import { UpdateExerciseNoteRequest, UpdateExerciseNoteResponse, ApiHandlerContext } from '../types';
import { weeklyNotes, trainingPlans } from '@/server/database';

/**
 * Create or update a note for a specific exercise in a specific week
 */
export const updateExerciseNote = async (
    request: UpdateExerciseNoteRequest,
    context: ApiHandlerContext
): Promise<UpdateExerciseNoteResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        if (!request.exerciseDefId) {
            return { error: 'Exercise definition ID is required' };
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
            await weeklyNotes.deleteNote(
                context.userId,
                request.planId,
                request.exerciseDefId,
                request.weekNumber
            );
            await trainingPlans.touchPlan(request.planId);
            return { note: '' };
        }

        // Upsert the note
        const note = await weeklyNotes.upsertNote(
            context.userId,
            request.planId,
            request.exerciseDefId,
            request.weekNumber,
            request.content.trim()
        );

        await trainingPlans.touchPlan(request.planId);
        return { note: note.content };
    } catch (error) {
        console.error('Error updating exercise note:', error);
        return { error: 'Failed to update exercise note' };
    }
};

