/**
 * Bug Fix Prompts
 *
 * Prompts specific to bug fix implementation.
 * Note: Bug investigation and tech design for bugs now go through
 * the Bug Investigator agent, which uses prompts from bug-investigation.ts
 */

import type { ProjectItemContent } from '@/server/project-management';
import type { GitHubComment } from '../types';
import type { BugDiagnostics } from '../utils';
import { AMBIGUITY_INSTRUCTIONS, MARKDOWN_FORMATTING_INSTRUCTIONS } from './shared-instructions';

/**
 * Build prompt for implementing a bug fix
 */
export function buildBugImplementationPrompt(
    issue: ProjectItemContent,
    diagnostics: BugDiagnostics,
    productDesign: string | null,
    techDesign: string | null,
    branchName: string,
    comments?: GitHubComment[]
): string {
    const categoryLabel = diagnostics.category === 'performance' ? '⚡ Performance Bug' : '🐛 Bug';

    let designContext = '';
    let implementationSource = '';

    if (techDesign && productDesign) {
        designContext = `## Approved Product Design

${productDesign}

## Approved Technical Design

${techDesign}`;
        implementationSource = 'the Technical Design document';
    } else if (techDesign) {
        designContext = `## Approved Technical Design

${techDesign}`;
        implementationSource = 'the Technical Design document';
    } else if (productDesign) {
        designContext = `## Approved Product Design

${productDesign}

Note: No technical design phase. Implement the fix based on the product design and diagnostics.`;
        implementationSource = 'the Product Design and bug diagnostics';
    } else {
        designContext = `Note: No design documents (simple fix). Implement based on the issue description and diagnostics.`;
        implementationSource = 'the bug diagnostics and issue description';
    }

    const commentsSection = comments && comments.length > 0
        ? `\n## Comments on Issue\n\nThe following comments have been added to the issue. Consider them as additional context:\n\n${comments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    // Include limited diagnostics in implementation prompt (full diagnostics are in tech design)
    const quickDiagnostics = `
**Error:** ${diagnostics.errorMessage || 'See issue description'}
**Route:** ${diagnostics.route || 'Unknown'}
${diagnostics.stackTrace ? `**Stack Trace:** ${diagnostics.stackTrace.slice(0, 300)}...` : ''}`;

    return `You are implementing a ${categoryLabel} FIX.

IMPORTANT: You are in WRITE mode. You CAN and SHOULD create and modify files to fix this bug.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}
**Branch:** ${branchName}
**Category:** ${categoryLabel}

**Description:**
${issue.body || 'No description provided'}
${commentsSection}
## Quick Diagnostics
${quickDiagnostics}

${designContext}

## Your Task

Implement the bug fix as specified in ${implementationSource}:

1. Fix the root cause identified in the design
2. Add necessary error handling or loading states
3. Ensure the fix doesn't break existing functionality
4. Be surgical - bug fixes should be minimal and focused

## Implementation Guidelines

**Follow project guidelines in \`.ai/skills/\`** (TypeScript, React, state management patterns)

Key principles for bug fixes:
- **Be minimal**: Bug fixes should change as little code as possible
- Focus on the root cause, not symptoms
- Add defensive programming where appropriate (null checks, error boundaries)
- Follow existing code patterns in the codebase
- Use TypeScript with proper types
- For state management, use React Query for server state and Zustand for client state

## Important Notes

- Read the affected files before modifying them
- Test your assumptions by checking existing code
- Add comments explaining non-obvious fixes
- DO NOT refactor surrounding code unless necessary for the fix
- DO NOT add features or improvements beyond the bug fix

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

## Output

After implementing, provide your response as structured JSON with these fields:
- **prSummary**: Complete PR summary in markdown format with "## Summary" and "## Changes" sections (this will be used in PR description and squash merge commit)
- **comment**: High-level summary of what you did to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

Example prSummary format (for bug fixes, mention root cause, how it was fixed, and how to verify):
\`\`\`markdown
## Summary
[2-4 bullet points describing: the root cause, how it was fixed, and how to verify]

## Changes
- **[filename]**: [brief description of change]
- **[filename]**: [brief description of change]
[List the most important files changed - max 5-7 files]
\`\`\`

Begin implementing the bug fix now.`;
}
