/**
 * Shared Instructions for Agent Prompts
 *
 * Contains reusable instruction blocks used across multiple prompt templates.
 */

import type { ProjectItemContent } from '@/server/template/project-management';
import type { GitHubComment } from '../types';

// ============================================================
// AMBIGUITY HANDLING INSTRUCTIONS
// ============================================================

export const AMBIGUITY_INSTRUCTIONS = `
CRITICAL - Handling Ambiguity:

If you encounter ANY ambiguity, uncertainty, or missing information that prevents you from completing the task correctly:

1. DO NOT make assumptions or pick an option arbitrarily
2. DO NOT proceed with partial or uncertain information
3. INSTEAD, use the clarification fields in your structured output:

Set these fields:
- \`needsClarification\`: true
- \`clarification\`: An object with structured clarification data (see format below)
- Leave all other fields empty (design, comment, phases, etc.)

Format for clarification object:
\`\`\`json
{
  "needsClarification": true,
  "clarification": {
    "context": "Explain what is ambiguous or unclear and why clarification is needed.",
    "question": "Your specific, actionable question.",
    "options": [
      {
        "label": "Recommended option name",
        "description": "Detailed explanation of this option, its benefits, and approach.\\n- Bullet point 1\\n- Bullet point 2",
        "isRecommended": true
      },
      {
        "label": "Alternative option name",
        "description": "Detailed explanation of this option and its tradeoffs.\\n- Bullet point 1\\n- Bullet point 2",
        "isRecommended": false
      }
    ],
    "recommendation": "I recommend [option] because [clear reasoning]."
  },
  "design": "",
  "comment": ""
}
\`\`\`

Guidelines for clarification:
- Provide 2-4 options (one should be recommended)
- Use clear, descriptive labels for options
- Include detailed descriptions with bullet points (use \\n for newlines)
- Only set isRecommended=true for ONE option
- Keep the question specific and actionable

When you set needsClarification=true:
- The system will post a formatted comment on the GitHub issue
- Admin will be notified via Telegram with an interactive UI
- Admin can select an option or provide a custom response
- Your work will pause until admin responds
- You will be re-invoked with the admin's clear answer

Examples of when to ask for clarification:
- Technical design mentions creating new infrastructure that doesn't exist
- Multiple valid implementation approaches with different tradeoffs
- Requirements conflict or are unclear
- Missing information about user expectations
- Uncertainty about existing patterns to follow
`;

// ============================================================
// MARKDOWN FORMATTING INSTRUCTIONS
// ============================================================

export const MARKDOWN_FORMATTING_INSTRUCTIONS = `
CRITICAL - Markdown Formatting:

**NEVER USE TABLES IN MARKDOWN OUTPUT**

Instead of tables, ALWAYS use:
- ✅ Bulleted lists with sub-bullets
- ✅ Numbered lists with nested items
- ✅ Definition lists (term: description)

Examples:

BAD (table):
| File | Changes |
|------|---------|
| src/file.ts | Add function |

GOOD (list):
**Files to Modify:**
- \`src/file.ts\`
  - Add function
  - Update imports

BAD (table):
| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/users | GET | List users |

GOOD (nested list):
**API Endpoints:**
- \`/api/users\` (GET)
  - Purpose: List users
  - Returns: User array

This applies to ALL markdown output: designs, technical documents, PR summaries.
`;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build the "## Comments on Issue" section from issue comments.
 * Used in new design/implementation prompts for additional context.
 *
 * @param comments - Issue comments to format
 * @param contextSuffix - Additional text after "have been added to the issue" (default: ". Consider them as additional context")
 */
export function buildCommentsSection(comments: GitHubComment[] | undefined, contextSuffix = '. Consider them as additional context'): string {
    return comments && comments.length > 0
        ? `\n## Comments on Issue\n\nThe following comments have been added to the issue${contextSuffix}:\n\n${formatCommentsList(comments)}\n`
        : '';
}

/**
 * Build the formatted feedback section from feedback comments.
 * Used in revision prompts to display reviewer feedback.
 */
export function buildFeedbackSection(feedbackComments: GitHubComment[]): string {
    return feedbackComments
        .map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`)
        .join('\n\n---\n\n');
}

/**
 * Build the "## Issue Details" header with standard fields.
 * Used across most prompt builders.
 *
 * @param issue - The issue content
 * @param options - Optional fields to include
 */
export function buildIssueDetailsHeader(
    issue: ProjectItemContent,
    options?: { includeLabels?: boolean; includeDescription?: boolean; descriptionLabel?: string }
): string {
    const { includeLabels = false, includeDescription = true, descriptionLabel = 'Description' } = options ?? {};
    const labelsLine = includeLabels ? `\n**Labels:** ${issue.labels?.join(', ') || 'None'}` : '';
    const descriptionBlock = includeDescription
        ? `\n\n**${descriptionLabel}:**\n${issue.body || 'No description provided'}`
        : '';
    return `## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}${labelsLine}${descriptionBlock}`;
}

/**
 * Format a list of comments into markdown with author/date headers and separators.
 * Shared by buildCommentsSection and buildFeedbackSection.
 */
