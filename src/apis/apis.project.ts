/**
 * Project-specific API Handlers
 *
 * Add your project-specific API handlers here.
 * Template handlers are in apis.template.ts (synced from template).
 */

import { mergeApiHandlers } from "./registry";
import { activityLogsApiHandlers } from "./project/activity-logs/server";
import { exerciseDefinitionsApiHandlers } from "./project/exercise-definitions/server";
import { planDataApiHandlers } from "./project/plan-data/server";
import { planExercisesApiHandlers } from "./project/plan-exercises/server";
import { planWorkoutsApiHandlers } from "./project/plan-workouts/server";
import { trainingPlansApiHandlers } from "./project/training-plans/server";
import { weeklyProgressApiHandlers } from "./project/weekly-progress/server";
import { workoutWarmupApiHandlers } from "./project/workout-warmup/server";

export const projectApiHandlers = mergeApiHandlers(
  activityLogsApiHandlers,
  exerciseDefinitionsApiHandlers,
  planDataApiHandlers,
  planExercisesApiHandlers,
  planWorkoutsApiHandlers,
  trainingPlansApiHandlers,
  weeklyProgressApiHandlers,
  workoutWarmupApiHandlers
);
