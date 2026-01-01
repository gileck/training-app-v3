/**
 * Training Plan Prompt Builder
 * 
 * Keeps prompt construction separate from API handler logic.
 * This allows easy extension in Phase 2 (form-based input with level, goals, etc.)
 * 
 * The input object can later expand beyond text to include:
 * - level (beginner/intermediate/advanced)
 * - daysPerWeek
 * - goals (strength, hypertrophy, endurance, weight loss)
 * - equipment (gym, home, bodyweight)
 * - musclesFocus (specific muscles to target)
 */

// Increment when prompt structure changes significantly (invalidates cache)
export const PROMPT_VERSION = 1;

// Phase 1: text-only input
export interface PromptInput {
    text: string;
    planName: string;
    durationWeeks: number;
    // Phase 2 fields (optional, for future use):
    // level?: 'beginner' | 'intermediate' | 'advanced';
    // daysPerWeek?: number;
    // goals?: string[];
    // equipment?: string[];
    // musclesFocus?: string[];
}

// AI output schema (what we ask the model to return)
export interface AIWorkoutExercise {
    name: string;
    sets?: number;
    reps?: number;
    durationSeconds?: number;
    weightKg?: number;
    notes?: string;
}

export interface AIWorkout {
    name: string;
    exercises: AIWorkoutExercise[];
}

export interface AIPlanOutput {
    workouts: AIWorkout[];
}

/**
 * Build the prompt for generating a training plan from user input.
 * Returns the full prompt string to send to the AI model.
 */
export function buildTrainingPlanPrompt(input: PromptInput): string {
    const { text, planName, durationWeeks } = input;

    return `You are a professional fitness trainer creating a structured training plan.

USER REQUEST:
Plan name: "${planName}"
Duration: ${durationWeeks} weeks
User's description:
"""
${text}
"""

INSTRUCTIONS:
1. Parse the user's text and create a structured training plan with workouts and exercises.
2. If the text lists specific exercises, use them. If vague, create appropriate exercises.
3. Group exercises into logical workouts (e.g., "Day 1 - Upper Body", "Push Day", "Full Body A").
4. For each exercise, include sets, reps (or durationSeconds for timed/static exercises).
5. ALWAYS use specific, unambiguous exercise names that include the equipment:
   - ✓ "Barbell Overhead Press" or "Dumbbell Overhead Press" (NOT just "Overhead Press")
   - ✓ "Barbell Squat" or "Goblet Squat" (NOT just "Squat")
   - ✓ "Barbell Bench Press" or "Dumbbell Bench Press" (NOT just "Bench Press")
   - ✓ "Barbell Curl" or "Dumbbell Curl" (NOT just "Bicep Curl")
   - ✓ "Cable Tricep Pushdown" or "Dumbbell Tricep Extension" (NOT just "Tricep Extension")
   - NEVER use alternatives or options in exercise names like "Pull-up / Lat Pulldown" or "Squat or Leg Press"
   - Pick ONE specific exercise - choose the best/optimal one or the closest to what the user asked for
6. If the user specifies sets/reps like "3×8" or "3x8", parse them correctly.
7. For timed exercises (like planks), use durationSeconds instead of reps.
8. Add helpful "notes" for exercises with form cues, focus points, or technique tips (e.g., "Keep back straight", "Squeeze at the top", "Control the descent").

IMPORTANT PARSING RULES:
- "3×8" or "3x8" or "3 sets of 8" = sets: 3, reps: 8
- "30s" or "30 seconds" = durationSeconds: 30 (no reps)
- "2min" or "2 minutes" = durationSeconds: 120
- If weight is mentioned (e.g., "55kg", "100lbs"), convert to kg for weightKg field

OUTPUT FORMAT:
Return ONLY valid JSON matching this exact schema:
{
  "workouts": [
    {
      "name": "Workout Name (e.g., Day 1 - Push)",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 3,
          "reps": 8,
          "weightKg": 50,
          "notes": "Keep chest up, drive through heels"
        },
        {
          "name": "Plank",
          "sets": 3,
          "durationSeconds": 30,
          "notes": "Engage core, keep body in straight line"
        }
      ]
    }
  ]
}

RULES:
- Return ONLY the JSON object, no markdown, no explanation
- Every workout must have a name and at least one exercise
- Every exercise must have a name and either (sets + reps) or (sets + durationSeconds)
- If the user input is unclear or not fitness-related, return: {"workouts": []}`;
}

/**
 * Normalize duration strings to seconds
 * e.g., "30s" -> 30, "2min" -> 120, "1:30" -> 90
 */
export function parseDurationToSeconds(input: string): number | null {
    const trimmed = input.trim().toLowerCase();
    
    // "30s" or "30 seconds"
    const secondsMatch = trimmed.match(/^(\d+)\s*(?:s|sec|seconds?)$/);
    if (secondsMatch) {
        return parseInt(secondsMatch[1], 10);
    }
    
    // "2min" or "2 minutes"
    const minutesMatch = trimmed.match(/^(\d+)\s*(?:m|min|minutes?)$/);
    if (minutesMatch) {
        return parseInt(minutesMatch[1], 10) * 60;
    }
    
    // "1:30" format
    const colonMatch = trimmed.match(/^(\d+):(\d{2})$/);
    if (colonMatch) {
        return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
    }
    
    return null;
}

/**
 * Parse sets×reps notation
 * e.g., "3×8" -> { sets: 3, reps: 8 }, "3x8-12" -> { sets: 3, reps: 10 }
 */
export function parseSetsReps(input: string): { sets?: number; reps?: number } | null {
    const trimmed = input.trim().toLowerCase();
    
    // "3×8" or "3x8"
    const simpleMatch = trimmed.match(/^(\d+)\s*[×x]\s*(\d+)$/);
    if (simpleMatch) {
        return {
            sets: parseInt(simpleMatch[1], 10),
            reps: parseInt(simpleMatch[2], 10),
        };
    }
    
    // "3x8-12" -> take average
    const rangeMatch = trimmed.match(/^(\d+)\s*[×x]\s*(\d+)-(\d+)$/);
    if (rangeMatch) {
        const min = parseInt(rangeMatch[2], 10);
        const max = parseInt(rangeMatch[3], 10);
        return {
            sets: parseInt(rangeMatch[1], 10),
            reps: Math.round((min + max) / 2),
        };
    }
    
    // "3 sets of 8"
    const verboseMatch = trimmed.match(/^(\d+)\s*sets?\s*(?:of|x)?\s*(\d+)$/);
    if (verboseMatch) {
        return {
            sets: parseInt(verboseMatch[1], 10),
            reps: parseInt(verboseMatch[2], 10),
        };
    }
    
    return null;
}
