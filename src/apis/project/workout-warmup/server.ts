/**
 * Workout Warmup API - Server Handler
 *
 * Handler is inlined here (no handlers/ folder) because this is a
 * single-operation API. See index.ts for architecture notes.
 */

import { AIModelAdapter } from '../../../server/ai/baseModelAdapter';
import { AIModelAdapterResponse } from '../../../server/ai/types';
import { getModelById } from '../../../server/ai/models';
import { GenerateWarmupRequest, GenerateWarmupResponse, WarmupExerciseData } from './types';
import { GENERATE_WARMUP } from './index';

export * from './index';

/**
 * Build a detailed prompt for warmup generation based on exercises
 */
function buildWarmupPrompt(exercises: WarmupExerciseData[]): string {
    // Group exercises by primary muscle
    const muscleGroups = new Map<string, WarmupExerciseData[]>();
    for (const ex of exercises) {
        const muscle = ex.primaryMuscle;
        if (!muscleGroups.has(muscle)) {
            muscleGroups.set(muscle, []);
        }
        muscleGroups.get(muscle)!.push(ex);
    }

    // Build exercise summary
    const exerciseSummary = exercises
        .map((ex) => {
            const details: string[] = [`- ${ex.name} (${ex.primaryMuscle})`];
            if (ex.sets > 0) details.push(`  Sets: ${ex.sets}`);
            if (ex.reps > 0) details.push(`  Reps: ${ex.reps}`);
            if (ex.weight > 0) details.push(`  Weight: ${ex.weight}kg`);
            if (ex.durationSeconds > 0) details.push(`  Duration: ${ex.durationSeconds}s`);
            if (ex.isBodyweight) details.push(`  Type: Bodyweight`);
            if (ex.isStatic) details.push(`  Type: Static/Isometric`);
            return details.join('\n');
        })
        .join('\n\n');

    const muscleList = Array.from(muscleGroups.keys()).join(', ');

    return `You are a professional fitness coach creating a personalized warmup routine.

## Workout Overview
The user is about to perform the following exercises:

${exerciseSummary}

## Target Muscle Groups
Primary muscles being worked: ${muscleList}

## Your Task
Create a comprehensive 5-10 minute warmup routine that:
1. Starts with light cardio (1-2 minutes) to raise heart rate
2. Includes dynamic stretches targeting the specific muscle groups being worked
3. Includes mobility exercises for joints that will be used (shoulders, hips, knees, etc.)
4. Includes activation exercises to "wake up" the target muscles
5. Progresses from general to specific movements

## Format Requirements
- Use markdown formatting
- Include clear section headers (## for sections)
- List each exercise with duration or rep count
- Add brief form cues where helpful
- Keep it practical and actionable
- Total warmup should be 5-10 minutes

Generate the warmup routine now:`;
}

/**
 * Process warmup generation request
 */
export const process = async (request: GenerateWarmupRequest): Promise<GenerateWarmupResponse> => {
    try {
        const { exercises } = request;

        // Validate input
        if (!exercises || exercises.length === 0) {
            return {
                error: 'No exercises provided for warmup generation',
            };
        }

        // Build the prompt
        const prompt = buildWarmupPrompt(exercises);

        // Use provided model or default to a fast, cost-effective model
        const selectedModelId = request.modelId || 'gemini-2.5-flash';
        const adapter = new AIModelAdapter(selectedModelId);

        // Generate warmup
        const response: AIModelAdapterResponse<string> = await adapter.processPromptToText(prompt);

        // Get model info for the response
        const modelInfo = getModelById(selectedModelId);

        return {
            warmup: response.result,
            cost: {
                totalCost: response.cost.totalCost,
                modelId: selectedModelId,
                modelName: modelInfo.name,
            },
        };
    } catch (error) {
        console.error('Error generating warmup:', error);
        return {
            error: `Failed to generate warmup: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
};

export const workoutWarmupApiHandlers = {
    [GENERATE_WARMUP]: { process },
};
