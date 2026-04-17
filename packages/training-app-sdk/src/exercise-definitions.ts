import { callApi, ClientOptions } from './http';
import { assertNonEmptyString, assertObject } from './validation';
import {
  CreateExerciseDefinitionInput,
  ExerciseDefinitionResponse,
  ListExerciseDefinitionsInput,
  ListExerciseDefinitionsResponse,
  MuscleGroupsResponse,
  SuccessResponse,
  UpdateExerciseDefinitionInput,
} from './types';

/**
 * The catalog of exercise definitions — both built-in library entries and the
 * user's custom exercises. Custom-exercise CRUD only affects the calling user;
 * built-ins are read-only.
 */
export function exerciseDefinitionsDomain(opts: ClientOptions) {
  return {
    /** List exercise definitions. Includes user custom exercises unless `includeCustom: false`. */
    list: (input: ListExerciseDefinitionsInput = {}): Promise<ListExerciseDefinitionsResponse> => {
      assertObject(input, 'input');
      return callApi(opts, 'exercise-definitions/list', input);
    },

    /** Fetch a single exercise definition by id. */
    get: (exerciseId: string): Promise<ExerciseDefinitionResponse> => {
      assertNonEmptyString(exerciseId, 'exerciseId');
      return callApi(opts, 'exercise-definitions/get', { exerciseId });
    },

    /** Create a custom exercise for the calling user. */
    create: (input: CreateExerciseDefinitionInput): Promise<ExerciseDefinitionResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.name, 'input.name');
      assertNonEmptyString(input.primaryMuscle, 'input.primaryMuscle');
      return callApi(opts, 'exercise-definitions/create', input);
    },

    /** Update a custom exercise. Built-in exercises cannot be updated. */
    update: (input: UpdateExerciseDefinitionInput): Promise<ExerciseDefinitionResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.exerciseId, 'input.exerciseId');
      return callApi(opts, 'exercise-definitions/update', input);
    },

    /** Delete a custom exercise. Built-in exercises cannot be deleted. */
    delete: (exerciseId: string): Promise<SuccessResponse> => {
      assertNonEmptyString(exerciseId, 'exerciseId');
      return callApi(opts, 'exercise-definitions/delete', { exerciseId });
    },

    /** List the canonical muscle-group names used across the library. */
    muscleGroups: (): Promise<MuscleGroupsResponse> =>
      callApi(opts, 'exercise-definitions/muscle-groups'),
  };
}
