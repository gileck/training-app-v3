import type { ApiHandlerContext } from '@/apis/types';
import type { DeleteExerciseRequest, DeleteExerciseResponse } from '../types';
import * as exerciseDefinitions from '@/server/database/collections/project/exerciseDefinitions';
import * as planExercises from '@/server/database/collections/project/planExercises';
import { fileStorageAPI } from '@/server/blob';
import { toStringId } from '@/server/utils';

export async function deleteExercise(
    request: DeleteExerciseRequest,
    context: ApiHandlerContext
): Promise<DeleteExerciseResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!request.exerciseId) {
            return { error: 'Exercise ID is required' };
        }

        // Check exercise exists and belongs to user
        const existingExercise = await exerciseDefinitions.findExerciseById(request.exerciseId);
        if (!existingExercise) {
            return { error: 'Exercise not found' };
        }

        if (existingExercise.isSystem) {
            return { error: 'Cannot delete system exercises' };
        }

        if ((existingExercise.userId ? toStringId(existingExercise.userId) : undefined) !== context.userId) {
            return { error: 'You can only delete your own exercises' };
        }

        // Check if exercise is used in any plan
        const usedInPlans = await planExercises.findPlanExercisesByExerciseDefId(request.exerciseId);
        if (usedInPlans.length > 0) {
            return { error: 'Cannot delete exercise that is used in training plans. Remove it from all plans first.' };
        }

        // Delete associated image
        if (existingExercise.imageUrl) {
            await fileStorageAPI.delete(existingExercise.imageUrl).catch(() => {});
        }

        // Delete the exercise
        const deleted = await exerciseDefinitions.deleteExercise(request.exerciseId, context.userId);

        if (!deleted) {
            return { error: 'Failed to delete exercise' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error deleting exercise:', error);
        return { error: 'Failed to delete exercise' };
    }
}