export function formatCommentsList(comments: Array<{ body: string; author: string; createdAt: string }>): string {
    return comments
        .map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`)
        .join('\n\n---\n\n');
}

// ============================================================
// INSTRUCTION CONSTANTS
// ============================================================

/**
 * Instructions for handling feedback history with chronological sorting
 * and addressed feedback markers. Used in revision prompts.
 */
export const FEEDBACK_HISTORY_INSTRUCTIONS = `The comments below are sorted chronologically (oldest first, newest last).
- **"\u2705 Addressed Feedback" markers** - these indicate what was addressed in previous iterations
- **Focus on ALL comments since the last marker** - if a marker exists, address all feedback that came after it
- **If no marker exists** - address all feedback comments (this is the first revision)
- **Older comments before the marker** - use for context only, they have already been addressed`;

/**
 * Read-only mode instruction. Used in design and investigation prompts.
 */
export const READ_ONLY_MODE_INSTRUCTIONS = 'IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.';

/**
 * Write mode instruction for feature implementation.
 */
export const WRITE_MODE_INSTRUCTIONS = 'IMPORTANT: You are in WRITE mode. You CAN and SHOULD create and modify files to implement this feature.';

/**
 * Write mode instruction for bug fix implementation.
 */
export const WRITE_MODE_BUG_FIX_INSTRUCTIONS = 'IMPORTANT: You are in WRITE mode. You CAN and SHOULD create and modify files to fix this bug.';

/**
 * Write mode instruction for PR revision.
 */
export const WRITE_MODE_PR_REVISION_INSTRUCTIONS = 'IMPORTANT: You are in WRITE mode. You CAN and SHOULD modify files to address the feedback.';

/**
 * Mobile-first design instructions. Used in product design prompts.
 */
export const MOBILE_FIRST_INSTRUCTIONS = `**CRITICAL - MOBILE-FIRST DESIGN:**
This is a mobile-first application. ALL UI designs must prioritize small screens (~400px CSS width) first.
- Design for 400px viewport width first, then describe enhancements for larger screens
- Ensure all touch targets are at least 44px
- Place primary actions in thumb-friendly zones (bottom of screen)
- Avoid designs that require horizontal scrolling on mobile
- See \`docs/template/project-guidelines/ui-mobile-first-shadcn.md\` for detailed mobile-first guidelines`;

/**
 * Product-design-only warning block. Used in product design prompts.
 */
export const PRODUCT_DESIGN_ONLY_WARNING = `**CRITICAL - PRODUCT DESIGN ONLY:**
This is a PRODUCT design, NOT a technical design. Do NOT include:
- Technical implementation details or code snippets
- File paths or component names
- API endpoints or database schemas
- Technical architecture decisions
- Implementation notes or instructions

Focus ONLY on:
- What the user sees and experiences
- How the feature behaves from a user perspective
- UI/UX design decisions`;

/**
 * Product development focus warning block. Used in product development prompts.
 */
export const PRODUCT_DEVELOPMENT_FOCUS_WARNING = `**CRITICAL - PRODUCT DEVELOPMENT vs PRODUCT DESIGN:**

This is a PRODUCT DEVELOPMENT document, NOT a product design document:
- Product Development: WHAT to build & WHY (requirements, business value, acceptance criteria)
- Product Design: HOW it looks & feels (UI/UX, user flows, interface elements)

Do NOT include:
- UI mockups or interface descriptions
- Visual design decisions
- Specific component layouts
- Color schemes or styling

Focus ONLY on:
- Business requirements and objectives
- User needs and target audience
- Acceptance criteria (what "done" looks like)
- Scope boundaries (what's in and what's out)
- Success metrics`;

/**
 * Implementation guidelines block listing skill files to read.
 */
export const IMPLEMENTATION_GUIDELINES = `## Implementation Guidelines

**CRITICAL**: Before implementing, read the project guidelines in \`docs/template/project-guidelines/\`:
- \`docs/template/project-guidelines/ui-mobile-first-shadcn.md\` - **CRITICAL** Mobile-first UI implementation
- \`docs/template/project-guidelines/typescript-guidelines.md\` - TypeScript coding standards
- \`docs/template/project-guidelines/react-component-organization.md\` - Component structure and patterns
- \`docs/template/project-guidelines/react-hook-organization.md\` - Custom hook patterns
- \`docs/template/project-guidelines/state-management-guidelines.md\` - Zustand and React Query usage
- \`docs/template/project-guidelines/feature-based-structure.md\` - File organization by feature
- \`docs/template/project-guidelines/ui-design-guidelines.md\` - UI/UX patterns
- \`docs/template/project-guidelines/shadcn-usage.md\` - shadcn/ui component usage
- \`docs/template/project-guidelines/theming-guidelines.md\` - **CRITICAL** Theming and color usage
- \`docs/template/project-guidelines/client-server-communications.md\` - API patterns
- \`docs/template/project-guidelines/mongodb-usage.md\` - Database operations (if applicable)
- \`docs/template/project-guidelines/app-guidelines-checklist.md\` - Comprehensive checklist`;

/**
 * Theming instructions block. Used in implementation and PR revision prompts.
 */
export const THEMING_INSTRUCTIONS = `**THEMING (Read \`docs/theming.md\` and \`docs/template/project-guidelines/theming-guidelines.md\` before styling)**:
- **NEVER** use hardcoded colors like \`bg-white\`, \`text-black\`, \`bg-blue-500\`, or hex values
- **ALWAYS** use semantic tokens: \`bg-background\`, \`bg-card\`, \`text-foreground\`, \`text-muted-foreground\`, \`bg-primary\`, etc.
- For status colors use: \`text-success\`, \`text-warning\`, \`text-destructive\`, \`text-info\`
- **Exceptions**:
  - Dialog overlays may use \`bg-black/60\` for backdrop opacity
  - Hardcoded colors ONLY if specifically requested in the task requirements (e.g., brand colors from product team). In this case, add a code comment: \`// Hardcoded per task requirement: "[quote the specific requirement]"\``;
