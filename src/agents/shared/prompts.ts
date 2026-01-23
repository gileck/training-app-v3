/**
 * Prompt Templates for Agent Scripts
 *
 * Contains prompt templates for:
 * - Product Design generation
 * - Technical Design generation
 * - Implementation
 * - Feedback handling (revisions)
 */

import type { ProjectItemContent } from '@/server/project-management';
import type { GitHubComment } from './types';
import type { BugDiagnostics } from './utils';
import { formatSessionLogs } from './utils';

// ============================================================
// AMBIGUITY HANDLING INSTRUCTIONS
// ============================================================

const AMBIGUITY_INSTRUCTIONS = `
CRITICAL - Handling Ambiguity:

If you encounter ANY ambiguity, uncertainty, or missing information that prevents you from completing the task correctly:

1. DO NOT make assumptions or pick an option arbitrarily
2. DO NOT proceed with partial or uncertain information
3. INSTEAD, output a clarification request in this EXACT format:

\`\`\`clarification
## Context
[Describe what's ambiguous or unclear]

## Question
[Your specific question]

## Options

✅ Option 1: [Recommended option name]
   - [Benefit/reason 1]
   - [Benefit/reason 2]

⚠️ Option 2: [Alternative option name]
   - [Drawback/reason 1]
   - [Drawback/reason 2]

[Additional options if needed - use ⚠️ for non-recommended options]

## Recommendation
I recommend Option 1 because [clear reasoning].

## How to Respond
Please respond with one of:
- "Option 1" (with optional modifications: "Option 1, but also add X")
- "Option 2" (with optional modifications)
- "New Option: [describe completely new approach]"
\`\`\`

When you output a clarification request:
- The system will post it as a comment on the GitHub issue
- Admin will be notified via Telegram
- Your work will pause until admin responds
- Admin will respond with "Option X" or "New Option: [details]"
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

const MARKDOWN_FORMATTING_INSTRUCTIONS = `
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
// PRODUCT DESIGN PROMPTS
// ============================================================

/**
 * Build prompt for generating a new product design
 */
export function buildProductDesignPrompt(issue: ProjectItemContent, comments?: GitHubComment[]): string {
    const commentsSection = comments && comments.length > 0
        ? `\n## Comments on Issue\n\nThe following comments have been added to the issue. Consider them as additional context:\n\n${comments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    return `You are creating a Product Design document for a GitHub issue. Your task is to:
1. Understand the feature from the issue description
2. Explore the codebase to understand existing patterns and architecture
3. Create a Product Design document

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}
**Labels:** ${issue.labels?.join(', ') || 'None'}

**Description:**
${issue.body || 'No description provided'}
${commentsSection}
## Your Task

Create a Product Design document. The size of your output should match the complexity of the feature - simple features get simple designs, complex features get detailed designs.

**CRITICAL - PRODUCT DESIGN ONLY:**
This is a PRODUCT design, NOT a technical design. Do NOT include:
- Technical implementation details or code snippets
- File paths or component names
- API endpoints or database schemas
- Technical architecture decisions
- Implementation notes or instructions

Focus ONLY on:
- What the user sees and experiences
- How the feature behaves from a user perspective
- UI/UX design decisions

**Required sections:**
1. **Size Estimate** - S (small, few hours) / M (medium, 1-2 days) / L (large, multiple days)
2. **Overview** - Brief summary of what this feature does and why it's needed
3. **UI/UX Design** - How the feature will look and behave
   - Describe the interface elements
   - User flow and interactions
   - Include error handling and loading states naturally within the flow
   - Consider mobile/responsive needs if relevant

**Optional sections (include only when relevant):**
- **User Stories** - Only for features where multiple user types or complex workflows need clarification
- **Edge Cases** - Only for features with non-obvious edge cases that need explicit design decisions

## Research Strategy

