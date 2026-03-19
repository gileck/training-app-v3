/**
 * Bug Fix Prompts
 *
 * Prompts specific to bug fix implementation.
 * Note: Bug investigation and tech design for bugs now go through
 * the Bug Investigator agent, which uses prompts from bug-investigation.ts
 */

import type { ProjectItemContent } from '@/server/template/project-management';
import type { GitHubComment } from '../types';
import type { BugDiagnostics } from '../utils';
import {
    AMBIGUITY_INSTRUCTIONS,
    MARKDOWN_FORMATTING_INSTRUCTIONS,
    WRITE_MODE_BUG_FIX_INSTRUCTIONS,
    WRITE_MODE_PR_REVISION_INSTRUCTIONS,
    THEMING_INSTRUCTIONS,
    buildCommentsSection,
    buildIssueDetailsHeader,
    formatCommentsList,
} from './shared-instructions';

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

    const commentsSection = buildCommentsSection(comments);

    // Include limited diagnostics in implementation prompt (full diagnostics are in tech design)
    const quickDiagnostics = `
**Error:** ${diagnostics.errorMessage || 'See issue description'}
**Route:** ${diagnostics.route || 'Unknown'}
${diagnostics.stackTrace ? `**Stack Trace:** ${diagnostics.stackTrace.slice(0, 300)}...` : ''}`;

    return `You are implementing a ${categoryLabel} FIX.

${WRITE_MODE_BUG_FIX_INSTRUCTIONS}

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

**Follow project guidelines in \`docs/template/project-guidelines/\`** (TypeScript, React, state management patterns)

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

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's what I fixed:
1. Root cause: \`parseInt\` returned NaN when input contained whitespace, causing the handler to crash
2. Added input sanitization with \`trim()\` before parsing in \`src/apis/items/handlers/update.ts\`
3. Added defensive null check in \`ItemDisplay.tsx\` to prevent rendering undefined values
4. Verified fix doesn't affect other callers of the same utility function
\`\`\`

**BAD comment example (too generic, avoid this):**
\`\`\`
Here's what I fixed:
1. Fixed the bug
2. Updated the files
3. Added error handling
\`\`\`

Begin implementing the bug fix now.`;
}

/**
 * Build prompt for addressing PR review feedback on a bug fix
 */
export function buildBugFixRevisionPrompt(
    issue: ProjectItemContent,
    diagnostics: BugDiagnostics,
    productDesign: string | null,
    techDesign: string | null,
    feedbackComments: GitHubComment[],
    prReviewComments: Array<{ path?: string; line?: number; body: string; author: string }>
): string {
    const categoryLabel = diagnostics.category === 'performance' ? '⚡ Performance Bug' : '🐛 Bug';

    const issueComments = feedbackComments
        .map((c) => `**${c.author}**:\n${c.body}`)
        .join('\n\n---\n\n');

    const reviewComments = prReviewComments
        .map((c) => {
            const location = c.path ? `\`${c.path}\`${c.line ? `:${c.line}` : ''}` : 'General';
            return `**${c.author}** on ${location}:\n${c.body}`;
        })
        .join('\n\n---\n\n');

    let contextSection = '## Context\n\n';
    if (productDesign) {
        contextSection += `### Product Design\n${productDesign}\n\n`;
    }
    if (techDesign) {
        contextSection += `### Technical Design\n${techDesign}\n\n`;
    }
    if (!productDesign && !techDesign) {
        contextSection += `*No design documents (simple fix)*\n\n`;
    }

    const quickDiagnostics = `
**Error:** ${diagnostics.errorMessage || 'See issue description'}
**Route:** ${diagnostics.route || 'Unknown'}`;

    return `You are addressing PR review feedback for a ${categoryLabel} FIX.

${WRITE_MODE_PR_REVISION_INSTRUCTIONS}

${buildIssueDetailsHeader(issue, { includeDescription: false })}
**Category:** ${categoryLabel}

## Quick Diagnostics
${quickDiagnostics}

${contextSection}

## Review Feedback

### Issue Comments
${issueComments || 'No issue comments'}

### PR Review Comments
${reviewComments || 'No PR review comments'}

## Your Task

1. Carefully read ALL feedback comments
2. Address each piece of feedback
3. Make the necessary code changes
4. Ensure changes don't break existing functionality
5. Remember: bug fixes should remain minimal and focused

## Guidelines

**Follow project guidelines in \`docs/template/project-guidelines/\`** (same as initial implementation)

${THEMING_INSTRUCTIONS}

Key principles:
- Address ALL feedback points
- Keep changes focused on the feedback
- Don't expand the fix scope beyond what's necessary
- Bug fixes should change as little code as possible
- Follow TypeScript, React, and state management patterns from \`docs/template/project-guidelines/\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

## Output

After making changes, provide your response as structured JSON with these fields:
- **prSummary**: Updated PR summary in markdown format with "## Summary" and "## Changes" sections
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

## Output Format Example

**GOOD comment format:**
\`\`\`
Here's how I addressed the feedback:
1. [Missing null check in error path] → Added null guard before accessing \`error.message\` in handler
2. [Defensive check too broad] → Narrowed the check to only cover the specific NaN case
3. [Import should use @/ alias] → Changed relative import to @/server/template/utils
\`\`\`

**BAD comment format (too vague, avoid this):**
\`\`\`
Here's what I changed:
1. Fixed the issue
2. Updated the code
3. Fixed imports
\`\`\`

Begin addressing the feedback now.`;
}

