/**
 * Prompt Templates for Agent Scripts
 *
 * Contains prompt templates for:
 * - Product Development (optional phase for vague feature ideas)
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
// PRODUCT DEVELOPMENT PROMPTS (OPTIONAL PHASE)
// ============================================================

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

// ============================================================
// PRODUCT DESIGN PROMPTS
// ============================================================

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
- **comment**: High-level design overview to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

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
1. **Size & Complexity** - Effort (S/M/L/XL) and complexity (Low/Medium/High)
2. **Overview** - Brief technical approach (1-2 sentences for small features)
3. **Files to Create/Modify** - List of files with brief description of changes

**Optional sections (include only when relevant):**
- **Data Model** - Only if new collections or schema changes needed
- **API Changes** - Only if new endpoints or modifications needed
- **State Management** - Only if non-trivial state handling needed
- **Implementation Notes** - Only for complex logic that needs explanation

## Multi-PR Workflow (for L/XL features ONLY)

**CRITICAL: For L or XL size features, you MUST split the implementation into phases.**

Each phase:
- Should be independently mergeable (can be deployed on its own)
- Should be size S or M (not L or XL)
- Should result in a single PR
- Should have clear dependencies (which phases must complete before this one)

If the feature is L or XL:
1. Split it into 2-5 implementation phases
2. Each phase should be a complete, testable unit of work
3. Order phases so earlier phases don't depend on later ones
4. Include the phases in your structured output

**IMPORTANT**: Only include phases for L/XL features. For S/M features, do NOT include phases - they will be implemented in a single PR.

## Research Strategy

Explore the codebase:
1. Read existing similar features to understand patterns
2. Check \`src/apis/\` for API patterns
3. Check \`src/server/database/collections/\` for database patterns
4. Look at \`src/client/routes/\` for component patterns

**Data availability check**: Before specifying UI that displays data, verify the schema/types have the required fields. If missing, note "requires schema change" or remove the feature from design.

## Output Format

Provide your response as structured JSON with these fields:
- **design**: Complete Technical Design document in markdown format (same structure as before)
- **phases** (L/XL features ONLY): Array of implementation phases (see schema below). Leave empty/null for S/M features.
- **comment**: High-level implementation plan to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

**Phase schema (for L/XL features only):**
\`\`\`json
{
  "order": 1,                    // Phase number (1, 2, 3, etc.)
  "name": "Database Schema",     // Short phase name
  "description": "...",          // What this phase implements
  "files": ["src/...", "docs/...", ".ai/skills/..."],  // Source files to modify + relevant docs
  "estimatedSize": "S"           // S or M (never L/XL for a single phase)
}
\`\`\`

**IMPORTANT - Files Array Content:**
The \`files\` array should include BOTH:
1. **Source files to create/modify** - The actual implementation files (e.g., \`src/apis/...\`, \`src/client/...\`)
2. **Relevant documentation** - Docs the implementor should read before implementing this phase:
   - \`docs/\` files for detailed patterns (e.g., \`docs/mongodb-usage.md\`, \`docs/theming.md\`)
   - \`.ai/skills/\` files for coding guidelines (e.g., \`.ai/skills/state-management-guidelines/SKILL.md\`)

Select docs based on what the phase touches:
- Database work → \`docs/mongodb-usage.md\`, \`.ai/skills/mongodb-usage/SKILL.md\`
- API endpoints → \`docs/api-endpoint-format.md\`, \`.ai/skills/client-server-communications/SKILL.md\`
- UI components → \`docs/theming.md\`, \`.ai/skills/react-component-organization/SKILL.md\`, \`.ai/skills/shadcn-usage/SKILL.md\`
- State management → \`docs/state-management.md\`, \`.ai/skills/state-management-guidelines/SKILL.md\`
- Authentication → \`docs/authentication.md\`, \`.ai/skills/user-access/SKILL.md\`
- Offline/PWA → \`docs/offline-pwa-support.md\`, \`docs/react-query-mutations.md\`

Keep the design concise. A small feature might only need a short list of files. A large feature needs more detail.

## Implementation Plan Section (REQUIRED)

Your technical design MUST include a "## Implementation Plan" section with high-level, actionable steps.

**For S/M features (single-phase):**
- Provide a single numbered list of implementation steps
- Each step should be a clear, actionable task
- Include file paths and what to do with them
- Order steps so each builds on the previous

**For L/XL features (multi-phase):**
- Organize steps by phase
- Each phase should have its own numbered list
- Steps within a phase should be self-contained

**Step guidelines:**
- Keep steps high-level (not line-by-line detailed)
- Each step should be actionable: "Create X", "Add Y to Z", "Update W"
- Include relevant file paths
- Order steps logically (dependencies first)

Example Implementation Plan for S/M feature:
\`\`\`markdown
## Implementation Plan

1. Create auth types file at \`src/apis/auth/types.ts\`
2. Create login handler at \`src/apis/auth/handlers/login.ts\`
3. Add API route at \`src/pages/api/process/auth_login.ts\`
4. Create useLogin hook in \`src/client/features/auth/hooks.ts\`
5. Update auth feature exports in \`src/client/features/auth/index.ts\`
6. Run yarn checks to verify
\`\`\`

Example Implementation Plan for L/XL feature:
\`\`\`markdown
## Implementation Plan

### Phase 1: Database Schema
1. Create users collection at \`src/server/database/collections/users.ts\`
2. Add indexes for email field
3. Export types from collection file

### Phase 2: API Endpoints
1. Create auth types at \`src/apis/auth/types.ts\`
2. Create login handler at \`src/apis/auth/handlers/login.ts\`
3. Create register handler at \`src/apis/auth/handlers/register.ts\`
4. Add API routes in \`src/pages/api/process/\`

### Phase 3: UI Components
1. Create LoginForm component at \`src/client/features/auth/LoginForm.tsx\`
2. Create auth store at \`src/client/features/auth/store.ts\`
3. Add route in \`src/client/routes/index.ts\`
\`\`\`

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

## Implementation Plan

1. Create useLogout hook in \`src/client/features/auth/hooks.ts\`
2. Export hook from \`src/client/features/auth/index.ts\`
3. Add logout menu item to UserMenu.tsx with onClick calling useLogout
4. Run yarn checks to verify
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

## Implementation Plan

1. Create types file at \`src/apis/feature-name/types.ts\`
2. Create handler at \`src/apis/feature-name/handlers/create.ts\`
3. Add API route at \`src/pages/api/process/feature-name_create.ts\`
4. Create main component at \`src/client/routes/FeatureName/index.tsx\`
5. Add route in \`src/client/routes/index.ts\`
6. Run yarn checks to verify
\`\`\`

Example for a LARGE feature (L/XL) with phases:

\`\`\`markdown
# Technical Design: User Authentication System

**Size: L** | **Complexity: High**

## Overview
Implement complete user authentication with login, signup, password reset, and session management.

## Implementation Phases

This feature will be split into 3 PRs:

### Phase 1: Database & Models (S)
- User collection schema
- Session management
- Files: src/server/database/collections/users.ts, src/server/database/collections/sessions.ts

### Phase 2: API Endpoints (M)
- Login, logout, register endpoints
- JWT token handling
- Files: src/apis/auth/*, src/pages/api/process/auth_*.ts

### Phase 3: UI Components (M)
- Login form, register form
- Protected route wrapper
- Files: src/client/features/auth/*

## Files to Create
[List all files across all phases]

## Files to Modify
[List all modifications across all phases]

## Implementation Plan

### Phase 1: Database & Models
1. Create users collection at \`src/server/database/collections/users.ts\`
2. Add User interface with email, passwordHash, createdAt fields
3. Create sessions collection at \`src/server/database/collections/sessions.ts\`
4. Add indexes for email and session token
5. Export types from collection files

### Phase 2: API Endpoints
1. Create auth types at \`src/apis/auth/types.ts\`
2. Create login handler at \`src/apis/auth/handlers/login.ts\`
3. Create register handler at \`src/apis/auth/handlers/register.ts\`
4. Create logout handler at \`src/apis/auth/handlers/logout.ts\`
5. Add API routes in \`src/pages/api/process/\`
6. Test endpoints with curl or API client

### Phase 3: UI Components
1. Create auth store at \`src/client/features/auth/store.ts\`
2. Create LoginForm component at \`src/client/features/auth/LoginForm.tsx\`
3. Create RegisterForm component at \`src/client/features/auth/RegisterForm.tsx\`
4. Create ProtectedRoute wrapper at \`src/client/features/auth/ProtectedRoute.tsx\`
5. Add routes in \`src/client/routes/index.ts\`
6. Wire up forms to auth APIs
\`\`\`

**phases JSON output for L/XL example:**
\`\`\`json
[
  {
    "order": 1,
    "name": "Database & Models",
    "description": "User collection schema and session management",
    "files": [
      "src/server/database/collections/users.ts",
      "src/server/database/collections/sessions.ts",
      "docs/mongodb-usage.md",
      ".ai/skills/mongodb-usage/SKILL.md"
    ],
    "estimatedSize": "S"
  },
  {
    "order": 2,
    "name": "API Endpoints",
    "description": "Login, logout, register endpoints with JWT handling",
    "files": [
      "src/apis/auth/types.ts",
      "src/apis/auth/handlers/login.ts",
      "docs/api-endpoint-format.md",
      ".ai/skills/client-server-communications/SKILL.md"
    ],
    "estimatedSize": "M"
  },
  {
    "order": 3,
    "name": "UI Components",
    "description": "Login form, register form, protected route wrapper",
    "files": [
      "src/client/features/auth/components/LoginForm.tsx",
      "docs/theming.md",
      ".ai/skills/react-component-organization/SKILL.md",
      ".ai/skills/shadcn-usage/SKILL.md"
    ],
    "estimatedSize": "M"
  }
]
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
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

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
- **comment**: High-level implementation plan to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

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

## Understanding Phase Files (Multi-Phase Features)

If this is a multi-phase feature, the phase's \`files\` list contains TWO types of files:
1. **Source files to create/modify** - Files in \`src/\` that you will implement
2. **Relevant documentation** - Files in \`docs/\` and \`.ai/skills/\` that you should READ FIRST

**CRITICAL**: Before implementing, identify and READ all documentation files from the phase's file list. These were specifically selected by the tech design as relevant to this phase's implementation.

## Implementation Guidelines

**CRITICAL**: Before implementing, read the project guidelines in \`.ai/skills/\`:
- \`.ai/skills/typescript-guidelines/SKILL.md\` - TypeScript coding standards
- \`.ai/skills/react-component-organization/SKILL.md\` - Component structure and patterns
- \`.ai/skills/react-hook-organization/SKILL.md\` - Custom hook patterns
- \`.ai/skills/state-management-guidelines/SKILL.md\` - Zustand and React Query usage
- \`.ai/skills/feature-based-structure/SKILL.md\` - File organization by feature
- \`.ai/skills/ui-design-guidelines/SKILL.md\` - UI/UX patterns
- \`.ai/skills/shadcn-usage/SKILL.md\` - shadcn/ui component usage
- \`.ai/skills/theming-guidelines/SKILL.md\` - **CRITICAL** Theming and color usage
- \`.ai/skills/client-server-communications/SKILL.md\` - API patterns
- \`.ai/skills/mongodb-usage/SKILL.md\` - Database operations (if applicable)
- \`.ai/skills/app-guidelines-checklist/SKILL.md\` - Comprehensive checklist

**THEMING (Read \`docs/theming.md\` and \`.ai/skills/theming-guidelines/SKILL.md\` before styling)**:
- **NEVER** use hardcoded colors like \`bg-white\`, \`text-black\`, \`bg-blue-500\`, or hex values
- **ALWAYS** use semantic tokens: \`bg-background\`, \`bg-card\`, \`text-foreground\`, \`text-muted-foreground\`, \`bg-primary\`, etc.
- For status colors use: \`text-success\`, \`text-warning\`, \`text-destructive\`, \`text-info\`
- **Exceptions**:
  - Dialog overlays may use \`bg-black/60\` for backdrop opacity
  - Hardcoded colors ONLY if specifically requested in the task requirements (e.g., brand colors from product team). In this case, add a code comment: \`// Hardcoded per task requirement: "[quote the specific requirement]"\`

Key principles:
- Follow the existing code patterns in the codebase
- Use TypeScript with proper types
- Follow the project's ESLint rules
- Keep components small and focused
- Use existing UI components from shadcn/ui
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
- **comment**: High-level summary of what you did to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

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
- **Focus**: Project-specific guidelines compliance from \`.ai/skills/\`
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

### When Reviewer Feedback Conflicts with Project Rules

**Project docs and rules are the source of truth.** Claude reviewers may not be fully aware of all project-specific patterns documented in \`docs/\` and \`.ai/skills/\`.

If a reviewer suggests a change that **contradicts** project documentation:
1. **Follow the project docs/rules** - they take precedence
2. **Do NOT implement the conflicting suggestion**
3. **Explain in your summary comment** why you did not address that point, citing the specific doc/rule

Example:
\`\`\`
3. [Claude suggested moving toasts out of onSuccess] → **Not implemented** - per \`docs/react-query-mutations.md\`, toasts in onSuccess are explicitly allowed as "ephemeral UI feedback"
\`\`\`

The reviewer will see your explanation and understand the project convention in the next review cycle.

## Your Task

1. Carefully read ALL feedback comments
2. Address each piece of feedback
3. Make the necessary code changes
4. Ensure changes don't break existing functionality

## Guidelines

**Follow project guidelines in \`.ai/skills/\`** (same as initial implementation)

**THEMING (Read \`docs/theming.md\` and \`.ai/skills/theming-guidelines/SKILL.md\` if fixing styling issues)**:
- **NEVER** use hardcoded colors like \`bg-white\`, \`text-black\`, \`bg-blue-500\`, or hex values
- **ALWAYS** use semantic tokens: \`bg-background\`, \`bg-card\`, \`text-foreground\`, \`text-muted-foreground\`, \`bg-primary\`, etc.
- For status colors use: \`text-success\`, \`text-warning\`, \`text-destructive\`, \`text-info\`
- **Exceptions**:
  - Dialog overlays may use \`bg-black/60\` for backdrop opacity
  - Hardcoded colors ONLY if specifically requested in the task requirements (e.g., brand colors from product team). In this case, add a code comment: \`// Hardcoded per task requirement: "[quote the specific requirement]"\`

Key principles:
- Address ALL feedback points
- Keep changes focused on the feedback
- Don't add extra features or refactoring
- Test your changes make sense in context
- Follow TypeScript, React, and state management patterns from \`.ai/skills/\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

## Output

After making changes, provide your response as structured JSON with these fields:
- **prSummary**: Updated PR summary in markdown format with "## Summary" and "## Changes" sections
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

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
- **comment**: High-level summary of what you did to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

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

    return `You are analyzing a BUG REPORT and creating a Technical Design document that will guide the implementation agent to fix this bug.${productDesign ? ' A Product Design has been approved that addresses the UX/UI aspects of this bug.' : ''}

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

---

## CRITICAL: Bug Fix Design Process

For bug fixes, you MUST follow these steps IN ORDER. Do not skip steps.

### Step 1: INVESTIGATE - Find the Root Cause (Required - Cannot Skip)

Before designing ANY fix, you MUST:
1. **Trace the exact failure path** - Use stack trace, logs, and code inspection
2. **Identify what input/state triggers the bug** - What condition causes the failure?
3. **Find the actual root cause** - The specific code that behaves incorrectly

**What counts as "root cause" (be this specific):**
- "The handler expects \`parts[1]\` to be a valid integer, but whitespace in the callback data causes \`parseInt\` to return \`NaN\`"
- "The validation \`!val\` incorrectly rejects \`0\` as invalid when \`0\` is a legitimate value"
- "The comparison uses \`message.text\` (plain text) against an HTML-formatted string, so it never matches"

**What is NOT root cause (these are symptoms or secondary concerns):**
- "Unknown action error appears" ← This is the SYMPTOM, not the cause
- "Error handling is missing" ← This is observability improvement, not root cause
- "Logging should be added" ← This helps debugging but doesn't explain WHY the bug occurs

### Step 2: SCOPE - Check for Similar Patterns (Required)

After identifying the root cause, you MUST check if the same pattern exists elsewhere:
1. **Search for similar code** - Use Grep to find similar patterns in the codebase
2. **List ALL affected locations** - A partial fix that only fixes 2 of 13 similar handlers is incomplete
3. **Note the scope** - "This bug affects N locations that all need the same fix"

**Example**: If a bug is in the \`design_approve\` handler's parsing logic, check ALL handlers in that file for the same parsing pattern. If 13 handlers have the same vulnerable code, ALL 13 must be fixed.

### Step 3: DESIGN - Plan the Fix (Only after Steps 1-2)

Now design the fix:
1. **Primary: Fix the root cause** - The main goal
2. **Primary: Fix ALL similar patterns** - If found in Step 2
3. **Secondary: Improve error handling** - Helps future debugging, but is NOT the primary fix

**Important distinction:**
- Adding logging/error messages is valuable for OBSERVABILITY but does not FIX the bug
- The implementation agent needs to know WHAT CODE TO CHANGE to make the bug stop happening
- "Add better error logging" is a secondary improvement, not the fix

---

## Required Output Sections

Your Technical Design document MUST include:

1. **Root Cause Analysis** (from Step 1)
   - What exact code path fails?
   - What input/condition triggers it?
   - Why does the current code not handle it correctly?

2. **Scope Assessment** (from Step 2)
   - How many similar patterns exist? List them.
   - Which files/locations need the same fix?

3. **Fix Approach** (from Step 3)
   - Specific code changes to fix the root cause
   - Changes to ALL affected locations (not just the one mentioned in the bug report)

4. **Files to Modify**
   - Complete list with specific changes for each file

**Optional sections (include when relevant):**
- **Testing Strategy** - How to verify the fix
- **Risk Assessment** - Side effects or edge cases
- **Secondary Improvements** - Error handling/logging improvements (clearly marked as secondary)

---

## Output Format

Provide your response as structured JSON with these fields:
- **design**: Complete Technical Design document in markdown format (structure shown below)
- **comment**: High-level summary for GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

**Example design structure:**

\`\`\`markdown
# Bug Fix: [Issue Title]

## Root Cause Analysis

**The Bug:** [One sentence describing what goes wrong]

**Root Cause:** The error occurs in \`telegram-webhook.ts\` at line 1650 when parsing callback data. The code uses:
\`\`\`typescript
const issueNumber = parseInt(parts[1], 10);
\`\`\`
This fails when \`parts[1]\` contains whitespace (e.g., " 123") because \`parseInt\` returns \`NaN\`, causing the validation \`!issueNumber\` to incorrectly reject valid data.

**Trigger Condition:** Callback data with leading/trailing whitespace in numeric fields.

## Scope Assessment

**Similar patterns found:** 13 handlers in \`telegram-webhook.ts\` use the same parsing pattern:
- \`design_approve\` (line 1650)
- \`design_changes\` (line 1680)
- \`merge\` (line 1594) ← Mentioned in bug report
- \`approve_request\` (line 1432)
- ... [list all 13]

**All 13 handlers need the same fix applied.**

## Fix Approach

### Primary Fix (Root Cause)
1. Add \`.trim()\` to all parsed values: \`parseInt(parts[1]?.trim() || '', 10)\`
2. Add explicit \`isNaN()\` check: \`if (isNaN(issueNumber) || isNaN(prNumber))\`
3. Apply to ALL 13 handlers, not just the one mentioned

### Secondary Improvements (Observability)
4. Add error logging when validation fails (helps future debugging)
5. Improve error message shown to user

## Files to Modify

| File | Changes |
|------|---------|
| \`src/pages/api/telegram-webhook.ts\` | Update ALL 13 handlers with defensive parsing (.trim(), isNaN check) |

## Testing Strategy

1. Test with callback data containing whitespace
2. Test with callback data containing invalid numbers
3. Verify all 13 handlers reject malformed data gracefully

## Implementation Plan

1. Open \`src/pages/api/telegram-webhook.ts\`
2. Find all 13 handlers that use parseInt for callback parsing
3. Update each handler to use \`.trim()\` on parsed values
4. Add \`isNaN()\` check after parseInt in each handler
5. Add error logging for debugging when validation fails
6. Run yarn checks to verify no type errors
7. Test the affected handlers manually
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now explore the codebase, find the root cause, check for similar patterns, and create the Technical Design for this bug fix.`;
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

---

## REMINDER: Bug Fix Design Principles

When revising, ensure your design still follows these principles:

1. **Root Cause is Identified** - The design must explain WHAT specific code causes the bug and WHY
   - "The bug occurs because X" not just "add error handling"

2. **Scope is Complete** - If similar patterns exist, ALL must be listed for fixing
   - If feedback says "you only fixed 2 of 13 handlers", find and list ALL 13

3. **Fix vs Observability** - The primary fix addresses the root cause; logging/error handling is secondary
   - Primary: "Add .trim() to prevent whitespace parsing issues"
   - Secondary: "Add error logging for debugging"

---

## Your Task

1. Carefully read and understand all feedback comments
2. If feedback indicates incomplete root cause analysis → Re-investigate the code
3. If feedback indicates incomplete scope → Use Grep to find ALL similar patterns
4. Revise the Technical Design to address ALL feedback points
5. Ensure the revised design follows the bug fix principles above

## Output Format

Provide your response as structured JSON with these fields:
- **design**: COMPLETE revised Technical Design document in markdown format (entire document, not just changes)
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

Do NOT output just the changes in design - output the entire revised document.

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now revise the Bug Fix Technical Design based on the feedback.`;
}