Before writing the design, explore the codebase:
1. Read \`src/client/routes/index.ts\` to understand the routing structure
2. If a page is mentioned, find and read that component
3. Look at similar existing features for patterns
4. Check relevant types in \`src/apis/\` if the feature needs API work

## Output Format

Provide your response as structured JSON with these fields:
- **design**: Complete Product Design document in markdown format (same structure as before)
- **comment**: High-level design overview to post as GitHub comment (3-5 bullet points). Format: "Here's the design overview: 1. ... 2. ... 3. ..."

Keep the design concise. A small feature might only need a few paragraphs. A large feature needs more detail.

Example for a SMALL feature (S):

\`\`\`markdown
# Product Design: Add logout button

**Size: S**

## Overview
Add a logout button to the user menu dropdown. When clicked, clears the session and redirects to the login page.

## UI/UX Design
- Add "Logout" item at the bottom of the existing user dropdown menu
- Shows loading spinner while logging out
- On success: redirect to /login
- On error: show toast notification
\`\`\`

Example for a MEDIUM/LARGE feature:

\`\`\`markdown
# Product Design: [Feature Title]

**Size: M** (or L)

## Overview
[1-2 paragraph summary]

## User Stories (if needed)
- As a user, I want to...
- As an admin, I want to...

## UI/UX Design

### Layout
[Description of the interface]

### User Flow
1. User navigates to...
2. User clicks...
3. System shows loading state...
4. On success/error...

### Mobile Considerations
[Only if relevant]

## Edge Cases (if needed)
[Only non-obvious cases that need design decisions]
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now explore the codebase and create the Product Design document.`;
}

/**
 * Build prompt for revising product design based on feedback
 */
export function buildProductDesignRevisionPrompt(
    issue: ProjectItemContent,
    existingDesign: string,
    feedbackComments: GitHubComment[]
): string {
    const feedbackSection = feedbackComments
        .map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`)
        .join('\n\n---\n\n');

    return `You are revising a Product Design document based on admin feedback.

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}

**Original Description:**
${issue.body || 'No description provided'}

## Existing Product Design

${existingDesign}

## Admin Feedback

The admin has requested changes. Please address ALL of the following feedback:

${feedbackSection}

## Your Task

1. Carefully read and understand all feedback comments
2. Research any areas mentioned in the feedback
3. Revise the Product Design to address ALL feedback points
4. Keep the output size proportional to the feature complexity

**CRITICAL - PRODUCT DESIGN ONLY:**
This is a PRODUCT design, NOT a technical design. Do NOT include:
- Technical implementation details or code snippets
- File paths or component names
- API endpoints or database schemas
- Technical architecture decisions
- Implementation notes or instructions

Focus ONLY on:
- What the user sees and experiences
- How the feature behaves from a user perspective
- UI/UX design decisions

## Output Format

Provide your response as structured JSON with these fields:
- **design**: COMPLETE revised Product Design document in markdown format (entire document, not just changes)
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Format: "Here's what I changed: 1. ... 2. ... 3. ..."

Do NOT output just the changes in design - output the entire revised document. Keep it concise.

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now revise the Product Design based on the feedback.`;
}

/**
 * Build prompt for continuing product design after clarification
 */
export function buildProductDesignClarificationPrompt(
    content: { title: string; number: number; body: string; labels?: string[] },
    issueComments: Array<{ body: string; author: string; createdAt: string }>,
    clarification: { body: string; author: string; createdAt: string }
): string {
    const commentsSection = issueComments.length > 0
        ? `\n## All Issue Comments\n\n${issueComments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    return `You previously asked for clarification while working on the product design for this feature.

## Issue
**Title:** ${content.title}
**Number:** ${content.number}
**Labels:** ${content.labels?.join(', ') || 'None'}

**Description:**
${content.body}
${commentsSection}
## Your Question
You asked for clarification because you encountered ambiguity. Review the GitHub issue comments above to see your question.

