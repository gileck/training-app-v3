/**
 * API Handlers
 *
 * This file merges template API handlers with project-specific handlers.
 * Template handlers are in apis.template.ts (synced from template).
 *
 * Add your project-specific API handlers below.
 */

import { mergeApiHandlers } from "./registry";
import { templateApiHandlers } from "./apis.template";
import { chatApiHandlers } from "./chat/server";
import { trainingPlansApiHandlers } from "./training-plans/server";
import { exerciseDefinitionsApiHandlers } from "./exercise-definitions/server";
import { planExercisesApiHandlers } from "./plan-exercises/server";
import { weeklyProgressApiHandlers } from "./weekly-progress/server";
import { activityLogsApiHandlers } from "./activity-logs/server";
import { planWorkoutsApiHandlers } from "./plan-workouts/server";
import { planDataApiHandlers } from "./plan-data/server";
import { workoutWarmupApiHandlers } from "./workout-warmup/server";

export const apiHandlers = mergeApiHandlers(
  templateApiHandlers,  // Template APIs (auth, reports, feature-requests, clearCache)
  chatApiHandlers,
  trainingPlansApiHandlers,
  exerciseDefinitionsApiHandlers,
  planExercisesApiHandlers,
  weeklyProgressApiHandlers,
  activityLogsApiHandlers,
  planWorkoutsApiHandlers,
  planDataApiHandlers,
  workoutWarmupApiHandlers
  // Add more project-specific API handlers here:
  // myApiHandlers,
);
