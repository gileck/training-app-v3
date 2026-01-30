/**
 * Exercise Overrides Utility Functions
 * 
 * Helpers for computing effective exercise values by merging
 * original definition with user overrides.
 */

import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';
import type { ExerciseOverrides, PlanExerciseWithDefinition } from '@/client/features/plan-data/types';

/**
 * Get the effective (display) values for an exercise by merging
 * the original definition with any user overrides.
 */
export function getEffectiveExerciseValues(
    exerciseDef: ExerciseDefinitionClient,
    overrides?: ExerciseOverrides
): {
    name: string;
    imageUrl: string;
    primaryMuscle: string;
    secondaryMuscles: string[];
    type: string;
    isBodyweight: boolean;
    isStatic: boolean;
} {
    return {
        name: overrides?.name ?? exerciseDef.name,
        imageUrl: overrides?.imageUrl ?? exerciseDef.imageUrl,
        primaryMuscle: overrides?.primaryMuscle ?? exerciseDef.primaryMuscle,
        secondaryMuscles: overrides?.secondaryMuscles ?? exerciseDef.secondaryMuscles,
        type: overrides?.type ?? exerciseDef.type,
        isBodyweight: overrides?.isBodyweight ?? exerciseDef.isBodyweight,
        isStatic: overrides?.isStatic ?? exerciseDef.isStatic,
    };
}

/**
 * Check if an exercise has any overrides
 */
export function hasOverrides(exercise: PlanExerciseWithDefinition): boolean {
    return !!exercise.overrides && Object.keys(exercise.overrides).length > 0;
}

/**
 * Check if a specific field is overridden
 */
export function isFieldOverridden(
    overrides: ExerciseOverrides | undefined,
    field: keyof ExerciseOverrides
): boolean {
    if (!overrides) return false;
    return overrides[field] !== undefined;
}

/**
 * Get the list of overridden field names
 */
export function getOverriddenFields(overrides: ExerciseOverrides | undefined): (keyof ExerciseOverrides)[] {
    if (!overrides) return [];
    return (Object.keys(overrides) as (keyof ExerciseOverrides)[]).filter(
        (key) => overrides[key] !== undefined
    );
}

/**
 * Create overrides object from form values, only including changed fields
 */
export function createOverridesFromChanges(
    original: ExerciseDefinitionClient,
    newValues: {
        name: string;
        imageUrl: string;
        primaryMuscle: string;
        secondaryMuscles: string[];
        type: string;
        isBodyweight: boolean;
        isStatic: boolean;
    }
): ExerciseOverrides | undefined {
    const overrides: ExerciseOverrides = {};
    
    if (newValues.name !== original.name) {
        overrides.name = newValues.name;
    }
    if (newValues.imageUrl !== original.imageUrl) {
        overrides.imageUrl = newValues.imageUrl;
    }
    if (newValues.primaryMuscle !== original.primaryMuscle) {
        overrides.primaryMuscle = newValues.primaryMuscle;
    }
    if (!arraysEqual(newValues.secondaryMuscles, original.secondaryMuscles)) {
        overrides.secondaryMuscles = newValues.secondaryMuscles;
    }
    if (newValues.type !== original.type) {
        overrides.type = newValues.type;
    }
    if (newValues.isBodyweight !== original.isBodyweight) {
        overrides.isBodyweight = newValues.isBodyweight;
    }
    if (newValues.isStatic !== original.isStatic) {
        overrides.isStatic = newValues.isStatic;
    }
    
    // Return undefined if no overrides (cleaner than empty object)
    return Object.keys(overrides).length > 0 ? overrides : undefined;
}

/**
 * Remove a single field from overrides
 */
export function removeOverrideField(
    overrides: ExerciseOverrides | undefined,
    field: keyof ExerciseOverrides
): ExerciseOverrides | undefined {
    if (!overrides) return undefined;
    
    const { [field]: _, ...rest } = overrides;
    return Object.keys(rest).length > 0 ? rest : undefined;
}

/**
 * Helper to compare arrays for equality
 */
function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
}