## Admin's Clarification
**From:** ${clarification.author}
**Date:** ${clarification.createdAt}

${clarification.body}

## Task
Continue your product design work using the admin's clarification as guidance. Complete the product design document.

If the admin's response is still unclear or raises new ambiguities, you may ask another clarification question using the same format.

**CRITICAL - PRODUCT DESIGN ONLY:**
This is a PRODUCT design, NOT a technical design. Do NOT include:
- Technical implementation details or code snippets
- File paths or component names
- API endpoints or database schemas
- Technical architecture decisions
- Implementation notes or instructions

Focus ONLY on:
- What the user sees and experiences
- How the feature behaves from a user perspective
- UI/UX design decisions

**Required sections:**
1. **Size Estimate** - S (small, few hours) / M (medium, 1-2 days) / L (large, multiple days)
2. **Overview** - Brief summary of what this feature does and why it's needed
3. **UI/UX Design** - How the feature will look and behave
   - Describe the interface elements
   - User flow and interactions
   - Include error handling and loading states naturally within the flow
   - Consider mobile/responsive needs if relevant

**Optional sections (include only when relevant):**
- **User Stories** - Only for features where multiple user types or complex workflows need clarification
- **Edge Cases** - Only for features with non-obvious edge cases that need explicit design decisions

## Output Format

Provide your response as structured JSON with these fields:
- **design**: Complete Product Design document in markdown format
- **comment**: High-level design overview to post as GitHub comment (3-5 bullet points). Format: "Here's the design overview: 1. ... 2. ... 3. ..."

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now complete the Product Design document using the clarification provided.`;
}

// ============================================================
// TECHNICAL DESIGN PROMPTS
// ============================================================

/**
 * Build prompt for generating a new technical design
 */
export function buildTechDesignPrompt(issue: ProjectItemContent, productDesign: string | null, comments?: GitHubComment[]): string {
    const productDesignSection = productDesign
        ? `## Approved Product Design

${productDesign}`
        : `## Note
No product design phase for this item (internal/technical work). Base your technical design on the issue description.`;

    const commentsSection = comments && comments.length > 0
        ? `\n## Comments on Issue\n\nThe following comments have been added to the issue. Consider them as additional context:\n\n${comments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    return `You are creating a Technical Design document for a GitHub issue.${productDesign ? ' The Product Design has been approved, and now you need to define the technical implementation.' : ' This is internal/technical work that skipped the product design phase.'}

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}

**Original Description:**
${issue.body || 'No description provided'}
${commentsSection}
${productDesignSection}

## Your Task

Create a Technical Design document. The size of your output should match the complexity of the feature - simple features get simple designs, complex features get detailed designs.

**Required sections:**
1. **Size & Complexity** - Effort (S/M/L) and complexity (Low/Medium/High)
2. **Overview** - Brief technical approach (1-2 sentences for small features)
3. **Files to Create/Modify** - List of files with brief description of changes

**Optional sections (include only when relevant):**
- **Data Model** - Only if new collections or schema changes needed
- **API Changes** - Only if new endpoints or modifications needed
- **State Management** - Only if non-trivial state handling needed
- **Implementation Notes** - Only for complex logic that needs explanation

## Research Strategy

