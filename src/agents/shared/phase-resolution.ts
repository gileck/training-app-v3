/**
 * Shared Phase Resolution
 *
 * Resolves implementation phase details for multi-phase workflow items.
 * Used by both the implementation agent and PR review agent to look up
 * phase information from multiple sources (DB, comments, tech design markdown).
 *
 * Resolution order (first non-null wins):
 *   1. Database (workflow-items collection)
 *   2. GitHub issue comments (formatted by tech design agent)
 *   3. Tech design markdown content (fallback parsing)
 */

import type { ImplementationPhase } from './output-schemas';
import type { GitHubComment } from './types';
import {
    extractPhasesFromTechDesign,
} from '../lib/parsing';
import {
    parsePhasesFromComment,
} from '../lib/phases';
import { getPhasesFromDB } from '../lib/workflow-db';

export interface ResolvedPhaseDetails {
    /** All parsed phases */
    phases: ImplementationPhase[];
    /** Details for the current phase (if found) */
    currentPhaseDetails: ImplementationPhase | undefined;
}

/**
 * Resolve phase details from DB, comments, or tech design markdown.
 *
 * Tries three sources in order: DB first (most reliable), then
 * structured comment (posted by tech design agent), then raw
 * tech design markdown (least reliable fallback).
 *
 * @param issueNumber - GitHub issue number
 * @param issueComments - GitHub issue comments to search for phase comment
 * @param techDesign - Raw tech design markdown (optional)
 * @param currentPhaseOrder - The current phase number to look up details for
 * @returns Resolved phases and current phase details, or null if no phases found
 */
export async function resolvePhaseDetails(
    issueNumber: number,
    issueComments: GitHubComment[],
    techDesign: string | null,
    currentPhaseOrder: number,
): Promise<ResolvedPhaseDetails | null> {
    const phases = await getPhasesFromDB(issueNumber) ||
                   parsePhasesFromComment(issueComments) ||
                   (techDesign ? extractPhasesFromTechDesign(techDesign) : null);

    if (!phases) {
        return null;
    }

    const currentPhaseDetails = phases.find(p => p.order === currentPhaseOrder);

    return {
        phases,
        currentPhaseDetails,
    };
}
