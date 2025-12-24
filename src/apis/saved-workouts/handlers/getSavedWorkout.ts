import type { ApiHandlerContext } from '@/apis/types';
import type { GetSavedWorkoutRequest, GetSavedWorkoutResponse, SavedWorkoutWithExercises, SavedWorkoutExerciseWithDef } from '../types';
import * as savedWorkouts from '@/server/database/collections/savedWorkouts';
import * as exerciseDefinitions from '@/server/database/collections/exerciseDefinitions';

export async function getSavedWorkout(
    request: GetSavedWorkoutRequest,
    context: ApiHandlerContext
): Promise<GetSavedWorkoutResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        if (!request.workoutId) {
            return { error: 'Workout ID is required' };
        }

        const workout = await savedWorkouts.findWorkoutById(request.workoutId, context.userId);
        if (!workout) {
            return { error: 'Workout not found' };
        }

        // Fetch exercise definitions
        const exerciseIds = workout.exercises.map((e) => e.exerciseDefId.toHexString());
        const exerciseDefs = await exerciseDefinitions.findExercisesByIds(exerciseIds);
        const exerciseDefsMap = new Map(exerciseDefs.map((e) => [e._id.toHexString(), e]));

        const workoutWithExercises: SavedWorkoutWithExercises = {
            _id: workout._id.toHexString(),
            userId: workout.userId.toHexString(),
            name: workout.name,
            exercises: workout.exercises.map((e): SavedWorkoutExerciseWithDef => {
                const exerciseDef = exerciseDefsMap.get(e.exerciseDefId.toHexString());
                return {
                    exerciseDefId: e.exerciseDefId.toHexString(),
                    sets: e.sets,
                    reps: e.reps,
                    weight: e.weight,
                    durationSeconds: e.durationSeconds,
                    order: e.order,
                    exerciseDef: exerciseDef
                        ? {
                              _id: exerciseDef._id.toHexString(),
                              name: exerciseDef.name,
                              imageUrl: exerciseDef.imageUrl,
                              primaryMuscle: exerciseDef.primaryMuscle,
                              secondaryMuscles: exerciseDef.secondaryMuscles,
                              type: exerciseDef.type,
                              isBodyweight: exerciseDef.isBodyweight,
                              isStatic: exerciseDef.isStatic,
                              isSystem: exerciseDef.isSystem,
                              userId: exerciseDef.userId?.toHexString(),
                              createdAt: exerciseDef.createdAt.toISOString(),
                              updatedAt: exerciseDef.updatedAt.toISOString(),
                          }
                        : {
                              _id: e.exerciseDefId.toHexString(),
                              name: 'Unknown Exercise',
                              imageUrl: '',
                              primaryMuscle: '',
                              secondaryMuscles: [],
                              type: '',
                              isBodyweight: false,
                              isStatic: false,
                              isSystem: false,
                              createdAt: '',
                              updatedAt: '',
                          },
                };
            }),
            order: workout.order ?? 0,
            createdAt: workout.createdAt.toISOString(),
            updatedAt: workout.updatedAt.toISOString(),
        };

        return { workout: workoutWithExercises };
    } catch (error) {
        console.error('Error getting saved workout:', error);
        return { error: 'Failed to get saved workout' };
    }
}