Explore the codebase:
1. Read existing similar features to understand patterns
2. Check \`src/apis/\` for API patterns
3. Check \`src/server/database/collections/\` for database patterns
4. Look at \`src/client/routes/\` for component patterns

## Output Format

Provide your response as structured JSON with these fields:
- **design**: Complete Technical Design document in markdown format (same structure as before)
- **comment**: High-level implementation plan to post as GitHub comment (3-5 bullet points). Format: "Here's the implementation plan: 1. ... 2. ... 3. ..."

Keep the design concise. A small feature might only need a short list of files. A large feature needs more detail.

Example for a SMALL feature (S):

\`\`\`markdown
# Technical Design: Add logout button

**Size: S** | **Complexity: Low**

## Overview
Add logout menu item that calls existing auth API and redirects.

## Files to Modify
| File | Changes |
|------|---------|
| \`src/client/components/UserMenu.tsx\` | Add logout menu item with onClick handler |
| \`src/client/features/auth/hooks.ts\` | Add useLogout hook (calls auth/logout API) |
\`\`\`

Example for a MEDIUM/LARGE feature:

\`\`\`markdown
# Technical Design: [Feature Title]

**Size: M** | **Complexity: Medium**

## Overview
[Brief technical approach]

## Files to Create
| File | Purpose |
|------|---------|
| \`src/apis/feature-name/types.ts\` | Types |
| \`src/apis/feature-name/handlers/create.ts\` | Create handler |
| \`src/client/routes/FeatureName/index.tsx\` | Main component |

## Files to Modify
| File | Changes |
|------|---------|
| \`src/client/routes/index.ts\` | Add route |

## Data Model (if needed)
\`\`\`typescript
interface FeatureDocument {
  _id: ObjectId;
  // fields...
}
\`\`\`

## API Endpoints (if needed)
- \`feature-name/create\` - POST - Creates new feature item
- \`feature-name/list\` - GET - Lists user's items

## Implementation Notes (if needed)
[Only for complex logic]
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now explore the codebase and create the Technical Design document.`;
}

/**
 * Build prompt for revising technical design based on feedback
 */
export function buildTechDesignRevisionPrompt(
    issue: ProjectItemContent,
    productDesign: string | null,
    existingTechDesign: string,
    feedbackComments: GitHubComment[]
): string {
    const feedbackSection = feedbackComments
        .map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`)
        .join('\n\n---\n\n');

    const productDesignSection = productDesign
        ? `## Approved Product Design

${productDesign}

`
        : '';

    return `You are revising a Technical Design document based on admin feedback.

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}

${productDesignSection}## Existing Technical Design

${existingTechDesign}

## Admin Feedback

The admin has requested changes. Please address ALL of the following feedback:

${feedbackSection}

## Your Task

1. Carefully read and understand all feedback comments
2. Research any areas mentioned in the feedback
3. Revise the Technical Design to address ALL feedback points
4. Keep the output size proportional to the feature complexity

## Output Format

Provide your response as structured JSON with these fields:
- **design**: COMPLETE revised Technical Design document in markdown format (entire document, not just changes)
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Format: "Here's what I changed: 1. ... 2. ... 3. ..."

Do NOT output just the changes in design - output the entire revised document. Keep it concise.

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now revise the Technical Design based on the feedback.`;
}

/**
 * Build prompt for continuing technical design after clarification
 */
export function buildTechDesignClarificationPrompt(
    content: { title: string; number: number; body: string },
    productDesign: string | null,
    issueComments: Array<{ body: string; author: string; createdAt: string }>,
    clarification: { body: string; author: string; createdAt: string }
): string {
    const productDesignSection = productDesign
        ? `## Product Design\n\n${productDesign}\n`
        : '';

    const commentsSection = issueComments.length > 0
        ? `\n## All Issue Comments\n\n${issueComments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    return `You previously asked for clarification while working on the technical design for this feature.

## Issue
**Title:** ${content.title}
**Number:** ${content.number}

**Description:**
${content.body}

${productDesignSection}${commentsSection}
## Your Question
You asked for clarification because you encountered ambiguity. Review the GitHub issue comments above to see your question.

## Admin's Clarification
**From:** ${clarification.author}
**Date:** ${clarification.createdAt}

${clarification.body}

## Task
Continue your technical design work using the admin's clarification as guidance. Complete the technical design document.

If the admin's response is still unclear or raises new ambiguities, you may ask another clarification question using the same format.

**Requirements:**
- List all files to create/modify with specific paths
- Provide clear implementation guidance
- Include data models if database changes are needed
- Specify API endpoints if backend work is needed
- Keep the size proportional to the feature complexity

