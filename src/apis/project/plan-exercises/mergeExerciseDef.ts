/**
 * Exercise definition override merge helpers.
 *
 * Per-plan-exercise overrides are stored as a sparse Partial of the base
 * exercise definition fields. This module provides the two pure operations
 * used across client and server:
 *
 *  - mergeExerciseDef: produces the effective (merged) definition for display
 *  - stripEmptyOverrides: removes keys whose values equal the base, so the
 *    persisted override object stays minimal and "is customized?" checks
 *    stay honest.
 *
 * This file has no runtime dependencies on MongoDB, React, or any server
 * framework, so it is safe to import from both client and server code.
 */

import type { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';
import type { ExerciseDefinitionOverrides } from './types';

/**
 * Produce the effective exercise definition by applying `overrides` on top
 * of `base`. Missing or empty overrides returns `base` unchanged (same
 * reference) so downstream memoization can rely on referential equality.
 */
export function mergeExerciseDef(
    base: ExerciseDefinitionClient,
    overrides?: ExerciseDefinitionOverrides
): ExerciseDefinitionClient {
    if (!overrides || Object.keys(overrides).length === 0) return base;
    return { ...base, ...overrides };
}

/**
 * Compare two string arrays for set equality (order-insensitive).
 * Used for secondaryMuscles where order carries no meaning.
 */
function arraysEqualAsSet(a: readonly string[], b: readonly string[]): boolean {
    const setA = new Set(a);
    const setB = new Set(b);
    if (setA.size !== setB.size) return false;
    for (const value of setA) {
        if (!setB.has(value)) return false;
    }
    return true;
}

/**
 * Remove keys from `overrides` whose values are equal to the corresponding
 * field on `base`. Returns a new object — does not mutate the input.
 *
 * Scalar fields use `===`. `secondaryMuscles` uses set equality so that
 * reordering the user's chip selection doesn't count as a customization.
 *
 * An empty object ({}) is a valid and expected return value and means
 * "no fields differ from the base".
 */
export function stripEmptyOverrides(
    overrides: ExerciseDefinitionOverrides,
    base: ExerciseDefinitionClient
): ExerciseDefinitionOverrides {
    const result: ExerciseDefinitionOverrides = {};

    if (overrides.name !== undefined && overrides.name !== base.name) {
        result.name = overrides.name;
    }
    if (overrides.imageUrl !== undefined && overrides.imageUrl !== base.imageUrl) {
        result.imageUrl = overrides.imageUrl;
    }
    if (overrides.primaryMuscle !== undefined && overrides.primaryMuscle !== base.primaryMuscle) {
        result.primaryMuscle = overrides.primaryMuscle;
    }
    if (
        overrides.secondaryMuscles !== undefined &&
        !arraysEqualAsSet(overrides.secondaryMuscles, base.secondaryMuscles)
    ) {
        result.secondaryMuscles = overrides.secondaryMuscles;
    }
    if (overrides.type !== undefined && overrides.type !== base.type) {
        result.type = overrides.type;
    }
    if (overrides.isBodyweight !== undefined && overrides.isBodyweight !== base.isBodyweight) {
        result.isBodyweight = overrides.isBodyweight;
    }
    if (overrides.isStatic !== undefined && overrides.isStatic !== base.isStatic) {
        result.isStatic = overrides.isStatic;
    }

    return result;
}

/**
 * True when the override object has at least one field that actually
 * customizes the exercise. Callers that already hold a stripped override
 * object can use `Object.keys(overrides).length > 0` directly; this helper
 * exists for the common case where strip has not been applied yet.
 */
export function hasOverrides(
    overrides: ExerciseDefinitionOverrides | undefined,
    base: ExerciseDefinitionClient
): boolean {
    if (!overrides) return false;
    return Object.keys(stripEmptyOverrides(overrides, base)).length > 0;
}
