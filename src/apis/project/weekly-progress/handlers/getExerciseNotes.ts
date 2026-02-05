import { GetExerciseNotesRequest, GetExerciseNotesResponse, ApiHandlerContext, ExerciseNoteClient } from '../types';
import { weeklyNotes, trainingPlans } from '@/server/database';

/**
 * Get notes for a specific exercise, including current week note and previous weeks' notes
 */
export const getExerciseNotes = async (
    request: GetExerciseNotesRequest,
    context: ApiHandlerContext
): Promise<GetExerciseNotesResponse> => {
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

        // Get all notes for this exercise
        const allNotes = await weeklyNotes.findNotesByExercise(
            context.userId,
            request.planId,
            request.exerciseDefId
        );

        // Separate current week note from previous notes
        const currentNote = allNotes.find(n => n.weekNumber === request.weekNumber);
        const previousNotes: ExerciseNoteClient[] = allNotes
            .filter(n => n.weekNumber !== request.weekNumber)
            .map(n => ({
                weekNumber: n.weekNumber,
                content: n.content,
                updatedAt: n.updatedAt.toISOString(),
            }));

        return {
            currentNote: currentNote?.content || '',
            previousNotes,
        };
    } catch (error) {
        console.error('Error getting exercise notes:', error);
        return { error: 'Failed to get exercise notes' };
    }
};

