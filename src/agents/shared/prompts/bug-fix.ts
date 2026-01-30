/**
 * Bug Fix Prompts
 *
 * Prompts specific to bug fix workflows, including bug technical design
 * and bug implementation phases.
 */

import type { ProjectItemContent } from '@/server/project-management';
import type { GitHubComment } from '../types';
import type { BugDiagnostics } from '../utils';
import { formatSessionLogs } from '../utils';
import { AMBIGUITY_INSTRUCTIONS, MARKDOWN_FORMATTING_INSTRUCTIONS } from './shared-instructions';

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
