import type { TrainingAppClient } from '@training-app/sdk';

/**
 * JSON Schema (draft-07 subset) for a tool's input. MCP clients use this
 * to both validate caller input and present the tool shape to the LLM.
 */
export type InputSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: InputSchema;
  handler: (client: TrainingAppClient, args: Record<string, unknown>) => Promise<unknown>;
}

// ----- small schema builders to keep tool defs readable --------------------

const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) });
const num = (description?: string) => ({ type: 'number', ...(description ? { description } : {}) });
const int = (description?: string) => ({
  type: 'integer',
  ...(description ? { description } : {}),
});
const bool = (description?: string) => ({
  type: 'boolean',
  ...(description ? { description } : {}),
});
const arr = (items: unknown, description?: string) => ({
  type: 'array',
  items,
  ...(description ? { description } : {}),
});

// ----- typed arg helpers ---------------------------------------------------
// Note: every tool's inputSchema is augmented with an optional top-level
// `userId` in server.ts. Handlers here never see `userId` — the dispatcher
// strips it and passes a `client` already scoped to the requested user via
// `client.asUser(...)`. Do not add `userId` to individual schemas below.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pick = <T>(args: Record<string, unknown>, key: string): T => args[key] as T;

// ===========================================================================
// TOOL DEFINITIONS
// ===========================================================================

