/**
 * Product Development Prompts
 *
 * Prompts for the optional Product Development phase that transforms
 * vague feature ideas into concrete product specifications.
 * Focuses on WHAT to build and WHY (not UI/UX or implementation).
 */

import type { ProjectItemContent } from '@/server/project-management';
import type { GitHubComment } from '../types';
import {
    AMBIGUITY_INSTRUCTIONS,
    MARKDOWN_FORMATTING_INSTRUCTIONS,
    READ_ONLY_MODE_INSTRUCTIONS,
    PRODUCT_DEVELOPMENT_FOCUS_WARNING,
    FEEDBACK_HISTORY_INSTRUCTIONS,
    buildCommentsSection,
    buildFeedbackSection,
    buildIssueDetailsHeader,
    formatCommentsList,
} from './shared-instructions';

/**
 * Build prompt for generating a new product development document
 *
 * Product Development is an OPTIONAL phase that transforms vague feature ideas
 * into concrete product specifications. It focuses on WHAT to build and WHY,
 * NOT how it looks (that's Product Design) or how to implement (that's Tech Design).
 */
export function buildProductDevelopmentPrompt(issue: ProjectItemContent, comments?: GitHubComment[]): string {
    const commentsSection = buildCommentsSection(comments);

    return `You are creating a Product Development document for a GitHub issue. This is an OPTIONAL phase for vague feature ideas that need to be transformed into concrete product specifications.

${READ_ONLY_MODE_INSTRUCTIONS}

${buildIssueDetailsHeader(issue, { includeLabels: true })}
${commentsSection}
## Your Task

Create a Product Development document that transforms the vague feature idea into a concrete product specification. Your document should answer: **WHAT** are we building and **WHY**?

${PRODUCT_DEVELOPMENT_FOCUS_WARNING}

**Required sections:**
1. **Size Estimate** - S (small, few hours) / M (medium, 1-2 days) / L (large, multiple days) / XL (epic, weeks)
2. **Problem Statement** - What problem does this solve? Why is it important?
3. **Target Users** - Who will use this? What are their needs?
4. **Requirements** - Clear, numbered list of what the feature must do
   - Each requirement should have acceptance criteria (testable conditions)
5. **Success Metrics** - How will we measure if this feature is successful?
6. **Scope**
   - **In scope**: What IS included in this feature
   - **Out of scope**: What is explicitly NOT included (to prevent scope creep)

**Optional sections (include only when relevant):**
- **Dependencies** - Other features, APIs, or systems this depends on
- **Risks & Mitigations** - Known risks and how to address them
- **Open Questions** - Questions that still need answers from stakeholders

## Research Strategy

Before writing the document, explore the codebase:
1. Understand existing similar features for context
2. Check what data/APIs already exist that could support this feature
3. Look for any existing partial implementations

## Output Format

Provide your response as structured JSON with these fields:
- **document**: Complete Product Development document in markdown format
- **comment**: High-level summary to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

Keep the document concise but complete. The goal is clarity, not length.

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's the product development document:
1. Defined 4 core requirements for the notification system with testable acceptance criteria
2. Target users: all app users who need timely updates on their items
3. Success metrics: 80% of notifications read within 24h, reduced support tickets by 30%
4. Scoped out: real-time push notifications (future phase), email digest
5. Size estimate: L - requires new data model, multiple API endpoints, and UI
\`\`\`

**BAD comment example (too generic, avoid this):**
\`\`\`
Here's the product development document:
1. Wrote the requirements
2. Added success metrics
3. Defined the scope
\`\`\`

Example structure:

\`\`\`markdown
# Product Development: [Feature Title]

**Size: M**

## Problem Statement
[1-2 paragraphs explaining the problem and why it matters]

## Target Users
[Who are the users? What are their key needs?]

## Requirements

### R1: [First requirement]
**Acceptance Criteria:**
- [ ] [Testable condition 1]
- [ ] [Testable condition 2]

### R2: [Second requirement]
**Acceptance Criteria:**
- [ ] [Testable condition 1]

[Continue for all requirements...]

## Success Metrics
- [Metric 1]: [How to measure]
- [Metric 2]: [How to measure]

## Scope

### In Scope
- [Feature/capability 1]
- [Feature/capability 2]

### Out of Scope
- [Feature NOT included 1] - [Why/when it might be added]
- [Feature NOT included 2]
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now explore the codebase and create the Product Development document.`;
}

