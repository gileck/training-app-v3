import type { ApiHandlerContext } from '@/apis/types';
import type { ListSavedWorkoutsRequest, ListSavedWorkoutsResponse, SavedWorkoutWithExercises, SavedWorkoutExerciseWithDef } from '../types';
import * as savedWorkouts from '@/server/database/collections/savedWorkouts';
import * as exerciseDefinitions from '@/server/database/collections/exerciseDefinitions';

export async function listSavedWorkouts(
    _request: ListSavedWorkoutsRequest,
    context: ApiHandlerContext
): Promise<ListSavedWorkoutsResponse> {
    try {
        if (!context.userId) {
            return { error: 'Unauthorized' };
        }

        const workouts = await savedWorkouts.findWorkoutsByUserId(context.userId);

        // Get all unique exercise IDs
        const allExerciseIds = new Set<string>();
        workouts.forEach((w) => {
            w.exercises.forEach((e) => {
                allExerciseIds.add(e.exerciseDefId.toHexString());
            });
        });

        // Fetch all exercise definitions
        const exerciseDefs = await exerciseDefinitions.findExercisesByIds(Array.from(allExerciseIds));
        const exerciseDefsMap = new Map(exerciseDefs.map((e) => [e._id.toHexString(), e]));

        // Map workouts with exercise definitions
        const workoutsWithExercises: SavedWorkoutWithExercises[] = workouts.map((workout) => ({
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
        }));

        return { workouts: workoutsWithExercises };
    } catch (error) {
        console.error('Error listing saved workouts:', error);
        return { error: 'Failed to list saved workouts' };
    }
}


