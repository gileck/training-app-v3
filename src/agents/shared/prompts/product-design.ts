/**
 * Product Design Prompts
 *
 * Prompts for the Product Design phase that defines HOW the feature
 * will look and feel from a user perspective (UI/UX).
 */

import type { ProjectItemContent } from '@/server/project-management';
import type { GitHubComment } from '../types';
import { AMBIGUITY_INSTRUCTIONS, MARKDOWN_FORMATTING_INSTRUCTIONS } from './shared-instructions';

/**
 * Build prompt for generating a new product design
 *
 * @param issue - The GitHub issue content
 * @param productDevelopmentDoc - Optional Product Development Document (if this feature went through that phase)
 * @param comments - Optional issue comments for additional context
 */
export function buildProductDesignPrompt(
    issue: ProjectItemContent,
    productDevelopmentDoc?: string | null,
    comments?: GitHubComment[]
): string {
    const commentsSection = comments && comments.length > 0
        ? `\n## Comments on Issue\n\nThe following comments have been added to the issue. Consider them as additional context:\n\n${comments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    const pddSection = productDevelopmentDoc
        ? `\n## Approved Product Development Document

This feature went through the Product Development phase. The following document defines WHAT to build and WHY.
Your Product Design should address the UI/UX aspects of the requirements defined here.

${productDevelopmentDoc}

---
`
        : '';

    return `You are creating a Product Design document for a GitHub issue.${productDevelopmentDoc ? ' The Product Development document has been approved, defining WHAT to build. Now you need to design HOW it will look and feel.' : ''} Your task is to:
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
${commentsSection}${pddSection}
## Your Task

Create a Product Design document. The size of your output should match the complexity of the feature - simple features get simple designs, complex features get detailed designs.${productDevelopmentDoc ? '\n\n**Important:** The Product Development Document above defines the requirements and acceptance criteria. Your design should address those requirements from a UI/UX perspective.' : ''}

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

**CRITICAL - MOBILE-FIRST DESIGN:**
This is a mobile-first application. ALL UI designs must prioritize small screens (~400px CSS width) first.
- Design for 400px viewport width first, then describe enhancements for larger screens
- Ensure all touch targets are at least 44px
- Place primary actions in thumb-friendly zones (bottom of screen)
- Avoid designs that require horizontal scrolling on mobile
- See \`.ai/skills/ui-mobile-first-shadcn/SKILL.md\` for detailed mobile-first guidelines

**Required sections:**
1. **Size Estimate** - S (small, few hours) / M (medium, 1-2 days) / L (large, multiple days)
2. **Overview** - Brief summary of what this feature does and why it's needed
3. **UI/UX Design** - How the feature will look and behave (MOBILE-FIRST)
   - Describe the interface elements for mobile (~400px) first
   - User flow and interactions optimized for touch
   - Include error handling and loading states naturally within the flow
   - Describe tablet/desktop enhancements separately if needed

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
- **comment**: High-level design overview to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

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
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

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

**CRITICAL - MOBILE-FIRST DESIGN:**
This is a mobile-first application. ALL UI designs must prioritize small screens (~400px CSS width) first.
- Design for 400px viewport width first, then describe enhancements for larger screens
- Ensure all touch targets are at least 44px
- Place primary actions in thumb-friendly zones (bottom of screen)
- See \`.ai/skills/ui-mobile-first-shadcn/SKILL.md\` for detailed mobile-first guidelines

**Required sections:**
1. **Size Estimate** - S (small, few hours) / M (medium, 1-2 days) / L (large, multiple days)
2. **Overview** - Brief summary of what this feature does and why it's needed
3. **UI/UX Design** - How the feature will look and behave (MOBILE-FIRST)
   - Describe the interface elements for mobile (~400px) first
   - User flow and interactions optimized for touch
   - Include error handling and loading states naturally within the flow
   - Describe tablet/desktop enhancements separately if needed

**Optional sections (include only when relevant):**
- **User Stories** - Only for features where multiple user types or complex workflows need clarification
- **Edge Cases** - Only for features with non-obvious edge cases that need explicit design decisions

## Output Format

Provide your response as structured JSON with these fields:
- **design**: Complete Product Design document in markdown format
- **comment**: High-level design overview to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now complete the Product Design document using the clarification provided.`;
}
