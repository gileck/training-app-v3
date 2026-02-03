/**
 * Training Plans Utilities
 * 
 * Shared utility functions for training plan operations.
 */

import type { 
    PlanExportData,
    DraftPlan,
    DraftExercise,
    DraftWorkout,
} from '@/apis/training-plans/types';

// ============================================================================
// JSON Validation Types & Constants
// ============================================================================

/** Supported export format version */
export const SUPPORTED_VERSION = '1.0';

/** Validation limits (matching server) */
export const VALIDATION_LIMITS = {
    MAX_PLAN_NAME_LENGTH: 100,
    MIN_DURATION_WEEKS: 1,
    MAX_DURATION_WEEKS: 52,
    MAX_WORKOUTS: 50,
    MAX_EXERCISES: 200,
} as const;

/** Result of JSON validation */
export interface PlanExportValidationResult {
    valid: boolean;
    error?: string;
    data?: PlanExportData;
}

// ============================================================================
// JSON Normalization & Validation
// ============================================================================

/**
 * Normalize JSON input by stripping common code fences
 * 
 * ChatGPT often wraps JSON in ```json ... ``` blocks, so we strip those.
 * Also handles triple backticks without language specifier.
 */
export function normalizeJsonInput(raw: string): string {
    let normalized = raw.trim();
    
    // Strip ```json ... ``` or ``` ... ``` code fences
    // Match opening fence (with optional language specifier) and closing fence
    const codeFenceRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i;
    const match = normalized.match(codeFenceRegex);
    if (match) {
        normalized = match[1].trim();
    }
    
    return normalized;
}

/**
 * Validate PlanExportData JSON structure client-side
 * 
 * Used by both Import and ChatGPT flows to validate pasted JSON.
 * Automatically normalizes input (strips code fences).
 * 
 * @param rawInput - Raw JSON string (may include code fences)
 * @returns Validation result with parsed data if valid
 */
export function validatePlanExportJson(rawInput: string): PlanExportValidationResult {
    // Normalize input (strip code fences)
    const jsonString = normalizeJsonInput(rawInput);
    
    if (!jsonString) {
        return { valid: false, error: 'Please paste the JSON plan data.' };
    }
    
    // Try to parse JSON
    let data: unknown;
    try {
        data = JSON.parse(jsonString);
    } catch (e) {
        const parseError = e instanceof SyntaxError ? e.message : 'Invalid JSON';
        return { valid: false, error: `Invalid JSON format. ${parseError}` };
    }

    // Check it's an object
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { valid: false, error: 'Invalid plan format. Expected a JSON object.' };
    }

    const obj = data as Record<string, unknown>;

    // Check version
    if (!obj.version) {
        return { valid: false, error: 'Invalid plan format. Missing required field: `version`' };
    }
    if (obj.version !== SUPPORTED_VERSION) {
        return { valid: false, error: `This plan was exported from an unsupported version. Expected version "${SUPPORTED_VERSION}".` };
    }

    // Check planName
    if (!obj.planName || typeof obj.planName !== 'string' || obj.planName.trim() === '') {
        return { valid: false, error: 'Invalid plan format. Missing required field: `planName`' };
    }
    if (obj.planName.length > VALIDATION_LIMITS.MAX_PLAN_NAME_LENGTH) {
        return { valid: false, error: `Plan name is too long (maximum ${VALIDATION_LIMITS.MAX_PLAN_NAME_LENGTH} characters).` };
    }

    // Check durationWeeks
    if (!obj.durationWeeks || typeof obj.durationWeeks !== 'number') {
        return { valid: false, error: 'Invalid plan format. Missing required field: `durationWeeks`' };
    }
    if (obj.durationWeeks < VALIDATION_LIMITS.MIN_DURATION_WEEKS || obj.durationWeeks > VALIDATION_LIMITS.MAX_DURATION_WEEKS) {
        return { valid: false, error: `Duration must be between ${VALIDATION_LIMITS.MIN_DURATION_WEEKS} and ${VALIDATION_LIMITS.MAX_DURATION_WEEKS} weeks.` };
    }

    // Check workouts
    if (!obj.workouts || !Array.isArray(obj.workouts)) {
        return { valid: false, error: 'Invalid plan format. Missing required field: `workouts`' };
    }
    if (obj.workouts.length === 0) {
        return { valid: false, error: 'This plan has no workouts. Add at least one workout with exercises.' };
    }
    if (obj.workouts.length > VALIDATION_LIMITS.MAX_WORKOUTS) {
        return { valid: false, error: `Too many workouts (maximum ${VALIDATION_LIMITS.MAX_WORKOUTS}).` };
    }

    // Validate each workout
    let totalExercises = 0;
    for (const workout of obj.workouts) {
        if (!workout || typeof workout !== 'object') {
            return { valid: false, error: 'Invalid workout format in plan.' };
        }
        const w = workout as Record<string, unknown>;

        if (!w.name || typeof w.name !== 'string' || w.name.trim() === '') {
            return { valid: false, error: 'Each workout must have a name.' };
        }

        if (!w.exercises || !Array.isArray(w.exercises)) {
            return { valid: false, error: `Workout "${w.name}" must have an exercises array.` };
        }

        if (w.exercises.length === 0) {
            return { valid: false, error: `Workout "${w.name}" has no exercises. Each workout needs at least one exercise.` };
        }

        // Validate each exercise
        for (const exercise of w.exercises) {
            if (!exercise || typeof exercise !== 'object') {
                return { valid: false, error: `Invalid exercise in workout "${w.name}".` };
            }
            const e = exercise as Record<string, unknown>;

            if (!e.name || typeof e.name !== 'string' || e.name.trim() === '') {
                return { valid: false, error: `Each exercise in "${w.name}" must have a name.` };
            }

            totalExercises++;
        }
    }

    if (totalExercises > VALIDATION_LIMITS.MAX_EXERCISES) {
        return { valid: false, error: `Too many exercises (maximum ${VALIDATION_LIMITS.MAX_EXERCISES}). Try splitting into multiple plans.` };
    }

    return { valid: true, data: data as PlanExportData };
}

