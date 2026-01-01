/**
 * Generate Plan From Text Handler
 * 
 * Takes user's free-form text and generates a structured training plan preview.
 * Uses AI to parse the text into workouts and exercises.
 * Returns a draft plan that can be committed via createPlanFromText.
 */

import type { ApiHandlerContext, GeneratePlanFromTextRequest, GeneratePlanFromTextResponse, DraftPlan, DraftExercise } from '../types';
import { AIModelAdapter } from '@/server/ai/baseModelAdapter';
import { isModelExists } from '@/server/ai/models';
import { exerciseDefinitions } from '@/server/database';
import { 
    buildTrainingPlanPrompt, 
    type AIPlanOutput, 
    type AIWorkout 
} from './buildTrainingPlanPrompt';
import { matchExercise } from './exerciseMatcher';

// Input validation limits
const MAX_TEXT_LENGTH = 10000;
const MIN_TEXT_LENGTH = 3;
const MAX_PLAN_NAME_LENGTH = 100;
const MIN_WEEKS = 1;
const MAX_WEEKS = 52;

/**
 * Validate the request inputs
 */
function validateRequest(request: GeneratePlanFromTextRequest): string | null {
    if (!request.modelId || request.modelId.trim() === '') {
        return 'Model ID is required';
    }
    
    if (!isModelExists(request.modelId)) {
        return `Invalid model ID: ${request.modelId}`;
    }
    
    if (!request.planName || request.planName.trim() === '') {
        return 'Plan name is required';
    }
    
    if (request.planName.length > MAX_PLAN_NAME_LENGTH) {
        return `Plan name is too long (max ${MAX_PLAN_NAME_LENGTH} characters)`;
    }
    
    if (!request.durationWeeks || request.durationWeeks < MIN_WEEKS) {
        return `Duration must be at least ${MIN_WEEKS} week`;
    }
    
    if (request.durationWeeks > MAX_WEEKS) {
        return `Duration cannot exceed ${MAX_WEEKS} weeks`;
    }
    
    if (!request.text || request.text.trim() === '') {
        return 'Text is required';
    }
    
    if (request.text.trim().length < MIN_TEXT_LENGTH) {
        return 'Text is too short. Please provide more details about your training plan.';
    }
    
    if (request.text.length > MAX_TEXT_LENGTH) {
        return `Text is too long (max ${MAX_TEXT_LENGTH} characters). Try describing fewer weeks or exercises.`;
    }
    
    return null;
}

/**
 * Validate AI output structure
 */
function validateAIOutput(output: unknown): output is AIPlanOutput {
    if (!output || typeof output !== 'object') return false;
    
    const obj = output as Record<string, unknown>;
    if (!Array.isArray(obj.workouts)) return false;
    
    // Allow empty workouts array (AI couldn't parse input)
    if (obj.workouts.length === 0) return true;
    
    for (const workout of obj.workouts) {
        if (!workout || typeof workout !== 'object') return false;
        const w = workout as Record<string, unknown>;
        
        if (typeof w.name !== 'string' || !w.name.trim()) return false;
        if (!Array.isArray(w.exercises)) return false;
        
        for (const exercise of w.exercises) {
            if (!exercise || typeof exercise !== 'object') return false;
            const e = exercise as Record<string, unknown>;
            
            if (typeof e.name !== 'string' || !e.name.trim()) return false;
            // Must have either reps or durationSeconds
            if (typeof e.reps !== 'number' && typeof e.durationSeconds !== 'number') {
                // Allow string numbers and convert
                if (typeof e.reps !== 'string' && typeof e.durationSeconds !== 'string') {
                    return false;
                }
            }
        }
    }
    
    return true;
}

/**
 * Convert AI output to draft plan with exercise matching
 * 
 * Matching strategy:
 * 1. Exact/normalized match -> status: 'matched'
 * 2. No exact match -> status: 'unresolved' with suggestions
 * 
 * User must resolve unresolved exercises before committing.
 */
