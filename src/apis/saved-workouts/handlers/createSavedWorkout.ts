import { ObjectId } from 'mongodb';
import type { ApiHandlerContext } from '@/apis/types';
import type { CreateSavedWorkoutRequest, CreateSavedWorkoutResponse } from '../types';
import * as savedWorkouts from '@/server/database/collections/savedWorkouts';
import type { SavedWorkoutExercise } from '@/server/database/collections/savedWorkouts/types';

export async function createSavedWorkout(
    request: CreateSavedWorkoutRequest,
    context: ApiHandlerContext
): Promise<CreateSavedWorkoutResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!request.name || request.name.trim().length === 0) {
            return { error: 'Workout name is required' };
        }

        if (!request.exercises || request.exercises.length === 0) {
            return { error: 'At least one exercise is required' };
        }

        // Convert exercises to database format
        const exercises: SavedWorkoutExercise[] = request.exercises.map((e, index) => ({
            exerciseDefId: new ObjectId(e.exerciseDefId),
            sets: e.sets,
            reps: e.reps,
            weight: e.weight,
            durationSeconds: e.durationSeconds ?? 0,
            order: index,
        }));

        const workout = await savedWorkouts.createWorkout({
            userId: new ObjectId(context.userId),
            name: request.name.trim(),
            exercises,
        });

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
        console.error('Error creating saved workout:', error);
        return { error: 'Failed to create saved workout' };
    }
}


