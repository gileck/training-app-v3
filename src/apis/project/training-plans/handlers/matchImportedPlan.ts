/**
 * Match Imported Plan Handler
 * 
 * Takes imported plan JSON and matches exercises against the user's exercise library.
 * Uses ID-first matching for fast re-import, with fallback to name matching.
 * 
 * Returns a DraftPlan that can be previewed and committed via createPlanFromText.
 */

import type { 
    ApiHandlerContext, 
    MatchImportedPlanRequest, 
    MatchImportedPlanResponse,
    DraftPlan,
    DraftExercise,
    PlanExportData,
    ExportExercise,
    ExerciseMatchStatus,
} from '../types';
import { exerciseDefinitions } from '@/server/database';
import { matchExercise } from './exerciseMatcher';
import { toStringId } from '@/server/utils';

// Validation limits
const MAX_PLAN_NAME_LENGTH = 100;
const MIN_WEEKS = 1;
const MAX_WEEKS = 52;
const MAX_EXERCISES = 200;
const MAX_WORKOUTS = 50;
const MAX_SETS = 20;
const MAX_REPS = 100;
const MAX_DURATION_SECONDS = 3600;

/**
 * Validate import data structure
 */
function validateImportData(data: PlanExportData): string | null {
    // Check version
    if (!data.version || data.version !== '1.0') {
        return 'This plan was exported from an unsupported version.';
    }

    // Validate plan name
    if (!data.planName || data.planName.trim() === '') {
        return 'Plan name is required.';
    }
    if (data.planName.length > MAX_PLAN_NAME_LENGTH) {
        return `Plan name is too long (maximum ${MAX_PLAN_NAME_LENGTH} characters).`;
    }

    // Validate duration
    if (!data.durationWeeks || data.durationWeeks < MIN_WEEKS) {
        return `Duration must be at least ${MIN_WEEKS} week.`;
    }
    if (data.durationWeeks > MAX_WEEKS) {
        return `Duration must be between 1 and ${MAX_WEEKS} weeks.`;
    }

    // Validate workouts array
    if (!data.workouts || !Array.isArray(data.workouts)) {
        return 'Invalid plan format. Missing required field: `workouts`';
    }
    if (data.workouts.length === 0) {
        return 'This plan has no workouts. Add at least one workout with exercises.';
    }
    if (data.workouts.length > MAX_WORKOUTS) {
        return `Too many workouts (maximum ${MAX_WORKOUTS}).`;
    }

    // Count total exercises and validate each workout
    let totalExercises = 0;
    for (const workout of data.workouts) {
        if (!workout.name || workout.name.trim() === '') {
            return 'Each workout must have a name.';
        }
        if (!workout.exercises || !Array.isArray(workout.exercises)) {
            return `Workout "${workout.name}" must have an exercises array.`;
        }
        if (workout.exercises.length === 0) {
            return `Workout "${workout.name}" has no exercises. Each workout needs at least one exercise.`;
        }

        for (const exercise of workout.exercises) {
            if (!exercise.name || exercise.name.trim() === '') {
                return `Each exercise in "${workout.name}" must have a name.`;
            }
            
            // Validate sets/reps/duration if present
            if (exercise.sets !== undefined && (exercise.sets < 1 || exercise.sets > MAX_SETS)) {
                return `Invalid sets for "${exercise.name}": must be between 1 and ${MAX_SETS}.`;
            }
            if (exercise.reps !== undefined && (exercise.reps < 0 || exercise.reps > MAX_REPS)) {
                return `Invalid reps for "${exercise.name}": must be between 0 and ${MAX_REPS}.`;
            }
            if (exercise.durationSeconds !== undefined && (exercise.durationSeconds < 0 || exercise.durationSeconds > MAX_DURATION_SECONDS)) {
                return `Invalid duration for "${exercise.name}": must be between 0 and ${MAX_DURATION_SECONDS} seconds.`;
            }

            totalExercises++;
        }
    }

    if (totalExercises > MAX_EXERCISES) {
        return `Too many exercises (maximum ${MAX_EXERCISES}). Try splitting into multiple plans.`;
    }

    return null;
}

/**
 * Match exercise by ID first, then by name
 */