## Output Format

Provide your response as structured JSON with these fields:
- **design**: Complete Technical Design document in markdown format
- **comment**: High-level implementation plan to post as GitHub comment (3-5 bullet points). Format: "Here's the implementation plan: 1. ... 2. ... 3. ..."

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now complete the Technical Design document using the clarification provided.`;
}

// ============================================================
// IMPLEMENTATION PROMPTS
// ============================================================

/**
 * Build prompt for implementing a feature
 */
export function buildImplementationPrompt(
    issue: ProjectItemContent,
    productDesign: string | null,
    techDesign: string | null,
    branchName: string,
    comments?: GitHubComment[]
): string {
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

${techDesign}

Note: No product design phase for this item (internal/technical work).`;
        implementationSource = 'the Technical Design document';
    } else if (productDesign) {
        designContext = `## Approved Product Design

${productDesign}

Note: No technical design phase for this item. Implement based on the product design.`;
        implementationSource = 'the Product Design document';
    } else {
        designContext = `Note: No design documents for this item (simple fix/change). Implement based on the issue description.`;
        implementationSource = 'the issue description';
    }

    const commentsSection = comments && comments.length > 0
        ? `\n## Comments on Issue\n\nThe following comments have been added to the issue. Consider them as additional context:\n\n${comments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    return `You are implementing a feature${techDesign || productDesign ? ' based on approved design documents' : ''}.

IMPORTANT: You are in WRITE mode. You CAN and SHOULD create and modify files to implement this feature.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}
**Branch:** ${branchName}

**Original Description:**
${issue.body || 'No description provided'}
${commentsSection}
${designContext}

## Your Task

Implement the feature as specified in ${implementationSource}:

1. Create all new files listed in "Files to Create"
2. Modify all files listed in "Files to Modify"
3. Follow the Implementation Order specified
4. Ensure code follows existing patterns in the codebase
5. Add necessary imports and exports
6. Do NOT write tests unless specifically requested

## Implementation Guidelines

**CRITICAL**: Before implementing, read the project guidelines in \`.cursor/rules/\`:
- \`.cursor/rules/typescript-guidelines.mdc\` - TypeScript coding standards
- \`.cursor/rules/react-component-organization.mdc\` - Component structure and patterns
- \`.cursor/rules/react-hook-organization.mdc\` - Custom hook patterns
- \`.cursor/rules/state-management-guidelines.mdc\` - Zustand and React Query usage
- \`.cursor/rules/feature-based-structure.mdc\` - File organization by feature
- \`.cursor/rules/ui-design-guidelines.mdc\` - UI/UX patterns
- \`.cursor/rules/shadcn-usage.mdc\` - shadcn/ui component usage
- \`.cursor/rules/client-server-communications.mdc\` - API patterns
- \`.cursor/rules/mongodb-usage.mdc\` - Database operations (if applicable)
- \`.cursor/rules/app-guidelines-checklist.mdc\` - Comprehensive checklist

Key principles:
- Follow the existing code patterns in the codebase
- Use TypeScript with proper types
- Follow the project's ESLint rules
- Keep components small and focused
- Use existing UI components from shadcn/ui
- Use semantic color tokens (bg-background, not bg-white)
- For state management, use React Query for server state and Zustand for client state

## Important Notes

- Read existing similar code before implementing
- Use the exact file paths specified in the Technical Design
- Ensure all imports are correct
- Do not add features or improvements beyond what's specified

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

## Output

After implementing, provide your response as structured JSON with these fields:
- **prSummary**: Complete PR summary in markdown format with "## Summary" and "## Changes" sections (this will be used in PR description and squash merge commit)
- **comment**: High-level summary of what you did to post as GitHub comment (3-5 bullet points). Format: "Here's what I did: 1. ... 2. ... 3. ..."

Example prSummary format:
\`\`\`markdown
## Summary
[2-4 bullet points describing what was implemented and key decisions made]

## Changes
- **[filename]**: [brief description of change]
- **[filename]**: [brief description of change]
[List the most important files changed - max 5-7 files]
\`\`\`

Begin implementing the feature now.`;
}

