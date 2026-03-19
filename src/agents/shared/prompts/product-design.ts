/**
 * Product Design Prompts
 *
 * Prompts for the Product Design phase that defines HOW the feature
 * will look and feel from a user perspective (UI/UX).
 */

import type { ProjectItemContent } from '@/server/template/project-management';
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
 * Build the design mock options instructions block.
 * Shared between new design and clarification prompts.
 */
function buildMockInstructions(issueNumber: number): string {
    return `## Design Mock Options

In addition to the written design document, create **2-3 design mock options** as interactive React pages. Each option represents a different UI/UX approach to the feature.

**IMPORTANT — Write mock files directly:**
You have write access. You MUST write each mock option as a React component file BEFORE producing structured output. The files will be deployed to a Vercel preview URL for the admin to review.

**File structure:**
- Each option component: \`src/pages/design-mocks/components/issue-${issueNumber}-{optId}.tsx\` (e.g., \`issue-${issueNumber}-optA.tsx\`)
- Main page with tabs: \`src/pages/design-mocks/issue-${issueNumber}.tsx\`

**Requirements for mock components:**
- Each option must be a self-contained React function component (default export)
- Use ONLY shadcn/ui components imported from \`@/client/components/template/ui/\` — available components: Button, Card, Input, Label, Badge, Avatar, Select, Switch, Textarea, Dialog, Sheet, Separator, Skeleton, DropdownMenu, RadioGroup, Alert, Collapsible, Calendar
- Use semantic theme tokens for all colors (\`bg-background\`, \`text-foreground\`, \`bg-muted\`, \`text-muted-foreground\`, \`bg-primary\`, \`text-primary-foreground\`, \`border\`, etc.) — NEVER hardcode colors
- Design mobile-first for ~400px viewport (use \`max-w-md mx-auto\`)
- Include realistic content appropriate to the feature (not lorem ipsum)
- Keep each component focused — one clear design approach per option
- Import React hooks (useState, etc.) from 'react' as needed

**Props — viewState and colorMode:**
The mock preview shell passes two props to the main page component. You MUST accept and forward these to each option component:
- \`viewState\`: \`'populated' | 'empty' | 'loading'\` — controls which state to render
  - \`'populated'\`: Show the component with realistic sample data (DEFAULT)
  - \`'empty'\`: Show the empty state (no items, no data, blank slate with helpful message/action)
  - \`'loading'\`: Show the loading/skeleton state
- \`colorMode\`: \`'light' | 'dark'\` — the current color mode (the shell wraps your component in a \`dark\` CSS class container, so semantic tokens like \`bg-background\` automatically adapt — you don't need to handle this manually, just make sure you use semantic tokens and NOT hardcoded colors)

Each option component signature should be:
\`\`\`tsx
export default function OptionA({ viewState = 'populated' }: { viewState?: 'populated' | 'empty' | 'loading' }) {
  if (viewState === 'loading') return <LoadingSkeleton />;
  if (viewState === 'empty') return <EmptyState />;
  return <PopulatedView />;
}
\`\`\`

The main page component must accept and forward these props:
\`\`\`tsx
export default function MockPage({ viewState, colorMode }: { viewState?: string; colorMode?: string }) {
  // ... forward viewState to each option component
  <OptionA viewState={viewState as 'populated' | 'empty' | 'loading'} />
}
\`\`\`

**Main page structure (\`src/pages/design-mocks/issue-${issueNumber}.tsx\`):**
- Import each option component using React.lazy and dynamic import
- Render tabs (Option A / Option B / etc.) with useState for tab switching
- Each option rendered inside a mobile-width container (\`max-w-md mx-auto\`)
- Wrap lazy components in React.Suspense with a loading fallback
- Accept \`viewState\` and \`colorMode\` props, forward \`viewState\` to option components

**After writing mock files, verify they compile:**
- Run \`npx tsc --noEmit src/pages/design-mocks/issue-${issueNumber}.tsx\` to check for TypeScript errors
- Fix any compilation errors before proceeding

**Each option should differ meaningfully** — for example:
- Option A: Minimalist approach with fewer elements
- Option B: Feature-rich approach with more detail
- Option C: Alternative layout or interaction pattern

**IMPORTANT:** Only write files to \`src/pages/design-mocks/\`. Do NOT modify any other files in the project.
**IMPORTANT:** Write all mock files BEFORE producing the structured JSON output.`;
}

