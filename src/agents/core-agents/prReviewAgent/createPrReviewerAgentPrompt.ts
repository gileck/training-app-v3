/**
 * Creates the prompt for the PR Review Agent.
 *
 * This file contains all prompt construction logic extracted for readability.
 * The prompt guides Claude to review PRs with phase awareness and project guidelines.
 */

import { MARKDOWN_FORMATTING_INSTRUCTIONS } from "@/agents/shared/prompts";

// ============================================================
// TYPES
// ============================================================

export interface PhaseInfo {
    current: number;
    total: number;
    phaseName?: string;
    phaseDescription?: string;
    phaseFiles?: string[];
}

export interface PRComment {
    author: string;
    body: string;
    createdAt: string;
}

export interface PRReviewComment {
    author: string;
    body: string;
    path?: string;
    line?: number;
}

export interface PromptContext {
    phaseInfo?: PhaseInfo;
    prComments: PRComment[];
    prReviewComments: PRReviewComment[];
}

// ============================================================
// PROMPT SECTIONS
// ============================================================

function createPhaseContextSection(phaseInfo: PhaseInfo): string {
    const { current, total, phaseName, phaseDescription, phaseFiles } = phaseInfo;

    let section = `## ⚠️ MULTI-PHASE IMPLEMENTATION - PHASE-SPECIFIC REVIEW REQUIRED

**This PR implements Phase ${current} of ${total}**: ${phaseName || 'Unknown'}

`;

    if (phaseDescription) {
        section += `**Phase Description:** ${phaseDescription}

`;
    }

    if (phaseFiles && phaseFiles.length > 0) {
        section += `**Expected Files for this Phase:**
`;
        for (const file of phaseFiles) {
            section += `- \`${file}\`
`;
        }
        section += `
`;
    }

    section += `**CRITICAL REVIEW REQUIREMENTS:**
1. ✅ Verify the PR ONLY implements Phase ${current} functionality
2. ❌ Flag if the PR implements features from later phases (Phase ${current + 1}+)
3. ✅ Verify the PR is independently mergeable and testable
4. ✅ Check that the PR follows the phase description above
`;

    if (phaseFiles && phaseFiles.length > 0) {
        section += `5. ✅ Verify changes are primarily in the expected files listed above
`;
    }

    section += `
---

`;

    return section;
}

function createPRCommentsSection(prComments: PRComment[]): string {
    let section = `## PR Comments

The following comments have been posted on the PR:

`;

    for (const comment of prComments) {
        section += `**${comment.author}** (${new Date(comment.createdAt).toLocaleDateString()}):
${comment.body}

`;
    }

    section += `**Note:** If Claude (GitHub App) has reviewed this PR, use his feedback as optional helpful guidance but not as final authority. You are the final decision maker.

---

`;

    return section;
}

function createReviewCommentsSection(prReviewComments: PRReviewComment[]): string {
    let section = `## PR Review Comments (Inline Code Comments)

The following inline comments have been posted on specific code:

`;

    for (const comment of prReviewComments) {
        const location = comment.path && comment.line
            ? `\`${comment.path}:${comment.line}\``
            : comment.path
                ? `\`${comment.path}\``
                : 'general';
        section += `**${comment.author}** on ${location}:
${comment.body}

`;
    }

    section += `---

`;

    return section;
}

function createInstructionsSection(): string {
    return `## Instructions

**You are the FINAL AUTHORITY on this PR review.** Your decision determines the status.

Review this PR and make your final decision. Provide your review decision (APPROVED or REQUEST_CHANGES) and detailed feedback.

**IMPORTANT**: Check compliance with project guidelines in \`.cursor/rules/\` (Only when relevant to code changes):
- TypeScript guidelines (\`.cursor/rules/typescript-guidelines.mdc\`)
- React patterns (\`.cursor/rules/react-component-organization.mdc\`, \`.cursor/rules/react-hook-organization.mdc\`)
- State management (\`.cursor/rules/state-management-guidelines.mdc\`)
- UI/UX patterns (\`.cursor/rules/ui-design-guidelines.mdc\`, \`.cursor/rules/shadcn-usage.mdc\`)
- File organization (\`.cursor/rules/feature-based-structure.mdc\`)
- API patterns (\`.cursor/rules/client-server-communications.mdc\`)
- Comprehensive checklist (\`.cursor/rules/app-guidelines-checklist.mdc\`)
- mongoDB usage (\`.cursor/rules/mongodb-usage.mdc\`)
- pages-and-routing-guidelines (\`.cursor/rules/pages-and-routing-guidelines.mdc\`)
- shadcn-usage (\`.cursor/rules/shadcn-usage.mdc\`)
- theming-guidelines (\`.cursor/rules/theming-guidelines.mdc\`)
- user-access (\`.cursor/rules/user-access.mdc\`)
- ui-mobile-first-shadcn (\`.cursor/rules/ui-mobile-first-shadcn.mdc\`)

`;
}

const OUTPUT_INSTRUCTIONS = `

After completing the review, provide your response as structured JSON with these fields:
- decision: either "approved" or "request_changes"
- summary: 1-2 sentence summary of the review
- reviewText: the full review content to post as PR comment
   * Keep it short when highlighting positive feedback (checklist of what looks good is enough, no need to elaborate). 
   * Keep it concise and direct when highlighting negative feedback. Include BAD/GOOD examples when applicable (short code examples).
   * When writing negative feedback, always include a suggestion for improvement.
   



${MARKDOWN_FORMATTING_INSTRUCTIONS}
`;

// ============================================================
// MAIN PROMPT CREATION
// ============================================================

/**
 * Creates the complete prompt for the PR Review Agent.
 *
 * The prompt is structured as:
 * 1. Phase context (if multi-phase workflow)
 * 2. PR comments (if any)
 * 3. Inline review comments (if any)
 * 4. Instructions
 * 5. /review slash command
 * 6. Output format instructions
 */
export function createPrReviewerAgentPrompt(context: PromptContext): string {
    const { phaseInfo, prComments, prReviewComments } = context;

    return `
${phaseInfo ? createPhaseContextSection(phaseInfo) : ''}
${prComments.length > 0 ? createPRCommentsSection(prComments) : ''}
${prReviewComments.length > 0 ? createReviewCommentsSection(prReviewComments) : ''}
${createInstructionsSection()}

/review

${OUTPUT_INSTRUCTIONS}
`;
}