/**
 * Build prompt for addressing PR review feedback
 */
export function buildPRRevisionPrompt(
    issue: ProjectItemContent,
    productDesign: string | null,
    techDesign: string | null,
    feedbackComments: GitHubComment[],
    prReviewComments: Array<{ path?: string; line?: number; body: string; author: string }>
): string {
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
        contextSection += `*No design documents (simple fix/change)*\n\n`;
    }

    return `You are addressing PR review feedback for a feature implementation.

IMPORTANT: You are in WRITE mode. You CAN and SHOULD modify files to address the feedback.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}

${contextSection}

## Review Feedback

### Issue Comments
${issueComments || 'No issue comments'}

### PR Review Comments
${reviewComments || 'No PR review comments'}

## Understanding Your Reviewers

You have received feedback from two different reviewers with distinct roles:

**1. PR Review Agent** (author: "Agent (PR Review)")
- **Focus**: Project-specific guidelines compliance from \`.cursor/rules/\`
- **Checks**: TypeScript patterns, React patterns, state management, file organization, API structure
- **Priority**: HIGH - These are project standards that MUST be followed
- **Expertise**: This project's architecture and coding conventions

**2. Claude Code** (author: "claude")
- **Focus**: General code quality, security vulnerabilities, best practices, edge cases
- **Checks**: Bugs, security issues, performance problems, maintainability, potential errors
- **Priority**: HIGH - These are critical quality and safety issues
- **Expertise**: Broad software engineering knowledge and security

### How to Handle Multiple Reviewers

- **Both flag the same issue**: Definitely address it - it's important
- **Only one flags an issue**: Address it according to that reviewer's area of expertise
- **Potentially conflicting suggestions**:
  - For project structure/patterns/file organization → Prefer PR Review Agent
  - For security/performance/bug fixes → Prefer Claude Code
  - When genuinely conflicting → Use your judgment or ask for clarification
- **Redundant feedback**: Address the issue once - both reviewers will be satisfied

**Important**: Treat all feedback seriously. Both reviewers have HIGH priority in their respective domains.

## Your Task

1. Carefully read ALL feedback comments
2. Address each piece of feedback
3. Make the necessary code changes
4. Ensure changes don't break existing functionality

## Guidelines

**Follow project guidelines in \`.cursor/rules/\`** (same as initial implementation)

Key principles:
- Address ALL feedback points
- Keep changes focused on the feedback
- Don't add extra features or refactoring
- Test your changes make sense in context
- Follow TypeScript, React, and state management patterns from \`.cursor/rules/\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

## Output

After making changes, provide your response as structured JSON with these fields:
- **prSummary**: Updated PR summary in markdown format with "## Summary" and "## Changes" sections
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Format: "Here's what I changed: 1. ... 2. ... 3. ..."

Example comment format:
\`\`\`
Here's what I changed:
1. [Original feedback summary] → [What you changed to address it]
2. [Original feedback summary] → [What you changed to address it]
3. [Original feedback summary] → [What you changed to address it]
\`\`\`

Begin addressing the feedback now.`;
}

/**
 * Build prompt for continuing implementation after clarification
 */
