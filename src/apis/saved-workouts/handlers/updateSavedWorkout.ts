import { ObjectId } from 'mongodb';
import type { ApiHandlerContext } from '@/apis/types';
import type { UpdateSavedWorkoutRequest, UpdateSavedWorkoutResponse } from '../types';
import * as savedWorkouts from '@/server/database/collections/savedWorkouts';
import type { SavedWorkoutExercise, SavedWorkoutUpdate } from '@/server/database/collections/savedWorkouts/types';

export async function updateSavedWorkout(
    request: UpdateSavedWorkoutRequest,
    context: ApiHandlerContext
): Promise<UpdateSavedWorkoutResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!request.workoutId) {
            return { error: 'Workout ID is required' };
        }

        // Check workout exists
        const existing = await savedWorkouts.findWorkoutById(request.workoutId, context.userId);
        if (!existing) {
            return { error: 'Workout not found' };
        }

        // Build update object
        const update: SavedWorkoutUpdate = {
            updatedAt: new Date(),
        };

        if (request.name !== undefined) {
            update.name = request.name.trim();
        }

        if (request.exercises !== undefined) {
            if (request.exercises.length === 0) {
                return { error: 'At least one exercise is required' };
            }
            
            const exercises: SavedWorkoutExercise[] = request.exercises.map((e, index) => ({
                exerciseDefId: new ObjectId(e.exerciseDefId),
                sets: e.sets,
                reps: e.reps,
                weight: e.weight,
                durationSeconds: e.durationSeconds ?? 0,
                order: index,
            }));
            update.exercises = exercises;
        }

        const workout = await savedWorkouts.updateWorkout(request.workoutId, context.userId, update);
        if (!workout) {
            return { error: 'Failed to update workout' };
        }

        return {
            workout: {
                _id: workout._id.toHexString(),
                userId: workout.userId.toHexString(),
                name: workout.name,
                exercises: workout.exercises.map((e) => ({
                    exerciseDefId: e.exerciseDefId.toHexString(),
                    sets: e.sets,
                    reps: e.reps,
                    weight: e.weight,
                    durationSeconds: e.durationSeconds,
                    order: e.order,
                })),
                createdAt: workout.createdAt.toISOString(),
                updatedAt: workout.updatedAt.toISOString(),
            },
        };
    } catch (error) {
        console.error('Error updating saved workout:', error);
        return { error: 'Failed to update saved workout' };
    }
}


