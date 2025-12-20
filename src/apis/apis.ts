import { mergeApiHandlers } from "./registry";
import { chatApiHandlers } from "./chat/server";
import { clearCacheApiHandlers } from "./settings/clearCache/server";
import { authApiHandlers } from "./auth/server";
import { todosApiHandlers } from "./todos/server";
import { reportsApiHandlers } from "./reports/server";
import { trainingPlansApiHandlers } from "./training-plans/server";
import { exerciseDefinitionsApiHandlers } from "./exercise-definitions/server";
import { planExercisesApiHandlers } from "./plan-exercises/server";
import { weeklyProgressApiHandlers } from "./weekly-progress/server";
import { activityLogsApiHandlers } from "./activity-logs/server";
import { savedWorkoutsApiHandlers } from "./saved-workouts/server";

export const apiHandlers = mergeApiHandlers(
  chatApiHandlers,
  clearCacheApiHandlers,
  authApiHandlers,
  todosApiHandlers,
  reportsApiHandlers,
  trainingPlansApiHandlers,
  exerciseDefinitionsApiHandlers,
  planExercisesApiHandlers,
  weeklyProgressApiHandlers,
  activityLogsApiHandlers,
  savedWorkoutsApiHandlers
);


