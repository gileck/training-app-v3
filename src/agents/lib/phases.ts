/**
 * Phase Serialization/Deserialization Utilities
 *
 * Provides deterministic functions for storing and retrieving implementation phases
 * as GitHub issue comments. This ensures reliable phase tracking for multi-PR workflows.
 *
 * Architecture:
 * - Tech design agent: Uses formatPhasesToComment() to post phases as a comment
 * - Implementation agent: Uses parsePhasesFromComment() to reliably extract phases
 * - Both functions are in this file = guaranteed consistency
 */

import type { ImplementationPhase } from '../shared/output-schemas';
import type { GitHubComment } from '../shared/types';

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Marker to identify phase comments
 * Using HTML comment for invisibility + versioning for future changes
 */
const PHASE_COMMENT_MARKER = '<!-- AGENT_PHASES_V1 -->';

// ============================================================
// SERIALIZATION
// ============================================================

/**
 * Format implementation phases into a markdown comment
 *
 * This is OUR deterministic code - not relying on LLM formatting.
 * The format matches exactly what parsePhasesFromComment() expects.
 *
 * @param phases - Array of implementation phases from tech design
 * @returns Markdown-formatted comment ready to post on GitHub
 */
export function formatPhasesToComment(phases: ImplementationPhase[]): string {
    if (!phases || phases.length === 0) {
        return '';
    }

    const phaseSections = phases.map(p => `### Phase ${p.order}: ${p.name} (${p.estimatedSize})

${p.description}

**Files to modify:**
${p.files.map(f => `- \`${f}\``).join('\n')}
`).join('\n');

    return `${PHASE_COMMENT_MARKER}
## Implementation Phases

This feature will be implemented in ${phases.length} sequential PRs:

${phaseSections}
---
*Phase tracking managed by Implementation Agent*`;
}

// ============================================================
// DESERIALIZATION
// ============================================================

/**
 * Parse implementation phases from GitHub issue comments
 *
 * This is OUR deterministic code - matches formatPhasesToComment() output exactly.
 * Should be used as the PRIMARY method for getting phases (more reliable than
 * parsing from tech design markdown).
 *
 * @param comments - Array of GitHub issue comments
 * @returns Array of parsed phases, or null if no phase comment found
 */
export function parsePhasesFromComment(comments: GitHubComment[]): ImplementationPhase[] | null {
    if (!comments || comments.length === 0) {
        return null;
    }

    // Find the phase comment by marker
    const phaseComment = comments.find(c => c.body.includes(PHASE_COMMENT_MARKER));
    if (!phaseComment) {
        return null;
    }

    const phases: ImplementationPhase[] = [];

    // Parse each phase section
    // Pattern: ### Phase N: Name (Size)\n\nDescription\n\n**Files to modify:**\n- `file1`\n- `file2`
    // Use a more flexible regex that handles various whitespace patterns
    const phasePattern = /### Phase (\d+): ([^(\n]+)\s*\(([SM])\)\s*\n\n([^\n]+)\s*\n\n\*\*Files to modify:\*\*\s*\n((?:- `[^`]+`\s*\n?)+)/g;

    let match;
    while ((match = phasePattern.exec(phaseComment.body)) !== null) {
        const [, orderStr, name, size, description, filesSection] = match;

        // Extract files from markdown list
        const fileMatches = filesSection.matchAll(/- `([^`]+)`/g);
        const files = Array.from(fileMatches, m => m[1]);

        phases.push({
            order: parseInt(orderStr, 10),
            name: name.trim(),
            description: description.trim(),
            files,
            estimatedSize: size as 'S' | 'M',
        });
    }

    // Only return phases if we found at least 2 (multi-phase feature)
    return phases.length >= 2 ? phases : null;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if any comment contains a phase marker
 *
 * Useful for determining if phases have already been posted
 *
 * @param comments - Array of GitHub issue comments
 * @returns true if a phase comment exists
 */
export function hasPhaseComment(comments: GitHubComment[]): boolean {
    if (!comments || comments.length === 0) {
        return false;
    }
    return comments.some(c => c.body.includes(PHASE_COMMENT_MARKER));
}

/**
 * Get the phase comment marker (for testing or external use)
 */
export function getPhaseCommentMarker(): string {
    return PHASE_COMMENT_MARKER;
}
