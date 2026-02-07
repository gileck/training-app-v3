/**
 * Product Design Prompts
 *
 * Prompts for the Product Design phase that defines HOW the feature
 * will look and feel from a user perspective (UI/UX).
 */

import type { ProjectItemContent } from '@/server/project-management';
import type { GitHubComment } from '../types';
import {
    AMBIGUITY_INSTRUCTIONS,
    MARKDOWN_FORMATTING_INSTRUCTIONS,
    MOBILE_FIRST_INSTRUCTIONS,
    PRODUCT_DESIGN_ONLY_WARNING,
    READ_ONLY_MODE_INSTRUCTIONS,
    FEEDBACK_HISTORY_INSTRUCTIONS,
    buildCommentsSection,
    buildFeedbackSection,
    buildIssueDetailsHeader,
    formatCommentsList,
} from './shared-instructions';

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
    const commentsSection = buildCommentsSection(comments);

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

${READ_ONLY_MODE_INSTRUCTIONS}

${buildIssueDetailsHeader(issue, { includeLabels: true })}
${commentsSection}${pddSection}
## Your Task

Create a Product Design document. The size of your output should match the complexity of the feature - simple features get simple designs, complex features get detailed designs.${productDevelopmentDoc ? '\n\n**Important:** The Product Development Document above defines the requirements and acceptance criteria. Your design should address those requirements from a UI/UX perspective.' : ''}

${PRODUCT_DESIGN_ONLY_WARNING}

${MOBILE_FIRST_INSTRUCTIONS}

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

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's the product design:
1. Added logout button to the user menu dropdown with loading state and error toast
2. Mobile-first: button placed at bottom of dropdown for easy thumb access (44px touch target)
3. On success redirects to /login, on error shows non-blocking toast notification
4. Size estimate: S - simple addition to existing dropdown component
\`\`\`

**BAD comment example (too generic, avoid this):**
\`\`\`
Here's the product design:
1. Designed the feature
2. Added UI details
3. Wrote the document
\`\`\`

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
    const feedbackSection = buildFeedbackSection(feedbackComments);

    return `You are revising a Product Design document based on admin feedback.

${READ_ONLY_MODE_INSTRUCTIONS}

${buildIssueDetailsHeader(issue, { descriptionLabel: 'Original Description' })}

## Existing Product Design

${existingDesign}

## Feedback History

${FEEDBACK_HISTORY_INSTRUCTIONS}

${feedbackSection}

## Your Task

1. Carefully read all feedback comments to understand the full context
2. **Look for the most recent "✅ Addressed Feedback" marker** - this shows where the last revision cycle ended
3. **Address ALL feedback comments that appear AFTER the marker** (there may be multiple comments covering different areas)
4. If no marker exists, this is the first revision - address all feedback comments
5. Research any areas mentioned in the feedback
6. Revise the Product Design to address all the relevant feedback points
7. Keep the output size proportional to the feature complexity

${PRODUCT_DESIGN_ONLY_WARNING}

## Output Format

Provide your response as structured JSON with these fields:
- **design**: COMPLETE revised Product Design document in markdown format (entire document, not just changes)
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

Do NOT output just the changes in design - output the entire revised document. Keep it concise.

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's what I revised in the product design:
1. [Feedback: missing error states] → Added explicit error handling for network failures and invalid input
2. [Feedback: touch targets too small] → Increased all interactive elements to 44px minimum
3. Kept the overall flow unchanged, only addressed the specific feedback points
\`\`\`

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
        ? `\n## All Issue Comments\n\n${formatCommentsList(issueComments)}\n`
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

${PRODUCT_DESIGN_ONLY_WARNING}

${MOBILE_FIRST_INSTRUCTIONS}

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

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's the product design (after clarification):
1. Admin clarified the feature should only apply to premium users - scoped the design accordingly
2. Designed a collapsible filter panel for the settings page with mobile-first layout
3. Added empty state when no items match filters, with a "clear filters" action
4. Size estimate: M - requires new UI panel and filter logic
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now complete the Product Design document using the clarification provided.`;
}