export const TOOLS: ToolDef[] = [
  // ------ plans ------------------------------------------------------------
  {
    name: 'list_plans',
    description: 'List every training plan for the calling user.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: (c) => c.plans.list(),
  },
  {
    name: 'get_plan',
    description: 'Fetch a single training plan by id.',
    inputSchema: {
      type: 'object',
      properties: { planId: str('MongoDB _id of the plan') },
      required: ['planId'],
    },
    handler: (c, a) => c.plans.get(pick<string>(a, 'planId')),
  },
  {
    name: 'create_plan',
    description: 'Create a new training plan. durationWeeks must be a positive integer.',
    inputSchema: {
      type: 'object',
      properties: {
        name: str('Plan name'),
        durationWeeks: int('Length of the plan in weeks (> 0)'),
        _id: str('Optional client-generated UUID'),
      },
      required: ['name', 'durationWeeks'],
    },
    handler: (c, a) => c.plans.create(a as never),
  },
  {
    name: 'update_plan',
    description: 'Update fields on an existing plan. Only pass what you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: str(),
        name: str(),
        durationWeeks: int(),
      },
      required: ['planId'],
    },
    handler: (c, a) => c.plans.update(a as never),
  },
  {
    name: 'delete_plan',
    description: 'Permanently delete a plan and all its exercises, workouts, and progress.',
    inputSchema: { type: 'object', properties: { planId: str() }, required: ['planId'] },
    handler: (c, a) => c.plans.delete(pick<string>(a, 'planId')),
  },
  {
    name: 'set_active_plan',
    description: "Mark a plan as the user's active plan.",
    inputSchema: { type: 'object', properties: { planId: str() }, required: ['planId'] },
    handler: (c, a) => c.plans.setActive(pick<string>(a, 'planId')),
  },
  {
    name: 'duplicate_plan',
    description: 'Duplicate a plan, including its exercises and workouts.',
    inputSchema: { type: 'object', properties: { planId: str() }, required: ['planId'] },
    handler: (c, a) => c.plans.duplicate(pick<string>(a, 'planId')),
  },

  // ------ exercise definitions --------------------------------------------
  {
    name: 'list_exercise_definitions',
    description: "List exercise definitions in the library. Includes user's custom exercises by default.",
    inputSchema: {
      type: 'object',
      properties: { includeCustom: bool('Default: true') },
      required: [],
    },
    handler: (c, a) => c.exerciseDefinitions.list(a as never),
  },
  {
    name: 'get_exercise_definition',
    description: 'Fetch a single exercise definition by id.',
    inputSchema: { type: 'object', properties: { exerciseId: str() }, required: ['exerciseId'] },
    handler: (c, a) => c.exerciseDefinitions.get(pick<string>(a, 'exerciseId')),
  },
  {
    name: 'create_exercise_definition',
    description: 'Create a custom exercise for the calling user.',
    inputSchema: {
      type: 'object',
      properties: {
        name: str(),
        primaryMuscle: str('e.g. "Chest", "Back", "Quads"'),
        secondaryMuscles: arr(str()),
        type: str('Free-form, e.g. "compound" or "isolation"'),
        isBodyweight: bool(),
        isStatic: bool('True for timed/static holds like plank'),
        imageBase64: str('Optional base64 image data'),
      },
      required: ['name', 'primaryMuscle'],
    },
    handler: (c, a) => c.exerciseDefinitions.create(a as never),
  },
  {
    name: 'update_exercise_definition',
    description: 'Update a custom exercise. Built-in library entries cannot be updated.',
    inputSchema: {
      type: 'object',
      properties: {
        exerciseId: str(),
        name: str(),
        primaryMuscle: str(),
        secondaryMuscles: arr(str()),
        type: str(),
        isBodyweight: bool(),
        isStatic: bool(),
        imageBase64: str(),
      },
      required: ['exerciseId'],
    },
    handler: (c, a) => c.exerciseDefinitions.update(a as never),
  },
  {
    name: 'delete_exercise_definition',
    description: 'Delete a custom exercise. Built-ins cannot be deleted.',
    inputSchema: { type: 'object', properties: { exerciseId: str() }, required: ['exerciseId'] },
    handler: (c, a) => c.exerciseDefinitions.delete(pick<string>(a, 'exerciseId')),
  },
  {
    name: 'list_muscle_groups',
    description: 'List the canonical muscle-group names used across the library.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: (c) => c.exerciseDefinitions.muscleGroups(),
  },

  // ------ plan exercises ---------------------------------------------------
  {
    name: 'list_plan_exercises',
    description: 'List all exercises on a plan, with their resolved exercise definitions.',
    inputSchema: { type: 'object', properties: { planId: str() }, required: ['planId'] },
    handler: (c, a) => c.planExercises.list(pick<string>(a, 'planId')),
  },
  {
    name: 'add_plan_exercise',
    description: 'Add a single exercise (from the library) to a plan.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: str(),
        exerciseDefId: str('_id of an ExerciseDefinition'),
        sets: int('Target sets (> 0)'),
        reps: int('Target reps per set (>= 0)'),
        weight: num(),
        durationSeconds: int(),
        comments: str(),
        _id: str(),
      },
      required: ['planId', 'exerciseDefId', 'sets', 'reps'],
    },
    handler: (c, a) => c.planExercises.add(a as never),
  },
  {
    name: 'bulk_add_plan_exercises',
    description:
      'Add many exercises to a plan in one call. Partial success possible — inspect results[i].error per item.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: str(),
        exercises: arr({
          type: 'object',
          properties: {
            exerciseDefId: str(),
            sets: int(),
            reps: int(),
            weight: num(),
            durationSeconds: int(),
            comments: str(),
            _id: str(),
          },
          required: ['exerciseDefId', 'sets', 'reps'],
        }),
      },
      required: ['planId', 'exercises'],
    },
    handler: (c, a) => c.planExercises.bulkAdd(a as never),
  },
  {
    name: 'update_plan_exercise',
    description: 'Update sets/reps/weight/etc. on a plan exercise.',
    inputSchema: {
      type: 'object',
      properties: {
        planExerciseId: str(),
        sets: int(),
        reps: int(),
        weight: num(),
        durationSeconds: int(),
        comments: str(),
      },
      required: ['planExerciseId'],
    },
    handler: (c, a) => c.planExercises.update(a as never),
  },
  {
    name: 'delete_plan_exercise',
    description: 'Remove an exercise from a plan. Weekly progress and workout references are cleaned up server-side.',
    inputSchema: {
      type: 'object',
      properties: { planExerciseId: str() },
      required: ['planExerciseId'],
    },
    handler: (c, a) => c.planExercises.delete(pick<string>(a, 'planExerciseId')),
  },
  {
    name: 'reorder_plan_exercises',
    description: 'Reorder plan exercises. exerciseIds must list every plan exercise exactly once.',
    inputSchema: {
      type: 'object',
      properties: { planId: str(), exerciseIds: arr(str()) },
      required: ['planId', 'exerciseIds'],
    },
    handler: (c, a) => c.planExercises.reorder(a as never),
  },

  // ------ plan workouts ----------------------------------------------------
  {
    name: 'list_plan_workouts',
    description: 'List all workouts defined for a plan.',
    inputSchema: { type: 'object', properties: { planId: str() }, required: ['planId'] },
    handler: (c, a) => c.planWorkouts.list(pick<string>(a, 'planId')),
  },
  {
    name: 'create_plan_workout',
    description:
      'Create a named workout in a plan. items[].planExerciseId must reference exercises that exist on the plan.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: str(),
        name: str(),
        items: arr({
          type: 'object',
          properties: {
            planExerciseId: str(),
            order: int(),
            sets: int(),
          },
          required: ['planExerciseId', 'order'],
        }),
        _id: str(),
      },
      required: ['planId', 'name', 'items'],
    },
    handler: (c, a) => c.planWorkouts.create(a as never),
  },
  {
    name: 'update_plan_workout',
    description: 'Update a workout. Only pass the fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: str(),
        workoutId: str(),
        name: str(),
        items: arr({
          type: 'object',
          properties: {
            planExerciseId: str(),
            order: int(),
            sets: int(),
          },
          required: ['planExerciseId', 'order'],
        }),
      },
      required: ['planId', 'workoutId'],
    },
    handler: (c, a) => c.planWorkouts.update(a as never),
  },
  {
    name: 'delete_plan_workout',
    description: 'Delete a workout. The plan exercises it referenced are not deleted.',
    inputSchema: {
      type: 'object',
      properties: { planId: str(), workoutId: str() },
      required: ['planId', 'workoutId'],
    },
    handler: (c, a) =>
      c.planWorkouts.delete(pick<string>(a, 'planId'), pick<string>(a, 'workoutId')),
  },
  {
    name: 'reorder_plan_workouts',
    description: 'Reorder workouts within a plan.',
    inputSchema: {
      type: 'object',
      properties: { planId: str(), workoutIds: arr(str()) },
      required: ['planId', 'workoutIds'],
    },
    handler: (c, a) =>
      c.planWorkouts.reorder(pick<string>(a, 'planId'), pick<string[]>(a, 'workoutIds')),
  },

  // ------ weekly progress --------------------------------------------------
  {
    name: 'get_week_progress',
    description: 'Per-exercise set-completion state for a given week of a plan.',
    inputSchema: {
      type: 'object',
      properties: { planId: str(), weekNumber: int('1-based week index') },
      required: ['planId', 'weekNumber'],
    },
    handler: (c, a) => c.weeklyProgress.getWeek(a as never),
  },
  {
    name: 'update_sets',
    description:
      "Adjust logged sets for one plan exercise in one week. action ∈ {'add','remove','complete-all'}. targetSets required for complete-all.",
    inputSchema: {
      type: 'object',
      properties: {
        planId: str(),
        planExerciseId: str(),
        weekNumber: int(),
        action: { type: 'string', enum: ['add', 'remove', 'complete-all'] },
        targetSets: int('Required when action = "complete-all"'),
      },
      required: ['planId', 'planExerciseId', 'weekNumber', 'action'],
    },
    handler: (c, a) => c.weeklyProgress.updateSets(a as never),
  },
  {
    name: 'get_exercise_notes',
    description: 'Read the free-form note attached to a (plan exercise, week) pair.',
    inputSchema: {
      type: 'object',
      properties: { planId: str(), planExerciseId: str(), weekNumber: int() },
      required: ['planId', 'planExerciseId', 'weekNumber'],
    },
    handler: (c, a) =>
      c.weeklyProgress.getExerciseNotes(
        pick<string>(a, 'planId'),
        pick<string>(a, 'planExerciseId'),
        pick<number>(a, 'weekNumber'),
      ),
  },
  {
    name: 'update_exercise_note',
    description: 'Upsert the free-form note for a (plan exercise, week) pair. Empty string clears it.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: str(),
        planExerciseId: str(),
        weekNumber: int(),
        note: str('Empty string clears the note'),
      },
      required: ['planId', 'planExerciseId', 'weekNumber', 'note'],
    },
    handler: (c, a) => c.weeklyProgress.updateExerciseNote(a as never),
  },

  // ------ activity logs ---------------------------------------------------
  {
    name: 'get_activity',
    description: 'Fetch activity log entries, optionally narrowed by plan or date range (ISO-8601).',
    inputSchema: {
      type: 'object',
      properties: { planId: str(), from: str(), to: str() },
      required: [],
    },
    handler: (c, a) => c.activityLogs.get(a as never),
  },
  {
    name: 'get_activity_summary',
    description: 'Aggregated totals and per-exercise breakdown over the selected activity window.',
    inputSchema: {
      type: 'object',
      properties: { planId: str(), from: str(), to: str() },
      required: [],
    },
    handler: (c, a) => c.activityLogs.summary(a as never),
  },
  {
    name: 'get_exercise_history',
    description: 'History for a single plan exercise across all time.',
    inputSchema: {
      type: 'object',
      properties: { planExerciseId: str() },
      required: ['planExerciseId'],
    },
    handler: (c, a) => c.activityLogs.exerciseHistory(pick<string>(a, 'planExerciseId')),
  },
  {
    name: 'add_activity',
    description: 'Record a new activity log entry (completed set/rep event).',
    inputSchema: {
      type: 'object',
      properties: {
        planId: str(),
        planExerciseId: str(),
        weekNumber: int(),
        sets: int(),
        reps: int(),
        weight: num(),
        durationSeconds: int(),
        performedAt: str('ISO-8601 timestamp; defaults to now'),
        notes: str(),
      },
      required: ['planId', 'planExerciseId'],
    },
    handler: (c, a) => c.activityLogs.add(a as never),
  },
  {
    name: 'edit_activity',
    description: 'Edit an existing activity entry. Only pass the fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        activityId: str(),
        sets: int(),
        reps: int(),
        weight: num(),
        durationSeconds: int(),
        performedAt: str(),
        notes: str(),
      },
      required: ['activityId'],
    },
    handler: (c, a) => c.activityLogs.edit(a as never),
  },
  {
    name: 'delete_activity',
    description: 'Delete a single activity entry.',
    inputSchema: { type: 'object', properties: { activityId: str() }, required: ['activityId'] },
    handler: (c, a) => c.activityLogs.delete(pick<string>(a, 'activityId')),
  },
  {
    name: 'bulk_delete_activity',
    description: 'Delete many activity entries in one call.',
    inputSchema: {
      type: 'object',
      properties: { activityIds: arr(str()) },
      required: ['activityIds'],
    },
    handler: (c, a) => c.activityLogs.bulkDelete(pick<string[]>(a, 'activityIds')),
  },
  {
    name: 'duplicate_activity',
    description: 'Duplicate an existing activity entry.',
    inputSchema: { type: 'object', properties: { activityId: str() }, required: ['activityId'] },
    handler: (c, a) => c.activityLogs.duplicate(pick<string>(a, 'activityId')),
  },
  {
    name: 'get_recovery_score',
    description:
      'Calculate recovery score (0-100) based on recent training volume. Uses exponential decay weighting where recent days impact score more. Returns score, label, daily breakdown, and baseline. High volume = low recovery score.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: str('Optional: filter activity by plan'),
        lookbackDays: int('Days for weighted score calculation (default 10)'),
        baselineDays: int('Days for baseline calculation (default 30)'),
      },
      required: [],
    },
    handler: (c, a) => c.activityLogs.recoveryScore(a as never),
  },

  // ------ admin: users -----------------------------------------------------
  {
    name: 'list_users',
    description:
      "List every user in the system. Use this to resolve a username typed by the human into the MongoDB _id needed by other tools' `userId` argument.",
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: (c) => c.admin.users.list(),
  },

  // ------ escape hatch -----------------------------------------------------
  {
    name: 'call_api',
    description:
      "Escape hatch: call any /api/process/* endpoint by name (slash-delimited, e.g. 'auth/me' or 'plan-data/get'). Params forwarded as-is. Prefer typed tools above when available.",
    inputSchema: {
      type: 'object',
      properties: {
        apiName: str('e.g. "auth/me" or "plan-data/get"'),
        params: { type: 'object' },
      },
      required: ['apiName'],
    },
    handler: (c, a) => c.call(pick<string>(a, 'apiName'), a.params ?? {}),
  },
];