/**
 * Build prompt for continuing bug fix implementation after clarification
 */
export function buildBugFixClarificationPrompt(
    content: { title: string; number: number; body: string },
    diagnostics: BugDiagnostics,
    productDesign: string | null,
    techDesign: string | null,
    branchName: string,
    issueComments: Array<{ body: string; author: string; createdAt: string }>,
    clarification: { body: string; author: string; createdAt: string }
): string {
    const categoryLabel = diagnostics.category === 'performance' ? '⚡ Performance Bug' : '🐛 Bug';
    const productDesignSection = productDesign ? `## Product Design\n\n${productDesign}\n` : '';
    const techDesignSection = techDesign ? `## Technical Design\n\n${techDesign}\n` : '';
    const commentsSection = issueComments.length > 0
        ? `\n## All Issue Comments\n\n${formatCommentsList(issueComments)}\n`
        : '';

    const quickDiagnostics = `
**Error:** ${diagnostics.errorMessage || 'See issue description'}
**Route:** ${diagnostics.route || 'Unknown'}`;

    return `You previously asked for clarification while implementing this ${categoryLabel} FIX.

## Issue
**Title:** ${content.title}
**Number:** ${content.number}
**Category:** ${categoryLabel}

**Description:**
${content.body}

## Quick Diagnostics
${quickDiagnostics}

${productDesignSection}${techDesignSection}${commentsSection}
## Your Question
You asked for clarification because you encountered ambiguity. Review the GitHub issue comments above to see your question.

## Admin's Clarification
**From:** ${clarification.author}
**Date:** ${clarification.createdAt}

${clarification.body}

## Task
Continue your bug fix implementation using the admin's clarification as guidance. Complete the implementation.

If the admin's response is still unclear or raises new ambiguities, you may ask another clarification question using the same format.

**Branch:** ${branchName}

## Implementation Guidelines

- Read the affected files before modifying them
- Bug fixes should be minimal and focused - change as little code as possible
- Focus on the root cause, not symptoms
- Add defensive programming where appropriate (null checks, error boundaries)
- Follow existing code patterns in the codebase
- Use TypeScript with proper types
- For state management, use React Query for server state and Zustand for client state

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

## Output

After implementing, provide your response as structured JSON with these fields:
- **prSummary**: Complete PR summary in markdown format with "## Summary" and "## Changes" sections (this will be used in PR description and squash merge commit)
- **comment**: High-level summary of what you did to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's what I fixed:
1. Root cause: the validation rejected \`0\` as falsy due to \`!val\` check, now uses explicit \`=== undefined\` check
2. Updated \`src/apis/items/handlers/update.ts\` with corrected validation logic
3. Added unit-style defensive check in \`ItemForm.tsx\` to handle the edge case on the client side
\`\`\`

Begin implementing the bug fix now.`;
}