export function buildImplementationClarificationPrompt(
    content: { title: string; number: number; body: string },
    productDesign: string | null,
    techDesign: string | null,
    branchName: string,
    issueComments: Array<{ body: string; author: string; createdAt: string }>,
    clarification: { body: string; author: string; createdAt: string }
): string {
    const productDesignSection = productDesign ? `## Product Design\n\n${productDesign}\n` : '';
    const techDesignSection = techDesign ? `## Technical Design\n\n${techDesign}\n` : '';
    const commentsSection = issueComments.length > 0
        ? `\n## All Issue Comments\n\n${issueComments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    return `You previously asked for clarification while implementing this feature.

## Issue
**Title:** ${content.title}
**Number:** ${content.number}

**Description:**
${content.body}

${productDesignSection}${techDesignSection}${commentsSection}
## Your Question
You asked for clarification because you encountered ambiguity. Review the GitHub issue comments above to see your question.

## Admin's Clarification
**From:** ${clarification.author}
**Date:** ${clarification.createdAt}

${clarification.body}

## Task
Continue your implementation work using the admin's clarification as guidance. Complete the implementation.

If the admin's response is still unclear or raises new ambiguities, you may ask another clarification question using the same format.

**Branch:** ${branchName}

## Implementation Guidelines

- Read existing similar code before implementing
- Use the exact file paths specified in the Technical Design
- Ensure all imports are correct
- Do not add features or improvements beyond what's specified
- Follow existing code patterns in the codebase
- Use TypeScript with proper types
- Use semantic color tokens (bg-background, not bg-white)
- For state management, use React Query for server state and Zustand for client state

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

## Output

After implementing, provide your response as structured JSON with these fields:
- **prSummary**: Complete PR summary in markdown format with "## Summary" and "## Changes" sections (this will be used in PR description and squash merge commit)
- **comment**: High-level summary of what you did to post as GitHub comment (3-5 bullet points). Format: "Here's what I did: 1. ... 2. ... 3. ..."

Example prSummary format:
\`\`\`markdown
## Summary
[2-4 bullet points describing what was implemented and key decisions made]

## Changes
- **[filename]**: [brief description of change]
- **[filename]**: [brief description of change]
[List the most important files changed - max 5-7 files]
\`\`\`

Begin implementing the feature now.`;
}

// ============================================================
// BUG-SPECIFIC PROMPTS
// ============================================================

/**
 * Build prompt for generating technical design for a bug fix
 */
