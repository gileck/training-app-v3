/**
 * Create Plan From Text Handler
 * 
 * Commits a previewed draft plan to the database.
 * Creates the plan, exercises (custom if needed), plan exercises, and plan workouts.
 * 
 * This handler does NOT call AI - it uses the draft from the preview step.
 */

import type { ApiHandlerContext, CreatePlanFromTextRequest, CreatePlanFromTextResponse, DraftPlan, DraftExercise } from '../types';
import { trainingPlans, planExercises, exerciseDefinitions, planWorkouts } from '@/server/database';
import { toStringId, toDocumentId } from '@/server/utils';
import { matchExercise } from './exerciseMatcher';

// Validation limits
const MAX_EXERCISES = 200;
const MAX_WORKOUTS = 50;
const MAX_PLAN_NAME_LENGTH = 100;
const MIN_WEEKS = 1;
const MAX_WEEKS = 52;

/**
 * Build plan exercise data from draft exercise
 */
function buildPlanExerciseData(
    exercise: DraftExercise,
    planId: string,
    exerciseDefId: string,
    order: number,
    now: Date
) {
    return {
        planId: toDocumentId(planId), // Handle both ObjectId and UUID formats
        exerciseDefId: toDocumentId(exerciseDefId), // Handle both ObjectId and UUID formats
        sets: exercise.sets ?? 3,
        reps: exercise.reps ?? 0,
        weight: exercise.weightKg ?? 0,
        durationSeconds: exercise.durationSeconds ?? 0,
        comments: exercise.notes ?? '',
        order,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Validate the draft payload integrity
 * @param autoResolveUnmatched - When true, 'unresolved' exercises are allowed (will be auto-created as custom)
 */
function validateDraft(draft: DraftPlan, autoResolveUnmatched: boolean = false): string | null {
    // Validate plan name
    if (!draft.planName || draft.planName.trim() === '') {
        return 'Plan name is required';
    }
    if (draft.planName.length > MAX_PLAN_NAME_LENGTH) {
        return `Plan name is too long (max ${MAX_PLAN_NAME_LENGTH} characters)`;
    }
    
    // Validate duration
    if (!draft.durationWeeks || draft.durationWeeks < MIN_WEEKS) {
        return `Duration must be at least ${MIN_WEEKS} week`;
    }
    if (draft.durationWeeks > MAX_WEEKS) {
        return `Duration cannot exceed ${MAX_WEEKS} weeks`;
    }
    
    // Validate exercises array
    if (!draft.exercises || !Array.isArray(draft.exercises)) {
        return 'Draft exercises is required';
    }
    if (draft.exercises.length === 0) {
        return 'At least one exercise is required';
    }
    if (draft.exercises.length > MAX_EXERCISES) {
        return `Too many exercises (max ${MAX_EXERCISES})`;
    }
    
    // Build a set of valid draft exercise keys
    const validKeys = new Set<string>();
    for (const exercise of draft.exercises) {
        if (!exercise.draftExerciseKey) {
            return 'Each exercise must have a draftExerciseKey';
        }
        if (!exercise.name || exercise.name.trim() === '') {
            return 'Each exercise must have a name';
        }
        if (validKeys.has(exercise.draftExerciseKey)) {
            return `Duplicate draftExerciseKey: ${exercise.draftExerciseKey}`;
        }
        validKeys.add(exercise.draftExerciseKey);
        
        // Validate sets/reps/duration
        const sets = exercise.sets ?? 3;
        if (sets < 1 || sets > 20) {
            return `Invalid sets for ${exercise.name}: must be 1-20`;
        }
        if (exercise.reps !== undefined && (exercise.reps < 0 || exercise.reps > 100)) {
            return `Invalid reps for ${exercise.name}: must be 0-100`;
        }
        if (exercise.durationSeconds !== undefined && (exercise.durationSeconds < 0 || exercise.durationSeconds > 3600)) {
            return `Invalid duration for ${exercise.name}: must be 0-3600 seconds`;
        }
        
        // Validate matchStatus - all exercises must be resolved before commit (unless autoResolveUnmatched is true)
        if (!exercise.matchStatus) {
            return `Exercise "${exercise.name}" is missing matchStatus`;
        }
        // matched exercises require matchedExerciseDefId
        if (exercise.matchStatus === 'matched' && !exercise.matchedExerciseDefId) {
            return `Matched exercise "${exercise.name}" is missing matchedExerciseDefId`;
        }
        // Check for unresolved exercises (reject unless autoResolveUnmatched is true)
        if (exercise.matchStatus === 'unresolved' && !autoResolveUnmatched) {
            return `Exercise "${exercise.name}" is not resolved. Please match it to a library exercise or mark as custom.`;
        }
    }
    
    // Validate workouts array
    if (!draft.workouts || !Array.isArray(draft.workouts)) {
        return 'Draft workouts is required';
    }
    if (draft.workouts.length > MAX_WORKOUTS) {
        return `Too many workouts (max ${MAX_WORKOUTS})`;
    }
    
    // Validate workout items reference valid exercise keys
    for (const workout of draft.workouts) {
        if (!workout.name || workout.name.trim() === '') {
            return 'Each workout must have a name';
        }
        if (!workout.items || !Array.isArray(workout.items)) {
            return `Workout "${workout.name}" must have items array`;
        }
        for (const item of workout.items) {
            if (!item.draftExerciseKey) {
                return `Workout "${workout.name}" has item without draftExerciseKey`;
            }
            if (!validKeys.has(item.draftExerciseKey)) {
                return `Workout "${workout.name}" references unknown exercise key: ${item.draftExerciseKey}`;
            }
        }
    }
    
    return null;
}

/**
 * Create a custom exercise definition
 */
async function createCustomExercise(
    exercise: DraftExercise,
    userId: string
): Promise<string> {
    const now = new Date();
    
    // Infer isStatic from durationSeconds
    const isStatic = Boolean(exercise.durationSeconds && !exercise.reps);
    
    const exerciseData = {
        name: exercise.name.trim(),
        imageUrl: '',
        primaryMuscle: 'Other', // Default, can be updated by user later
        secondaryMuscles: [] as string[],
        type: isStatic ? 'Static' : 'Strength',
        isBodyweight: false,
        isStatic,
        isSystem: false,
        userId: toDocumentId(userId),
        createdAt: now,
        updatedAt: now,
    };
    
    const created = await exerciseDefinitions.createExercise(exerciseData);
    return toStringId(created._id);
}

/**
 * Try to match an exercise by ID first, then by name
 * Used for auto-resolving unmatched exercises during import/share
 * 
 * @param exercise - The draft exercise to match
 * @param exerciseLibrary - Pre-fetched exercise library (for performance)
 */
function tryMatchExercise(
    exercise: DraftExercise,
    exerciseLibrary: Awaited<ReturnType<typeof exerciseDefinitions.findAllExercises>>
): string | null {
    // 1. Try to match by exerciseDefId if provided (fast path for system exercises)
    if (exercise.matchedExerciseDefId) {
        const foundById = exerciseLibrary.find(
            def => toStringId(def._id) === exercise.matchedExerciseDefId
        );
        if (foundById) {
            return toStringId(foundById._id);
        }
    }
    
    // 2. Try to match by name using the existing matching logic
    const matchResult = matchExercise(exercise.name, exerciseLibrary);
    if (matchResult.status === 'matched' && matchResult.exerciseDefId) {
        return matchResult.exerciseDefId;
    }
    
    // 3. No match found
    return null;
}

/**
 * Main handler for creating a plan from a draft
 */
export async function createPlanFromText(
    request: CreatePlanFromTextRequest,
    context: ApiHandlerContext
): Promise<CreatePlanFromTextResponse> {
    try {
        // Auth check
        if (!context.userId) {
            return { 
                error: 'Not authenticated',
                errorCode: 'UNAUTHORIZED',
            };
        }
        
        // Validate request
        if (!request.draft) {
            return {
                error: 'Draft is required',
                errorCode: 'VALIDATION',
            };
        }
        
        // Validate draft integrity
        const autoResolve = request.autoResolveUnmatched ?? false;
        const validationError = validateDraft(request.draft, autoResolve);
        if (validationError) {
            return {
                error: validationError,
                errorCode: 'DRAFT_MISMATCH',
            };
        }
        
        const { draft } = request;
        const now = new Date();
        
        // Step 1: Create the training plan
        const existingPlans = await trainingPlans.findPlansByUserId(context.userId);
        const isFirstPlan = existingPlans.length === 0;
        
        const planData = {
            userId: toDocumentId(context.userId),
            name: draft.planName.trim(),
            durationWeeks: draft.durationWeeks,
            isActive: isFirstPlan, // First plan is automatically active
            createdAt: now,
            updatedAt: now,
        };
        
        const newPlan = await trainingPlans.createPlan(planData);
        const planId = toStringId(newPlan._id);
        
        try {
            // Step 2: Ensure all exercise definitions exist
            // Map: draftExerciseKey -> exerciseDefId
            const exerciseDefMap = new Map<string, string>();
            let createdExerciseCount = 0;
            
            // Pre-fetch exercise library once for auto-resolve matching (if needed)
            const hasUnresolved = autoResolve && draft.exercises.some(e => e.matchStatus === 'unresolved');
            const exerciseLibrary = hasUnresolved 
                ? await exerciseDefinitions.findAllExercises(context.userId)
                : [];
            
            for (const exercise of draft.exercises) {
                if (exercise.matchStatus === 'matched' && exercise.matchedExerciseDefId) {
                    // Use existing exercise from library
                    exerciseDefMap.set(exercise.draftExerciseKey, exercise.matchedExerciseDefId);
                } else if (exercise.matchStatus === 'custom') {
                    // Explicitly marked as custom - create new custom exercise
                    const newExerciseId = await createCustomExercise(exercise, context.userId);
                    exerciseDefMap.set(exercise.draftExerciseKey, newExerciseId);
                    createdExerciseCount++;
                } else if (exercise.matchStatus === 'unresolved' && autoResolve) {
                    // Auto-resolve: try ID match, then name match, then create as custom
                    const matchedId = tryMatchExercise(exercise, exerciseLibrary);
                    if (matchedId) {
                        // Found a match - use existing exercise
                        exerciseDefMap.set(exercise.draftExerciseKey, matchedId);
                    } else {
                        // No match found - create as custom exercise
                        const newExerciseId = await createCustomExercise(exercise, context.userId);
                        exerciseDefMap.set(exercise.draftExerciseKey, newExerciseId);
                        createdExerciseCount++;
                    }
                }
                // Note: 'unresolved' exercises without autoResolve are rejected in validateDraft
            }
            
            // Step 3: Create plan exercises (ordered by first appearance in workouts)
            // Map: draftExerciseKey -> planExerciseId
            const planExerciseMap = new Map<string, string>();
            const seenKeys = new Set<string>();
            let orderCounter = 0;
            
            // First, add exercises in workout order
            for (const workout of draft.workouts) {
                for (const item of workout.items) {
                    if (!seenKeys.has(item.draftExerciseKey)) {
                        seenKeys.add(item.draftExerciseKey);
                        
                        const exercise = draft.exercises.find(e => e.draftExerciseKey === item.draftExerciseKey);
                        if (exercise) {
                            const exerciseDefId = exerciseDefMap.get(exercise.draftExerciseKey);
                            if (exerciseDefId) {
                                const planExerciseData = buildPlanExerciseData(
                                    exercise, planId, exerciseDefId, orderCounter++, now
                                );
                                const created = await planExercises.createPlanExercise(planExerciseData);
                                planExerciseMap.set(exercise.draftExerciseKey, toStringId(created._id));
                            }
                        }
                    }
                }
            }
            
            // Then, add any remaining exercises not in workouts
            for (const exercise of draft.exercises) {
                if (!seenKeys.has(exercise.draftExerciseKey)) {
                    seenKeys.add(exercise.draftExerciseKey);
                    
                    const exerciseDefId = exerciseDefMap.get(exercise.draftExerciseKey);
                    if (exerciseDefId) {
                        const planExerciseData = buildPlanExerciseData(
                            exercise, planId, exerciseDefId, orderCounter++, now
                        );
                        const created = await planExercises.createPlanExercise(planExerciseData);
                        planExerciseMap.set(exercise.draftExerciseKey, toStringId(created._id));
                    }
                }
            }
            
            // Step 4: Create plan workouts
            let createdPlanWorkoutsCount = 0;
            
            for (const workout of draft.workouts) {
                const items = workout.items.map((item, index) => ({
                    planExerciseId: toDocumentId(planExerciseMap.get(item.draftExerciseKey)!),
                    order: index,
                }));
                
                const workoutData = {
                    userId: toDocumentId(context.userId),
                    planId: toDocumentId(planId), // Handle both ObjectId and UUID formats
                    name: workout.name.trim(),
                    items,
                };
                
                await planWorkouts.createPlanWorkout(workoutData);
                createdPlanWorkoutsCount++;
            }
            
            // Return success response (handles both ObjectId and UUID)
            const planClient = {
                _id: toStringId(newPlan._id),
                userId: toStringId(newPlan.userId),
                name: newPlan.name,
                durationWeeks: newPlan.durationWeeks,
                isActive: newPlan.isActive,
                createdAt: newPlan.createdAt.toISOString(),
                updatedAt: newPlan.updatedAt.toISOString(),
            };
            
            return {
                plan: planClient,
                createdExerciseCount,
                createdPlanWorkoutsCount,
            };
            
        } catch (innerError) {
            // If something fails after plan creation, try to clean up
            // Note: This is best-effort cleanup, not a true transaction
            console.error('Error during plan creation, attempting cleanup:', innerError);
            
            try {
                // Delete any created plan exercises
                await planExercises.deleteExercisesByPlanId(planId);
                // Delete any created plan workouts
                await planWorkouts.deletePlanWorkoutsByPlanId(planId);
                // Delete the plan itself
                await trainingPlans.deletePlan(planId, context.userId);
            } catch (cleanupError) {
                console.error('Cleanup failed:', cleanupError);
            }
            
            throw innerError;
        }
        
    } catch (error) {
        console.error('Create plan from text error:', error);
        return {
            error: 'Failed to create plan. Please try again.',
            errorCode: 'SERVER_ERROR',
        };
    }
}