/** Phase 1 output format: mocks only (no design doc) */
const MOCK_OUTPUT_FORMAT = `Provide your response as structured JSON with these fields:
- **comment**: High-level summary of the mock options to post as GitHub comment (3-5 bullet points describing key differences between options). Use markdown numbered list with each item on a NEW LINE
- **mockOptions**: Array of 2-3 design mock option metadata, each with: id, title, description, isRecommended (the actual component code is written to files, not included here)

**IMPORTANT:** Do NOT include a "design" field. This phase produces mocks only — the full design document will be written after admin selects an option.`;

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
    comments?: GitHubComment[],
    options?: { allowWrite?: boolean }
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

    const modeInstruction = options?.allowWrite
        ? 'IMPORTANT: You are in WRITE mode. You MUST write design mock page files to src/pages/design-mocks/ using the Write tool. You also have access to Read, Glob, Grep, WebFetch, Edit, and Bash tools.'
        : READ_ONLY_MODE_INSTRUCTIONS;

    return `You are creating design mock options for a GitHub issue.${productDevelopmentDoc ? ' The Product Development document has been approved, defining WHAT to build. Now you need to explore different UI/UX approaches.' : ''} Your task is to:
1. Understand the feature from the issue description
2. Explore the codebase to understand existing patterns and architecture
3. Create 2-3 design mock options as interactive React pages${options?.allowWrite ? '\n4. Write design mock page files to src/pages/design-mocks/' : ''}

**IMPORTANT:** This is Phase 1 — you are creating visual mock options ONLY. Do NOT write a full design document. The admin will review the mocks and pick one. A full design document will be written in Phase 2 based on the chosen option.

${modeInstruction}

${buildIssueDetailsHeader(issue, { includeLabels: true })}
${commentsSection}${pddSection}
## Your Task

Create 2-3 design mock options that show different UI/UX approaches for this feature. Each option should be meaningfully different. Focus on the visual and interaction design — the admin will pick the best approach.${productDevelopmentDoc ? '\n\n**Important:** The Product Development Document above defines the requirements and acceptance criteria. Your mock options should explore different ways to address those requirements from a UI/UX perspective.' : ''}

${PRODUCT_DESIGN_ONLY_WARNING}

${MOBILE_FIRST_INSTRUCTIONS}

## Research Strategy

Before creating the mocks, explore the codebase:
1. Read \`src/client/routes/index.ts\` to understand the routing structure
2. If a page is mentioned, find and read that component
3. Look at similar existing features for patterns
4. Check relevant types in \`src/apis/\` if the feature needs API work

${buildMockInstructions(issue.number ?? 0)}

## Output Format

${MOCK_OUTPUT_FORMAT}

## Output Format Example

**GOOD comment example:**
\`\`\`
Here are the design mock options:
1. Option A: Minimalist card layout — focuses on simplicity with a clean single-column view
2. Option B: Feature-rich dashboard — includes filters, sorting, and inline editing
3. Option C: Conversational UI — step-by-step guided flow with progressive disclosure
4. Recommended: Option A for its simplicity and mobile-first approach
\`\`\`

**BAD comment example (too generic, avoid this):**
\`\`\`
Here are 3 options:
1. Option A
2. Option B
3. Option C
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now explore the codebase and create the design mock options.`;
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
    clarification: { body: string; author: string; createdAt: string },
    options?: { allowWrite?: boolean }
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
Continue your product design work using the admin's clarification as guidance. Complete the product design document${options?.allowWrite ? ' and write design mock page files to src/pages/design-mocks/' : ''}.

${options?.allowWrite ? 'IMPORTANT: You are in WRITE mode. You MUST write design mock page files to src/pages/design-mocks/ using the Write tool before producing structured output. You also have access to Read, Glob, Grep, WebFetch, Edit, and Bash tools.' : ''}

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

${options?.allowWrite ? buildMockInstructions(content.number) : ''}

## Output Format

${options?.allowWrite ? MOCK_OUTPUT_FORMAT : `Provide your response as structured JSON with these fields:
- **design**: Complete Product Design document in markdown format
- **comment**: High-level design overview to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE`}

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

/**
 * Build prompt for Phase 2: writing a full design document for the chosen mock option
 *
 * @param issue - The GitHub issue content
 * @param chosenOption - The admin-selected mock option (title + description)
 * @param mockSource - The React source code of the chosen mock component (if available)
 * @param comments - Issue comments for context
 */
export function buildProductDesignPostSelectionPrompt(
    issue: ProjectItemContent,
    chosenOption: { title: string; description: string },
    mockSource: string | null,
    comments?: GitHubComment[],
): string {
    const commentsSection = buildCommentsSection(comments);

    const mockSourceSection = mockSource
        ? `\n## Chosen Mock Source Code

The following is the React component source code for the chosen mock option:

\`\`\`tsx
${mockSource}
\`\`\`

Use this implementation as the reference for your design document. The design should describe and formalize what this mock demonstrates.

---
`
        : '';

    return `You are writing a Product Design document for a GitHub issue based on an admin-selected design mock option.

${READ_ONLY_MODE_INSTRUCTIONS}

${buildIssueDetailsHeader(issue, { includeLabels: true })}
${commentsSection}
## Admin's Chosen Design Option

**Option:** ${chosenOption.title}

**Description:** ${chosenOption.description}
${mockSourceSection}
## Your Task

Write a complete Product Design document that formalizes the chosen mock option into a full design specification. The mock shows the visual approach — your document should describe the full user experience, interactions, states, and edge cases.

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
- **design**: Complete Product Design document in markdown format for the chosen mock option
- **comment**: High-level design overview to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

**IMPORTANT:** Do NOT create new mocks or mockOptions. This phase produces a design document only.

## Output Format Example

**GOOD comment example:**
\`\`\`
Here's the product design based on the chosen "${chosenOption.title}" option:
1. Formalized the minimalist card layout with mobile-first responsive design
2. Defined loading, empty, and error states for all data-dependent views
3. Added user flow: browse → select → confirm with inline editing support
4. Size estimate: M - new route with card grid, filtering, and CRUD operations
\`\`\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now write the Product Design document for the chosen mock option.`;
}