// ============================================================================
// ChatGPT Integration
// ============================================================================

/**
 * Build the ChatGPT prompt for plan generation
 * 
 * The prompt instructs ChatGPT to:
 * 1. Act as a fitness coach and ask clarifying questions
 * 2. Generate a plan in PlanExportData v1.0 format
 * 3. Provide copy instructions for the user
 */
export function buildChatGptPlanPrompt(): string {
    return `You are a personal fitness coach helping me create a training plan.

INSTRUCTIONS:
1. Ask me about my fitness goals, experience level, available equipment, and how many days per week I can train.
2. Based on my answers, create a detailed training plan.
3. When the plan is ready and I confirm it, output it as JSON in EXACTLY this format:

{
  "version": "1.0",
  "planName": "Plan Name Here (max 100 chars)",
  "durationWeeks": 8,
  "workouts": [
    {
      "name": "Workout Name (e.g., Push Day)",
      "exercises": [
        { "name": "Exercise Name", "sets": 3, "reps": 10 },
        { "name": "Another Exercise", "sets": 4, "reps": 8, "weightKg": 20 }
      ]
    }
  ]
}

CONSTRAINTS:
- version must be exactly "1.0"
- planName: max 100 characters
- durationWeeks: 1-52
- workouts: 1-50 workouts, each with at least 1 exercise
- Total exercises across all workouts: max 200
- Each exercise needs: name (required), sets, reps (or durationSeconds for timed exercises)
- Optional fields: weightKg, notes

FINAL OUTPUT:
When I confirm the plan, output ONLY the JSON in a code block. Then tell me:
"Copy this JSON and paste it back into the Training App to preview and create your plan."

Let's start! What are your fitness goals?`;
}

/**
 * Build a ChatGPT URL with the prompt prefilled
 * 
 * Uses chatgpt.com/?prompt=... format which prefills the composer.
 * User still needs to press Send.
 */
export function buildChatGptUrl(prompt: string): string {
    const encodedPrompt = encodeURIComponent(prompt);
    return `https://chatgpt.com/?prompt=${encodedPrompt}`;
}

/**
 * Convert PlanExportData to DraftPlan format (client-side, no matching)
 * 
 * Used by both Import and Share flows to convert export data to draft format
 * without calling the server-side matching API.
 * 
 * Exercises are marked as 'unresolved' with their original exerciseDefId passed through.
 * The backend will handle matching when `autoResolveUnmatched=true`:
 * 1. First tries to match by exerciseDefId (fast path for system exercises)
 * 2. Then tries to match by name
 * 3. Creates as custom exercise only if no match found
 */
export function exportDataToDraftPlan(exportData: PlanExportData): DraftPlan {
    const exercises: DraftExercise[] = [];
    const workouts: DraftWorkout[] = [];
    
    exportData.workouts.forEach((exportWorkout, workoutIndex) => {
        const workoutItems: DraftWorkout['items'] = [];
        
        exportWorkout.exercises.forEach((exportExercise, exerciseIndex) => {
            // Generate a unique key for this exercise
            const draftExerciseKey = `w${workoutIndex}-e${exerciseIndex}`;
            
            // Create draft exercise - mark as 'unresolved' so backend handles matching
            // Pass exerciseDefId for ID-based matching (works for system exercises)
            const draftExercise: DraftExercise = {
                draftExerciseKey,
                name: exportExercise.name,
                matchStatus: 'unresolved', // Backend will match by ID then name
                matchedExerciseDefId: exportExercise.exerciseDefId, // Original ID for matching
                sets: exportExercise.sets ?? 3,
                reps: exportExercise.reps ?? 0,
                weightKg: exportExercise.weightKg ?? 0,
                durationSeconds: exportExercise.durationSeconds ?? 0,
                notes: exportExercise.notes ?? '',
            };
            
            exercises.push(draftExercise);
            
            // Add to workout items
            workoutItems.push({
                draftExerciseKey,
                order: exerciseIndex,
            });
        });
        
        // Create draft workout
        workouts.push({
            name: exportWorkout.name,
            items: workoutItems,
        });
    });
    
    return {
        planName: exportData.planName,
        durationWeeks: exportData.durationWeeks,
        exercises,
        workouts,
    };
}