async function convertToDraftPlan(
    aiOutput: AIPlanOutput,
    planName: string,
    durationWeeks: number,
    userId: string
): Promise<DraftPlan> {
    // Get all exercises available to the user
    const exerciseLibrary = await exerciseDefinitions.findAllExercises(userId);
    
    // Collect all unique exercise names from AI output
    const exerciseNames = new Set<string>();
    for (const workout of aiOutput.workouts) {
        for (const exercise of workout.exercises) {
            exerciseNames.add(exercise.name);
        }
    }
    
    // Create draft exercises with matching
    const draftExercises: DraftExercise[] = [];
    const exerciseKeyMap = new Map<string, string>(); // name -> draftExerciseKey
    
    let keyCounter = 0;
    for (const name of exerciseNames) {
        const draftKey = `ex_${keyCounter++}`;
        exerciseKeyMap.set(name, draftKey);
        
        // Match against library (only exact/normalized matches are auto-accepted)
        const matchResult = matchExercise(name, exerciseLibrary);
        
        // Find the first occurrence to get sets/reps/etc
        let firstOccurrence = null;
        for (const workout of aiOutput.workouts) {
            const found = workout.exercises.find(e => e.name === name);
            if (found) {
                firstOccurrence = found;
                break;
            }
        }
        
        const draftExercise: DraftExercise = {
            draftExerciseKey: draftKey,
            name,
            sets: typeof firstOccurrence?.sets === 'number' ? firstOccurrence.sets : 
                  typeof firstOccurrence?.sets === 'string' ? parseInt(firstOccurrence.sets, 10) || 3 : 3,
            reps: typeof firstOccurrence?.reps === 'number' ? firstOccurrence.reps :
                  typeof firstOccurrence?.reps === 'string' ? parseInt(firstOccurrence.reps, 10) : undefined,
            durationSeconds: typeof firstOccurrence?.durationSeconds === 'number' ? firstOccurrence.durationSeconds :
                            typeof firstOccurrence?.durationSeconds === 'string' ? parseInt(firstOccurrence.durationSeconds, 10) : undefined,
            weightKg: typeof firstOccurrence?.weightKg === 'number' ? firstOccurrence.weightKg :
                      typeof firstOccurrence?.weightKg === 'string' ? parseFloat(firstOccurrence.weightKg) : undefined,
            notes: firstOccurrence?.notes,
            // Set match status and data
            matchStatus: matchResult.status,
            matchedExerciseDefId: matchResult.exerciseDefId,
            matchedExerciseName: matchResult.exerciseName,
            suggestedMatches: matchResult.suggestedMatches,
        };
        
        draftExercises.push(draftExercise);
    }
    
    // Create draft workouts
    const draftWorkouts = aiOutput.workouts.map((workout: AIWorkout) => ({
        name: workout.name,
        items: workout.exercises.map((exercise, index) => ({
            draftExerciseKey: exerciseKeyMap.get(exercise.name)!,
            order: index,
        })),
    }));
    
    return {
        planName,
        durationWeeks,
        exercises: draftExercises,
        workouts: draftWorkouts,
    };
}

/**
 * Main handler for generating a training plan from text
 */
export async function generatePlanFromText(
    request: GeneratePlanFromTextRequest,
    context: ApiHandlerContext
): Promise<GeneratePlanFromTextResponse> {
    try {
        // Auth check
        if (!context.userId) {
            return { 
                error: 'Not authenticated',
                errorCode: 'UNAUTHORIZED',
            };
        }
        
        // Validate inputs
        const validationError = validateRequest(request);
        if (validationError) {
            return { 
                error: validationError,
                errorCode: 'VALIDATION',
            };
        }
        
        // Build prompt
        const prompt = buildTrainingPlanPrompt({
            text: request.text.trim(),
            planName: request.planName.trim(),
            durationWeeks: request.durationWeeks,
        });
        
        // Call AI model
        const adapter = new AIModelAdapter(request.modelId);
        
        let aiResponse;
        try {
            aiResponse = await adapter.processPromptToJSON<AIPlanOutput>(
                prompt,
                'training-plans/generate-from-text'
            );
        } catch (aiError) {
            console.error('AI model error:', aiError);
            return {
                error: 'AI returned an invalid plan format. Try again or switch to a different model.',
                errorCode: 'AI_INVALID_OUTPUT',
            };
        }
        
        // Validate AI output
        if (!validateAIOutput(aiResponse.result)) {
            return {
                error: 'AI returned an invalid plan format. Try again or switch to a different model.',
                errorCode: 'AI_INVALID_OUTPUT',
            };
        }
        
        // Check if AI couldn't generate a plan (empty workouts)
        if (aiResponse.result.workouts.length === 0) {
            return {
                error: "Couldn't generate a plan from that text. Try adding specific exercises with sets/reps (e.g., 'Squats 3×8, Bench Press 3×10') or describe what kind of workouts you want.",
                errorCode: 'AI_UNCLEAR_INPUT',
            };
        }
        
        // Convert to draft plan with exercise matching
        const draftPlan = await convertToDraftPlan(
            aiResponse.result,
            request.planName.trim(),
            request.durationWeeks,
            context.userId
        );
        
        // Count matched vs unresolved exercises
        const matchedCount = draftPlan.exercises.filter(e => e.matchStatus === 'matched').length;
        const unresolvedCount = draftPlan.exercises.filter(e => e.matchStatus === 'unresolved').length;
        
        return {
            preview: draftPlan,
            matchedCount,
            unresolvedCount,
            cost: aiResponse.cost,
            isFromCache: false, // Server-side caching is currently disabled
        };
        
    } catch (error) {
        console.error('Generate plan from text error:', error);
        return {
            error: 'An unexpected error occurred. Please try again.',
            errorCode: 'SERVER_ERROR',
        };
    }
}