/**
 * Build prompt for revising product development document based on feedback
 */
export function buildProductDevelopmentRevisionPrompt(
    issue: ProjectItemContent,
    existingDocument: string,
    feedbackComments: GitHubComment[]
): string {
    const feedbackSection = buildFeedbackSection(feedbackComments);

    return `You are revising a Product Development document based on admin feedback.

${READ_ONLY_MODE_INSTRUCTIONS}

${buildIssueDetailsHeader(issue, { descriptionLabel: 'Original Description' })}

## Existing Product Development Document

${existingDocument}

## Feedback History

${FEEDBACK_HISTORY_INSTRUCTIONS}

${feedbackSection}

## Your Task

1. Carefully read all feedback comments to understand the full context
2. **Look for the most recent "✅ Addressed Feedback" marker** - this shows where the last revision cycle ended
3. **Address ALL feedback comments that appear AFTER the marker** (there may be multiple comments covering different areas)
4. If no marker exists, this is the first revision - address all feedback comments
5. Research any areas mentioned in the feedback
6. Revise the Product Development document to address all the relevant feedback points
7. Keep the document focused on WHAT and WHY (not UI/UX or implementation)

**CRITICAL - PRODUCT DEVELOPMENT vs PRODUCT DESIGN:**

This is a PRODUCT DEVELOPMENT document. Do NOT include:
- UI mockups or interface descriptions
- Visual design decisions
- Technical implementation details

Focus ONLY on:
- Business requirements and objectives
- User needs and target audience
- Acceptance criteria
- Scope boundaries
- Success metrics

## Output Format

Provide your response as structured JSON with these fields:
- **document**: COMPLETE revised Product Development document in markdown format (entire document, not just changes)
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

Do NOT output just the changes - output the entire revised document. Keep it concise.

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's what I revised in the product development document:
1. [Feedback: acceptance criteria too vague] → Made each criterion testable with specific conditions
2. [Feedback: missing offline scenario] → Added R5 covering offline data sync requirements
3. Narrowed scope: moved "batch operations" to out-of-scope per admin feedback
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now revise the Product Development document based on the feedback.`;
}

/**
 * Build prompt for continuing product development after clarification
 */
export function buildProductDevelopmentClarificationPrompt(
    content: { title: string; number: number; body: string; labels?: string[] },
    issueComments: Array<{ body: string; author: string; createdAt: string }>,
    clarification: { body: string; author: string; createdAt: string }
): string {
    const commentsSection = issueComments.length > 0
        ? `\n## All Issue Comments\n\n${formatCommentsList(issueComments)}\n`
        : '';

    return `You previously asked for clarification while working on the product development document for this feature.

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
Continue your product development work using the admin's clarification as guidance. Complete the product development document.

If the admin's response is still unclear or raises new ambiguities, you may ask another clarification question using the same format.

**CRITICAL - PRODUCT DEVELOPMENT Focus:**

This is a PRODUCT DEVELOPMENT document. Focus ONLY on:
- Business requirements and objectives
- User needs and target audience
- Acceptance criteria (testable conditions)
- Scope boundaries
- Success metrics

Do NOT include UI/UX design or technical implementation details.

**Required sections:**
1. **Size Estimate** - S/M/L/XL
2. **Problem Statement** - What problem does this solve?
3. **Target Users** - Who will use this?
4. **Requirements** - Clear, numbered list with acceptance criteria
5. **Success Metrics** - How will we measure success?
6. **Scope** - What's in scope and out of scope

## Output Format

Provide your response as structured JSON with these fields:
- **document**: Complete Product Development document in markdown format
- **comment**: High-level summary to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's the product development document (after clarification):
1. Admin clarified this is for internal admin users only - adjusted target users and requirements
2. Defined 3 core requirements with acceptance criteria focused on admin workflows
3. Success metric: reduce manual data entry time by 50%
4. Scoped out public-facing features per admin guidance
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now complete the Product Development document using the clarification provided.`;
}