async function matchExerciseEnhanced(
    exercise: ExportExercise,
    exerciseLibrary: Awaited<ReturnType<typeof exerciseDefinitions.findAllExercises>>
): Promise<{
    status: ExerciseMatchStatus;
    exerciseDefId?: string;
    exerciseName?: string;
    suggestedMatches?: DraftExercise['suggestedMatches'];
}> {
    // Try ID match first (for re-importing own exports)
    if (exercise.exerciseDefId) {
        const foundByIdIndex = exerciseLibrary.findIndex(
            def => toStringId(def._id) === exercise.exerciseDefId
        );
        if (foundByIdIndex >= 0) {
            const def = exerciseLibrary[foundByIdIndex];
            return {
                status: 'matched',
                exerciseDefId: toStringId(def._id),
                exerciseName: def.name,
            };
        }
    }

    // Fall back to name matching (prefers system exercises over custom)
    const matchResult = matchExercise(exercise.name, exerciseLibrary);
    return {
        status: matchResult.status,
        exerciseDefId: matchResult.exerciseDefId,
        exerciseName: matchResult.exerciseName,
        suggestedMatches: matchResult.suggestedMatches,
    };
}

/**
 * Convert import data to draft plan with exercise matching
 */
async function convertImportToDraftPlan(
    importData: PlanExportData,
    userId: string
): Promise<DraftPlan> {
    // Get all exercises available to the user
    const exerciseLibrary = await exerciseDefinitions.findAllExercises(userId);

    // Collect all unique exercise entries (by name + exerciseDefId combination)
    const exerciseMap = new Map<string, ExportExercise>();
    for (const workout of importData.workouts) {
        for (const exercise of workout.exercises) {
            // Use name as key (deduplication)
            if (!exerciseMap.has(exercise.name)) {
                exerciseMap.set(exercise.name, exercise);
            }
        }
    }

    // Create draft exercises with matching
    const draftExercises: DraftExercise[] = [];
    const exerciseKeyMap = new Map<string, string>(); // name -> draftExerciseKey

    let keyCounter = 0;
    for (const [name, exercise] of exerciseMap) {
        const draftKey = `ex_${keyCounter++}`;
        exerciseKeyMap.set(name, draftKey);

        // Match exercise (ID-first, then name)
        const matchResult = await matchExerciseEnhanced(exercise, exerciseLibrary);

        const draftExercise: DraftExercise = {
            draftExerciseKey: draftKey,
            name,
            sets: exercise.sets,
            reps: exercise.reps,
            durationSeconds: exercise.durationSeconds,
            weightKg: exercise.weightKg,
            notes: exercise.notes,
            // Set match status and data
            matchStatus: matchResult.status,
            matchedExerciseDefId: matchResult.exerciseDefId,
            matchedExerciseName: matchResult.exerciseName,
            suggestedMatches: matchResult.suggestedMatches,
        };

        draftExercises.push(draftExercise);
    }

    // Create draft workouts
    const draftWorkouts = importData.workouts.map(workout => ({
        name: workout.name,
        items: workout.exercises.map((exercise, index) => ({
            draftExerciseKey: exerciseKeyMap.get(exercise.name)!,
            order: index,
        })),
    }));

    return {
        planName: importData.planName,
        durationWeeks: importData.durationWeeks,
        exercises: draftExercises,
        workouts: draftWorkouts,
    };
}

/**
 * Main handler for matching imported plan
 */
export async function matchImportedPlan(
    request: MatchImportedPlanRequest,
    context: ApiHandlerContext
): Promise<MatchImportedPlanResponse> {
    try {
        // Auth check
        if (!context.userId) {
            return {
                error: 'Please log in to import a plan.',
                errorCode: 'UNAUTHORIZED',
            };
        }

        // Validate import data exists
        if (!request.importData) {
            return {
                error: 'Import data is required.',
                errorCode: 'VALIDATION',
            };
        }

        // Validate import data structure
        const validationError = validateImportData(request.importData);
        if (validationError) {
            return {
                error: validationError,
                errorCode: 'VALIDATION',
            };
        }

        // Convert to draft plan with exercise matching
        const draftPlan = await convertImportToDraftPlan(
            request.importData,
            context.userId
        );

        // Count matched vs unresolved exercises
        const matchedCount = draftPlan.exercises.filter(e => e.matchStatus === 'matched').length;
        const unresolvedCount = draftPlan.exercises.filter(e => e.matchStatus === 'unresolved').length;

        return {
            preview: draftPlan,
            matchedCount,
            unresolvedCount,
        };

    } catch (error) {
        console.error('Match imported plan error:', error);
        return {
            error: 'Failed to process plan. Please try again.',
            errorCode: 'SERVER_ERROR',
        };
    }
}
