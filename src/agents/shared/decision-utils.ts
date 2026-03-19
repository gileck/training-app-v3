/**
 * Shared decision utilities for agents that produce decision options.
 *
 * Multiple agents (bug investigator, product design) convert their
 * domain-specific output options into the generic DecisionOption format.
 * This module provides a generic converter that handles the common fields
 * (id, title, description, isRecommended) and delegates metadata building
 * to a caller-provided function.
 */

import type { DecisionOption } from '@/apis/template/agent-decision/types';

/**
 * Minimal interface that decision-producing agent outputs must satisfy.
 * Each domain option must have at least these fields.
 */
export interface DecisionOptionSource {
    id: string;
    title: string;
    description: string;
    isRecommended: boolean;
}

/**
 * Convert domain-specific options to generic DecisionOption format.
 *
 * @param options - Array of domain-specific option objects
 * @param buildMetadata - Function that builds the metadata object for each option
 */
export function toDecisionOptions<T extends DecisionOptionSource>(
    options: T[],
    buildMetadata: (opt: T) => Record<string, string | string[]>,
): DecisionOption[] {
    return options.map(opt => ({
        id: opt.id,
        title: opt.title,
        description: opt.description,
        isRecommended: opt.isRecommended,
        metadata: buildMetadata(opt),
    }));
}
