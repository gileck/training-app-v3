/**
 * Implementation Prompts
 *
 * Prompts for the Implementation phase that actually writes code
 * based on approved design documents.
 */

import type { ProjectItemContent } from '@/server/template/project-management';
import type { GitHubComment } from '../types';
import {
    AMBIGUITY_INSTRUCTIONS,
    MARKDOWN_FORMATTING_INSTRUCTIONS,
    WRITE_MODE_INSTRUCTIONS,
    WRITE_MODE_PR_REVISION_INSTRUCTIONS,
    IMPLEMENTATION_GUIDELINES,
    THEMING_INSTRUCTIONS,
    buildCommentsSection,
    buildIssueDetailsHeader,
    formatCommentsList,
} from './shared-instructions';

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

    const commentsSection = buildCommentsSection(comments);

    return `You are implementing a feature${techDesign || productDesign ? ' based on approved design documents' : ''}.

${WRITE_MODE_INSTRUCTIONS}

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
2. **Relevant documentation** - Files in \`docs/\` that you should READ FIRST

**CRITICAL**: Before implementing, identify and READ all documentation files from the phase's file list. These were specifically selected by the tech design as relevant to this phase's implementation.

## When to Stop vs Proceed (Decision Guide)

When implementing, you may encounter situations where you're unsure whether to proceed or ask for clarification.

**PROCEED WITHOUT ASKING when:**
- The tech design is clear and specific about what to do
- You're following existing codebase patterns (use them as a template)
- The decision is purely technical with no user-visible impact (e.g., naming a variable)
- Multiple valid approaches exist but all achieve the same outcome
- The answer can be determined by reading the codebase

**STOP AND ASK FOR CLARIFICATION when:**
- Requirements are ambiguous or contradict each other
- The tech design mentions features/APIs that don't exist
- You're unsure which of several approaches the admin prefers (when they have different UX/behavior)
- You discover the scope is larger than expected (design missed something significant)
- You find a bug in existing code that's unrelated to this task

**Decision Examples:**
- "Add a button" but design doesn't specify text/icon → **Proceed** - use existing button patterns in codebase
- Design says "use UserService" but no UserService exists → **Stop** - ask if it should be created or use different approach
- Two valid state management approaches → **Proceed** - follow project guidelines (server=RQ, client=Zustand)
- Feature needs data that doesn't exist in the schema → **Stop** - ask about schema changes (impacts other features)
- Existing code uses deprecated pattern → **Proceed** - follow new patterns, don't fix existing code
- Task requires modifying shared component used elsewhere → **Stop** - ask about scope (might affect other features)

${IMPLEMENTATION_GUIDELINES}

**CRITICAL - MOBILE-FIRST:**
This is a mobile-first application. ALL UI must be implemented for mobile (~400px CSS width) FIRST:
- Write base styles for mobile, then add \`sm:\`, \`md:\`, \`lg:\` modifiers for larger screens
- Ensure all touch targets are at least 44px
- Test that UI works at 400px viewport width before adding responsive enhancements

## Visual Verification (REQUIRED for UI Changes)

**CRITICAL**: If this PR includes ANY UI changes (new components, styling changes, layout modifications), you MUST visually verify the implementation before completing the task.

**What counts as a "UI change" (MUST verify):**
- Any modification to JSX/TSX render output (new elements, changed structure, conditional rendering changes)
- CSS or Tailwind class changes (including adding, removing, or modifying classes)
- Component prop changes that affect appearance (e.g., variant, size, className, disabled)
- New components or pages with visual output
- Layout changes (flex direction, grid, spacing, padding, margin)
- Adding new fields to existing forms or lists
- Changing sort order, filtering, or display logic that affects what users see

**What is NOT a UI change (skip verification):**
- Pure backend/API handler changes with no render impact
- Type-only changes (interfaces, type definitions)
- Utility functions, helpers, or constants with no JSX
- Test files
- Configuration files (ESLint, Next.js config, etc.)
- Database collection files or server-only code

**How to verify:**
1. Use Playwright MCP (browser automation) to open the app at http://localhost:3000
2. Navigate to the relevant page/component
3. Resize browser to 400px width (mobile viewport)
4. Take a screenshot to verify:
   - Layout looks correct on mobile
   - Touch targets are at least 44px
   - No content overflow or horizontal scrolling
   - Dark mode works if applicable (use \`prefers-color-scheme\` or toggle theme)
   - Text is readable, spacing is appropriate

**If Playwright MCP is unavailable:**
- Set \`visualVerification.verified = false\`
- Set \`visualVerification.skippedReason = "Playwright MCP not available"\`
- The PR reviewer will need to manually verify visuals

**If no UI changes:**
- Omit the \`visualVerification\` field entirely from your output

**Report in output:**
Include the \`visualVerification\` object in your JSON output with:
- \`verified\`: true/false - whether verification was performed
- \`whatWasVerified\`: describe what you checked (e.g., "400px viewport, dark mode, touch targets")
- \`skippedReason\`: if skipped, explain why
- \`issuesFound\`: any issues found and fixed during verification

${THEMING_INSTRUCTIONS}

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
- **visualVerification** (only for UI changes): Object describing visual verification status

### QUALITY REQUIREMENTS FOR OUTPUT

Your prSummary and comment are what the admin and reviewers see - make them informative, not generic.

**GOOD prSummary example:**
\`\`\`markdown
## Summary
- Added todo filtering with priority/status/search filters stored in Zustand for persistence across sessions
- Implemented collapsible filter panel (collapsed by default on mobile to save vertical space)
- Used existing FilterChip pattern from ProfilePage for visual consistency
- Memoized filtered results to avoid recalculating on every render

## Changes
- **store.ts**: Added filterState with sort, filter, and search preferences
- **TodoFilters.tsx**: New component with collapsible filter UI using Accordion
- **Todos.tsx**: Integrated filters, added useMemo for filtered list
- **types.ts**: Added FilterState and SortOption types
\`\`\`

**BAD prSummary example (too generic, avoid this):**
\`\`\`markdown
## Summary
- Implemented the feature as described in the issue

## Changes
- Updated files to add the feature
\`\`\`

**GOOD comment example:**
\`\`\`
Here's what I implemented:
1. Created TodoFilters component with search input, priority dropdown, and status checkboxes
2. Added Zustand store for filter persistence (filters survive page refresh)
3. Integrated filters into Todos route with memoized filtering logic
4. Used mobile-first approach: filters collapse into accordion on small screens
\`\`\`

**BAD comment example (too generic, avoid this):**
\`\`\`
Here's what I implemented:
1. Added the feature
2. Updated the files
3. Made the changes work
\`\`\`

**Key principles for quality output:**
- Explain WHY decisions were made, not just WHAT was done
- Mention specific patterns used (Zustand, React Query, existing components)
- Note any trade-offs or design choices
- Reference specific file names and component names

Example visualVerification (for UI changes):
\`\`\`json
{
  "verified": true,
  "whatWasVerified": "Tested at 400px viewport width, verified touch targets are 44px, checked dark mode compatibility",
  "issuesFound": "Fixed checkbox spacing that was too tight on mobile"
}
\`\`\`

Example visualVerification (when skipped):
\`\`\`json
{
  "verified": false,
  "skippedReason": "Playwright MCP not available - manual verification needed"
}
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

${WRITE_MODE_PR_REVISION_INSTRUCTIONS}

${buildIssueDetailsHeader(issue, { includeDescription: false })}

${contextSection}

## Review Feedback

### Issue Comments
${issueComments || 'No issue comments'}

### PR Review Comments
${reviewComments || 'No PR review comments'}

## Understanding Your Reviewers

You have received feedback from two different reviewers with distinct roles:

**1. PR Review Agent** (author: "Agent (PR Review)")
- **Focus**: Project-specific guidelines compliance from \`docs/template/project-guidelines/\`
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

**Project docs and rules are the source of truth.** Claude reviewers may not be fully aware of all project-specific patterns documented in \`docs/\` and \`docs/template/project-guidelines/\`.

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

**Follow project guidelines in \`docs/template/project-guidelines/\`** (same as initial implementation)

${THEMING_INSTRUCTIONS}

Key principles:
- Address ALL feedback points
- Keep changes focused on the feedback
- Don't add extra features or refactoring
- Test your changes make sense in context
- Follow TypeScript, React, and state management patterns from \`docs/template/project-guidelines/\`

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

## Output

After making changes, provide your response as structured JSON with these fields:
- **prSummary**: Updated PR summary in markdown format with "## Summary" and "## Changes" sections
- **comment**: High-level summary of what you changed to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE

### QUALITY REQUIREMENTS FOR FEEDBACK RESPONSE

Your comment should clearly show HOW each feedback point was addressed. This helps reviewers quickly verify fixes.

**GOOD comment format:**
\`\`\`
Here's how I addressed the feedback:
1. [Mobile layout issue: buttons too close] → Added gap-3 spacing and min-h-[44px] for touch targets
2. [Missing error handling in API call] → Added try/catch with toast notification on failure
3. [Import should use @/ alias] → Changed relative import to @/client/components/template/ui/Button
4. [Claude: potential XSS in user input] → Added sanitization with DOMPurify before rendering
\`\`\`

**BAD comment format (too vague, avoid this):**
\`\`\`
Here's what I changed:
1. Fixed the layout issue
2. Added error handling
3. Fixed imports
\`\`\`

**Key principles:**
- Be specific about WHAT changed (file names, CSS classes, function names)
- Show the before→after transformation
- Reference specific reviewer feedback points
- If you disagreed with feedback, explain WHY (citing project docs)

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
        ? `\n## All Issue Comments\n\n${formatCommentsList(issueComments)}\n`
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
- **For UI changes**: Visually verify at 400px viewport width before completing (see main implementation prompt for details)

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

## Output

After implementing, provide your response as structured JSON with these fields:
- **prSummary**: Complete PR summary in markdown format with "## Summary" and "## Changes" sections (this will be used in PR description and squash merge commit)
- **comment**: High-level summary of what you did to post as GitHub comment (3-5 bullet points). Use markdown numbered list with each item on a NEW LINE
- **visualVerification** (only for UI changes): Object describing visual verification status

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
