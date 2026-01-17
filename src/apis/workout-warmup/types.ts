/**
 * Exercise data for warmup generation
 */
export interface WarmupExerciseData {
    name: string;
    primaryMuscle: string;
    secondaryMuscles: string[];
    type: string;
    isBodyweight: boolean;
    isStatic: boolean;
    sets: number;
    reps: number;
    weight: number;
    durationSeconds: number;
}

/**
 * Request to generate a workout warmup
 */
export interface GenerateWarmupRequest {
    exercises: WarmupExerciseData[];
    /** AI model ID to use for generation (defaults to gemini-2.5-flash) */
    modelId?: string;
}

/**
 * Cost information for the AI generation
 */
export interface WarmupCost {
    totalCost: number;
    modelId: string;
    modelName: string;
}

/**
 * Response from warmup generation
 */
export interface GenerateWarmupResponse {
    warmup?: string; // Markdown formatted warmup routine
    cost?: WarmupCost;
    error?: string;
}
