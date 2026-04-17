/**
 * Public types for the training app SDK.
 *
 * These mirror the server's `apis/<domain>/types.ts` shapes. The server is the
 * source of truth — if you spot drift (new field on the server, not here), add
 * it here and ship. Unknown extra fields in server responses are silently
 * ignored at the type level, but `call<T>()` lets you assert a richer shape
 * per-call if you need it.
 */

// ===========================================================================
// Common
// ===========================================================================

/** Response shape for mutations that only report success/failure. */
export interface SuccessResponse {
  success?: boolean;
  error?: string;
}

// ===========================================================================
// Training plans
// ===========================================================================

/** A training plan — a user's top-level container of exercises and workouts. */
export interface TrainingPlan {
  _id: string;
  name: string;
  durationWeeks: number;
  /** True for the user's currently-active plan. Only one plan per user is active. */
  active?: boolean;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

export interface ListPlansResponse {
  plans?: TrainingPlan[];
  error?: string;
}

export interface PlanResponse {
  plan?: TrainingPlan;
  error?: string;
}

export interface CreatePlanInput {
  name: string;
  /** Positive integer — length of the plan in weeks. */
  durationWeeks: number;
  /** Optional client-generated UUID for optimistic-update flows. */
  _id?: string;
}

export interface UpdatePlanInput {
  planId: string;
  name?: string;
  durationWeeks?: number;
}

// ===========================================================================
// Exercise definitions (the library of all exercises — built-in and custom)
// ===========================================================================

export interface ExerciseDefinition {
  _id: string;
  name: string;
  /** Primary muscle group, e.g. `"Chest"`. */
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  /** Free-form type/category, e.g. `"compound"`, `"isolation"`. */
  type?: string;
  /** True for exercises measured without added weight (push-ups, pull-ups). */
  isBodyweight?: boolean;
  /** True for timed/static holds (plank, wall-sit). */
  isStatic?: boolean;
  imageUrl?: string;
  /** True for user-created exercises; false for built-in library entries. */
  isCustom?: boolean;
}

export interface ListExerciseDefinitionsInput {
  /** Include the user's custom exercises in the result. Default: `true`. */
  includeCustom?: boolean;
}

export interface ListExerciseDefinitionsResponse {
  exercises?: ExerciseDefinition[];
  error?: string;
}

export interface ExerciseDefinitionResponse {
  exercise?: ExerciseDefinition;
  error?: string;
}

export interface CreateExerciseDefinitionInput {
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  type?: string;
  isBodyweight?: boolean;
  isStatic?: boolean;
  /** Optional base64-encoded image data (with or without data-URL prefix). */
  imageBase64?: string;
}

export interface UpdateExerciseDefinitionInput {
  exerciseId: string;
  name?: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  type?: string;
  isBodyweight?: boolean;
  isStatic?: boolean;
  imageBase64?: string;
}

export interface MuscleGroupsResponse {
  muscleGroups?: string[];
  error?: string;
}

// ===========================================================================
// Plan exercises (exercises assigned to a specific plan)
// ===========================================================================

export interface PlanExercise {
  _id: string;
  planId: string;
  exerciseDefId: string;
  sets: number;
  reps: number;
  weight?: number;
  durationSeconds?: number;
  comments?: string;
  order?: number;
}

/**
 * A plan exercise plus its resolved exercise definition. `exerciseDef` is the
 * *merged* effective definition (base definition merged with per-plan overrides);
 * `overrides` is the raw sparse override object for display-time checks like
 * rendering a "customized" badge.
 */
export interface PlanExerciseWithDefinition extends PlanExercise {
  exerciseDef: ExerciseDefinition;
  overrides?: Partial<ExerciseDefinition>;
}

export interface ListPlanExercisesResponse {
  exercises?: PlanExerciseWithDefinition[];
  error?: string;
}

export interface PlanExerciseResponse {
  exercise?: PlanExerciseWithDefinition;
  error?: string;
}

export interface AddPlanExerciseInput {
  planId: string;
  exerciseDefId: string;
  /** Target number of sets. Positive integer. */
  sets: number;
  /** Target reps per set. Non-negative integer (0 for timed/static exercises). */
  reps: number;
  weight?: number;
  durationSeconds?: number;
  comments?: string;
  _id?: string;
}

export interface UpdatePlanExerciseInput {
  planExerciseId: string;
  sets?: number;
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  comments?: string;
}

export interface BulkAddPlanExerciseItem {
  exerciseDefId: string;
  sets: number;
  reps: number;
  weight?: number;
  durationSeconds?: number;
  comments?: string;
  _id?: string;
}

export interface BulkAddPlanExercisesInput {
  planId: string;
  exercises: BulkAddPlanExerciseItem[];
}

export interface BulkAddResultItem {
  exerciseDefId: string;
  exercise?: PlanExerciseWithDefinition;
  error?: string;
}

export interface BulkAddPlanExercisesResponse {
  results?: BulkAddResultItem[];
  addedCount?: number;
  failedCount?: number;
  error?: string;
}

export interface ReorderPlanExercisesInput {
  planId: string;
  /** Plan-exercise ids in the desired order. Must cover all exercises of the plan. */
  exerciseIds: string[];
}

// ===========================================================================
// Plan workouts (named groupings of plan exercises, e.g. "Push Day")
// ===========================================================================

export interface PlanWorkoutItem {
  planExerciseId: string;
  /** 0-based position within the workout. */
  order: number;
  /** Optional per-workout override of the plan exercise's set count. */
  sets?: number;
}

export interface PlanWorkout {
  _id: string;
  planId: string;
  name: string;
  items: PlanWorkoutItem[];
  order?: number;
}

export interface ListPlanWorkoutsResponse {
  workouts?: PlanWorkout[];
  error?: string;
}

export interface PlanWorkoutResponse {
  workout?: PlanWorkout;
  error?: string;
}

export interface CreatePlanWorkoutInput {
  planId: string;
  name: string;
  items: PlanWorkoutItem[];
  _id?: string;
}

export interface UpdatePlanWorkoutInput {
  planId: string;
  workoutId: string;
  name?: string;
  items?: PlanWorkoutItem[];
}

// ===========================================================================
// Weekly progress (set completion tracking per week)
// ===========================================================================

export interface WeekProgressExercise {
  planExerciseId: string;
  targetSets: number;
  setsCompleted: number;
  isDone: boolean;
  exerciseDef: ExerciseDefinition;
  planExercise: PlanExercise;
}

export interface GetWeekProgressInput {
  planId: string;
  /** 1-based week index within the plan. */
  weekNumber: number;
}

export interface GetWeekProgressResponse {
  weekNumber?: number;
  totalSets?: number;
  completedSets?: number;
  progressPercent?: number;
  exercises?: WeekProgressExercise[];
  error?: string;
}

/** Valid actions for {@link UpdateSetsInput.action}. */
export const UPDATE_SETS_ACTIONS = ['add', 'remove', 'complete-all'] as const;
export type UpdateSetsAction = typeof UPDATE_SETS_ACTIONS[number];

export interface UpdateSetsInput {
  planId: string;
  planExerciseId: string;
  weekNumber: number;
  action: UpdateSetsAction;
  /** Required when `action === 'complete-all'`; ignored otherwise. */
  targetSets?: number;
}

export interface UpdateSetsResponse {
  setsCompleted?: number;
  isDone?: boolean;
  error?: string;
}

export interface ExerciseNote {
  planExerciseId: string;
  weekNumber: number;
  note: string;
  updatedAt?: string;
}

export interface GetExerciseNoteResponse {
  note?: ExerciseNote | null;
  error?: string;
}

export interface UpdateExerciseNoteInput {
  planId: string;
  planExerciseId: string;
  weekNumber: number;
  note: string;
}

// ===========================================================================
// Activity logs
// ===========================================================================

/**
 * Activity log entry — a single recorded set/rep event. Field set is broader
 * than plan exercises since it captures historical context. Kept open (no
 * indexer) but untyped on the response side: use narrow types in your code if
 * you need them.
 */
export interface ActivityLog {
  _id: string;
  userId: string;
  planId?: string;
  planExerciseId?: string;
  exerciseDefId?: string;
  weekNumber?: number;
  sets?: number;
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  performedAt?: string;
  notes?: string;
}

export interface GetActivityInput {
  planId?: string;
  /** ISO-8601 start date (inclusive). */
  from?: string;
  /** ISO-8601 end date (exclusive). */
  to?: string;
}

export interface GetActivityResponse {
  activities?: ActivityLog[];
  error?: string;
}

export interface ActivitySummaryResponse {
  summary?: {
    totalSets?: number;
    totalReps?: number;
    totalVolume?: number;
    byExercise?: Array<{ exerciseDefId: string; sets: number; reps: number }>;
  };
  error?: string;
}

export interface ExerciseHistoryResponse {
  history?: ActivityLog[];
  error?: string;
}

export interface AddActivityInput {
  planId: string;
  planExerciseId: string;
  weekNumber?: number;
  sets?: number;
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  performedAt?: string;
  notes?: string;
}

export interface ActivityResponse {
  activity?: ActivityLog;
  error?: string;
}

export interface EditActivityInput {
  activityId: string;
  sets?: number;
  reps?: number;
  weight?: number;
  durationSeconds?: number;
  performedAt?: string;
  notes?: string;
}
