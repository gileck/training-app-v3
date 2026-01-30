/**
 * Product Development Prompts
 *
 * Prompts for the optional Product Development phase that transforms
 * vague feature ideas into concrete product specifications.
 * Focuses on WHAT to build and WHY (not UI/UX or implementation).
 */

import type { ProjectItemContent } from '@/server/project-management';
import type { GitHubComment } from '../types';
import { AMBIGUITY_INSTRUCTIONS, MARKDOWN_FORMATTING_INSTRUCTIONS } from './shared-instructions';

/**
 * Build prompt for generating a new product development document
 *
 * Product Development is an OPTIONAL phase that transforms vague feature ideas
 * into concrete product specifications. It focuses on WHAT to build and WHY,
 * NOT how it looks (that's Product Design) or how to implement (that's Tech Design).
 */
export function buildProductDevelopmentPrompt(issue: ProjectItemContent, comments?: GitHubComment[]): string {
    const commentsSection = comments && comments.length > 0
        ? `\n## Comments on Issue\n\nThe following comments have been added to the issue. Consider them as additional context:\n\n${comments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    return `You are creating a Product Development document for a GitHub issue. This is an OPTIONAL phase for vague feature ideas that need to be transformed into concrete product specifications.

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}
**Labels:** ${issue.labels?.join(', ') || 'None'}

**Description:**
${issue.body || 'No description provided'}
${commentsSection}
## Your Task

Create a Product Development document that transforms the vague feature idea into a concrete product specification. Your document should answer: **WHAT** are we building and **WHY**?

**CRITICAL - PRODUCT DEVELOPMENT vs PRODUCT DESIGN:**

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
- Success metrics

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
    const feedbackSection = feedbackComments
        .map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`)
        .join('\n\n---\n\n');

    return `You are revising a Product Development document based on admin feedback.

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}

**Original Description:**
${issue.body || 'No description provided'}

## Existing Product Development Document

${existingDocument}

## Admin Feedback

The admin has requested changes. Please address ALL of the following feedback:

${feedbackSection}

## Your Task

1. Carefully read and understand all feedback comments
2. Research any areas mentioned in the feedback
3. Revise the Product Development document to address ALL feedback points
4. Keep the document focused on WHAT and WHY (not UI/UX or implementation)

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
        ? `\n## All Issue Comments\n\n${issueComments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
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

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now complete the Product Development document using the clarification provided.`;
}