export function buildBugTechDesignPrompt(
    issue: ProjectItemContent,
    diagnostics: BugDiagnostics,
    productDesign: string | null,
    comments?: GitHubComment[]
): string {
    const productDesignSection = productDesign
        ? `## Approved Product Design

${productDesign}

`
        : '';

    const commentsSection = comments && comments.length > 0
        ? `\n## Comments on Issue\n\nThe following comments have been added to the issue. Consider them as additional context:\n\n${comments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    // Format diagnostics
    const categoryLabel = diagnostics.category === 'performance' ? '⚡ Performance' : '🐛 Bug';
    const sessionLogsSection = diagnostics.sessionLogs?.length
        ? `\n**Session Logs (last 20):**\n\`\`\`\n${formatSessionLogs(diagnostics.sessionLogs.slice(-20))}\n\`\`\``
        : '';

    const stackTraceSection = diagnostics.stackTrace
        ? `\n**Stack Trace:**\n\`\`\`\n${diagnostics.stackTrace}\n\`\`\``
        : '';

    return `You are analyzing a BUG REPORT and creating a Technical Design for the fix.${productDesign ? ' A Product Design has been approved that addresses the UX/UI aspects of this bug.' : ''}

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}
**Category:** ${categoryLabel}

**Description:**
${issue.body || 'No description provided'}
${commentsSection}
${productDesignSection}## Bug Diagnostics

${diagnostics.errorMessage ? `**Error Message:** ${diagnostics.errorMessage}\n` : ''}${diagnostics.route ? `**Route:** ${diagnostics.route}\n` : ''}${diagnostics.networkStatus ? `**Network Status:** ${diagnostics.networkStatus}\n` : ''}${diagnostics.browserInfo ? `**Browser:** ${diagnostics.browserInfo.userAgent}
**Viewport:** ${diagnostics.browserInfo.viewport.width}x${diagnostics.browserInfo.viewport.height}\n` : ''}${stackTraceSection}${sessionLogsSection}

## Your Task

Analyze this bug and create a Technical Design for the fix:

**Required sections:**
1. **Root Cause Analysis** - What's causing this bug? Be specific.
2. **Affected Components** - Which files/modules are involved?
3. **Fix Approach** - How should this be fixed? Provide clear steps.
4. **Files to Create/Modify** - List files with specific changes needed

**Optional sections (include when relevant):**
- **Testing Strategy** - How to verify the fix and prevent regression
- **Risk Assessment** - Any side effects or edge cases to consider
- **Implementation Notes** - Complex logic that needs explanation

## Research Strategy

1. Use the stack trace and session logs to identify where the error occurs
2. Read the affected files to understand the current implementation
3. Look for similar patterns in the codebase
4. Consider edge cases that might trigger this bug

## Output Format

Provide your response as structured JSON with these fields:
- **design**: Complete Technical Design document in markdown format (same structure as shown in example below)
- **comment**: High-level implementation plan for the fix to post as GitHub comment (3-5 bullet points). Format: "Here's the implementation plan: 1. ... 2. ... 3. ..."

Example design structure:

\`\`\`markdown
# Bug Fix: [Issue Title]

## Root Cause Analysis

The error occurs in \`ComponentName.tsx\` when [specific condition]. The code assumes [incorrect assumption], but [actual situation].

## Affected Components

- \`src/client/routes/RouteName/ComponentName.tsx\` - Contains the buggy logic
- \`src/client/hooks/useHook.ts\` - Needs null check added

## Fix Approach

1. Add null/undefined check in ComponentName before accessing property
2. Add loading state handling in useHook
3. Update error boundary to catch this specific error

## Files to Modify

| File | Changes |
|------|---------|
| \`src/client/routes/RouteName/ComponentName.tsx\` | Add null check: \`if (!data?.property) return <LoadingState />\` |
| \`src/client/hooks/useHook.ts\` | Add early return if data is null |

## Testing Strategy

1. Reproduce the bug by [specific steps]
2. Verify fix by [verification steps]
3. Test edge case: [edge case description]
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now explore the codebase and create the Technical Design for this bug fix.`;
}

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

**Follow project guidelines in \`.cursor/rules/\`** (TypeScript, React, state management patterns)

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

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

## Output

After implementing, provide your response as structured JSON with these fields:
- **prSummary**: Complete PR summary in markdown format with "## Summary" and "## Changes" sections (this will be used in PR description and squash merge commit)
- **comment**: High-level summary of what you did to post as GitHub comment (3-5 bullet points). Format: "Here's what I did: 1. ... 2. ... 3. ..."

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

/**
 * Build prompt for revising bug fix design based on feedback
 */
export function buildBugTechDesignRevisionPrompt(
    issue: ProjectItemContent,
    diagnostics: BugDiagnostics,
    existingTechDesign: string,
    feedbackComments: GitHubComment[]
): string {
    const feedbackSection = feedbackComments
        .map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`)
        .join('\n\n---\n\n');

    return `You are revising a Bug Fix Technical Design based on admin feedback.

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}

## Existing Technical Design

${existingTechDesign}

## Admin Feedback

The admin has requested changes. Please address ALL of the following feedback:

${feedbackSection}

## Your Task

1. Carefully read and understand all feedback comments
2. Re-analyze the bug if needed (diagnostics are still available)
3. Research any areas mentioned in the feedback
4. Revise the Technical Design to address ALL feedback points

## Output Format

Provide your response as structured JSON with these fields:
- **design**: COMPLETE revised Technical Design document in markdown format (entire document, not just changes)
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Format: "Here's what I changed: 1. ... 2. ... 3. ..."

Do NOT output just the changes in design - output the entire revised document.

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now revise the Bug Fix Technical Design based on the feedback.`;
}
