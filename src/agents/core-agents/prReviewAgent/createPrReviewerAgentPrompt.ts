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
    prFiles: string[]; // Authoritative list from GitHub API
    prComments: PRComment[];
    prReviewComments: PRReviewComment[];
}

// ============================================================
// PROMPT SECTIONS
// ============================================================

function createPhaseContextSection(phaseInfo: PhaseInfo): string {
    const { current, total, phaseName, phaseDescription, phaseFiles } = phaseInfo;

    // Separate source files from documentation files
    const sourceFiles = phaseFiles?.filter(f =>
        !f.startsWith('docs/') && !f.startsWith('.ai/skills/')
    ) || [];
    const docFiles = phaseFiles?.filter(f =>
        f.startsWith('docs/') || f.startsWith('.ai/skills/')
    ) || [];

    let section = `## ⚠️ MULTI-PHASE IMPLEMENTATION - PHASE-SPECIFIC REVIEW REQUIRED

**This PR implements Phase ${current} of ${total}**: ${phaseName || 'Unknown'}

`;

    if (phaseDescription) {
        section += `**Phase Description:** ${phaseDescription}

`;
    }

    if (sourceFiles.length > 0) {
        section += `**Expected Source Files for this Phase:**
`;
        for (const file of sourceFiles) {
            section += `- \`${file}\`
`;
        }
        section += `
`;
    }

    if (docFiles.length > 0) {
        section += `**Relevant Documentation (verify compliance):**
The tech design specified these docs as relevant for this phase. READ them and verify the implementation follows their guidelines:
`;
        for (const file of docFiles) {
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

**Phase-Aware Review Examples:**

✅ **APPROVE** scenarios for Phase ${current}:
- PR implements exactly what Phase ${current} describes
- Minor additional improvements within Phase ${current} scope (better error handling, comments)
- Files outside the expected list IF they're necessary imports/exports for Phase ${current} functionality

❌ **REQUEST CHANGES** scenarios:
- PR implements features clearly belonging to Phase ${current + 1} or later
- PR creates UI components when Phase ${current} is "Database & Types" only
- PR is incomplete - doesn't implement all of Phase ${current} (partial implementation)
- Code doesn't follow project guidelines

⚠️ **EDGE CASES** (use judgment):
- Small refactors in related code → APPROVE if minor, REQUEST CHANGES if significant scope creep
- Test files for Phase ${current} functionality → APPROVE (testing current phase is good)
- Documentation updates → APPROVE (documenting current phase is good)
`;

    if (sourceFiles.length > 0) {
        section += `5. ✅ Verify changes are primarily in the expected source files listed above
`;
    }

    if (docFiles.length > 0) {
        section += `6. ✅ Verify implementation follows the guidelines in the relevant documentation
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

    section += `**⚠️ IMPORTANT - Claude GitHub App Feedback:**
If Claude (GitHub App) has reviewed this PR, you MUST explicitly respond to each point he raised. Include a "Claude Feedback Response" section in your review:

\`\`\`
### Claude Feedback Response
1. [Claude's point about X] - **AGREE** - Added to changes requested
2. [Claude's point about Y] - **DISAGREE** - This pattern is acceptable because [reason]
\`\`\`

You are the final decision maker, but you must provide reasoning for each point you agree or disagree with. Do not silently ignore Claude's feedback.

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

function createPRFilesSection(prFiles: string[]): string {
    return `## Files in this PR (from GitHub API)

**IMPORTANT:** These are the ONLY files that are part of this PR. Review ONLY these files.
Do NOT flag files that are not in this list - they are NOT part of this PR.

${prFiles.map(f => `- \`${f}\``).join('\n')}

---

`;
}

function createInstructionsSection(): string {
    return `## Instructions

**You are the FINAL AUTHORITY on this PR review.** Your decision determines the status.

Review this PR and make your final decision. Provide your review decision (APPROVED or REQUEST_CHANGES) and detailed feedback.

**⚠️ STRICT APPROVAL CRITERIA:**
- **Request changes** if there are ANY issues or improvements that provide clear, meaningful value
- **Only approve** if there are no issues or improvements worth requesting
- If you find yourself wanting to say "Approved with minor suggestions" or "Looks good but consider..." - that is a REQUEST_CHANGES, not an approval
- **All feedback must be in scope** - issues and improvements must be within the context of the task/PR scope. Do not request changes for unrelated code or out-of-scope improvements

**⚠️ FEEDBACK QUALITY - No Nitpicking:**
- **Only raise issues that provide real, meaningful value.** Every issue you raise triggers a full revision cycle, so it must be worth the cost.
- **Do NOT raise** minor/speculative issues such as: hypothetical edge cases that aren't demonstrated problems, requests to "add a comment explaining X", optional accessibility improvements on decorative elements, or theoretical concerns without concrete impact.
- **DO raise** issues such as: actual bugs or logic errors, violations of documented project guidelines, missing error/loading/empty state handling, security concerns, performance problems with real impact.
- Ask yourself: "Would a senior engineer request changes for this, or would they just merge it?" If the answer is merge, don't raise it.

**CRITICAL: Project Docs Override Generic Best Practices**

This project has specific patterns documented in \`docs/\` and \`.ai/skills/\` that may differ from generic best practices. These project-specific patterns exist for good reasons (e.g., to prevent known bugs).

**You MUST:**
1. READ the relevant project docs before suggesting changes
2. FOLLOW project patterns even if they differ from common conventions
3. If you disagree with a project pattern, note it as a **"suggestion for future consideration"** - NOT a required change
4. NEVER request changes that contradict documented project guidelines

**Example:** If project docs say "use individual Zustand selectors, not combined object selectors", do NOT request combining them even if that's a common pattern elsewhere.

**IMPORTANT**: Check compliance with project guidelines in \`.ai/skills/\` (Only when relevant to code changes):
- TypeScript guidelines (\`.ai/skills/typescript-guidelines/SKILL.md\`)
- React patterns (\`.ai/skills/react-component-organization/SKILL.md\`, \`.ai/skills/react-hook-organization/SKILL.md\`)
- State management (\`.ai/skills/state-management-guidelines/SKILL.md\`)
- UI/UX patterns (\`.ai/skills/ui-design-guidelines/SKILL.md\`, \`.ai/skills/shadcn-usage/SKILL.md\`)
- File organization (\`.ai/skills/feature-based-structure/SKILL.md\`)
- API patterns (\`.ai/skills/client-server-communications/SKILL.md\`)
- Comprehensive checklist (\`.ai/skills/app-guidelines-checklist/SKILL.md\`)
- mongoDB usage (\`.ai/skills/mongodb-usage/SKILL.md\`)
- pages-and-routing-guidelines (\`.ai/skills/pages-and-routing-guidelines/SKILL.md\`)
- shadcn-usage (\`.ai/skills/shadcn-usage/SKILL.md\`)
- theming-guidelines (\`.ai/skills/theming-guidelines/SKILL.md\`)
- user-access (\`.ai/skills/user-access/SKILL.md\`)
- ui-mobile-first-shadcn (\`.ai/skills/ui-mobile-first-shadcn/SKILL.md\`)

`;
}

const OUTPUT_INSTRUCTIONS = `

After completing the review, provide your response as structured JSON with these fields:
- decision: either "approved" or "request_changes"
- summary: 1-2 sentence summary of the review (see examples below)
- reviewText: the full review content to post as PR comment
   * Keep it short when highlighting positive feedback (checklist of what looks good is enough, no need to elaborate).
   * Keep it concise and direct when highlighting negative feedback. Include BAD/GOOD examples when applicable (short code examples).
   * When writing negative feedback, always include a suggestion for improvement.

### SUMMARY QUALITY REQUIREMENTS

The summary field should be descriptive and specific, not generic.

**GOOD summary examples:**
- "Approved: Clean implementation following project patterns. Mobile-first UI verified, Zustand store properly configured."
- "Approved: Bug fix correctly handles edge case. Good error handling and test coverage."
- "Request changes: Missing error handling in API calls, touch targets too small on mobile."
- "Request changes: Combined object selector will cause infinite re-renders (see state-management docs)."

**BAD summary examples (too vague, avoid):**
- "Approved"
- "Approved: Looks good"
- "Request changes: Some issues found"
- "Request changes: Needs fixes"

The summary should give the admin a quick understanding of WHY you approved/rejected without reading the full reviewText.

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
 * 2. PR files list (authoritative from GitHub API)
 * 3. PR comments (if any)
 * 4. Inline review comments (if any)
 * 5. Instructions
 * 6. /review slash command
 * 7. Output format instructions
 */
export function createPrReviewerAgentPrompt(context: PromptContext): string {
    const { phaseInfo, prFiles, prComments, prReviewComments } = context;

    return `
${phaseInfo ? createPhaseContextSection(phaseInfo) : ''}
${createPRFilesSection(prFiles)}
${prComments.length > 0 ? createPRCommentsSection(prComments) : ''}
${prReviewComments.length > 0 ? createReviewCommentsSection(prReviewComments) : ''}
${createInstructionsSection()}

/review

${OUTPUT_INSTRUCTIONS}
`;
}
