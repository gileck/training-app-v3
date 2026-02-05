/**
 * Bug Investigation Prompts
 *
 * Prompts for the Bug Investigator agent that performs read-only
 * analysis of bugs to identify root causes and suggest fix options.
 */

import type { ProjectItemContent } from '@/server/project-management';
import type { GitHubComment } from '../types';
import type { BugDiagnostics } from '../utils';
import { formatSessionLogs } from '../utils';
import { AMBIGUITY_INSTRUCTIONS, MARKDOWN_FORMATTING_INSTRUCTIONS } from './shared-instructions';

/**
 * Build prompt for bug investigation (new investigation)
 */
export function buildBugInvestigationPrompt(
    issue: ProjectItemContent,
    diagnostics: BugDiagnostics | null,
    comments?: GitHubComment[]
): string {
    const commentsSection = comments && comments.length > 0
        ? `\n## Comments on Issue\n\nThe following comments have been added to the issue:\n\n${comments.map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`).join('\n\n---\n\n')}\n`
        : '';

    // Format diagnostics if available
    let diagnosticsSection = '';
    if (diagnostics) {
        const categoryLabel = diagnostics.category === 'performance' ? '⚡ Performance' : '🐛 Bug';
        const sessionLogsSection = diagnostics.sessionLogs?.length
            ? `\n**Session Logs (last 20):**\n\`\`\`\n${formatSessionLogs(diagnostics.sessionLogs.slice(-20))}\n\`\`\``
            : '';

        const stackTraceSection = diagnostics.stackTrace
            ? `\n**Stack Trace:**\n\`\`\`\n${diagnostics.stackTrace}\n\`\`\``
            : '';

        diagnosticsSection = `## Bug Diagnostics

**Category:** ${categoryLabel}
${diagnostics.errorMessage ? `**Error Message:** ${diagnostics.errorMessage}\n` : ''}${diagnostics.route ? `**Route:** ${diagnostics.route}\n` : ''}${diagnostics.networkStatus ? `**Network Status:** ${diagnostics.networkStatus}\n` : ''}${diagnostics.browserInfo ? `**Browser:** ${diagnostics.browserInfo.userAgent}
**Viewport:** ${diagnostics.browserInfo.viewport.width}x${diagnostics.browserInfo.viewport.height}\n` : ''}${stackTraceSection}${sessionLogsSection}`;
    } else {
        diagnosticsSection = `## Bug Diagnostics

⚠️ No diagnostic data available. Investigate based on the issue description.`;
    }

    return `You are a Bug Investigator Agent performing a READ-ONLY analysis of a reported bug.

Your goal is to:
1. Identify the ROOT CAUSE of the bug
2. Suggest FIX OPTIONS for the admin to choose from

CRITICAL: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}

**Description:**
${issue.body || 'No description provided'}
${commentsSection}
${diagnosticsSection}

---

## INVESTIGATION PROCESS

Follow these steps IN ORDER:

### Step 1: TRACE - Find the Failure Path

1. **Start from the error/symptom** - Where does the bug manifest?
2. **Trace backwards** - What code path leads to this failure?
3. **Identify the trigger** - What input/state causes the bug?

Use Read, Glob, and Grep to explore the codebase. Document what you find.

### Step 2: IDENTIFY - Pinpoint the Root Cause

The root cause must be SPECIFIC:
- ✅ "The handler expects \`parts[1]\` to be valid, but whitespace causes \`parseInt\` to return \`NaN\`"
- ✅ "The validation \`!val\` incorrectly rejects \`0\` as invalid"
- ❌ "Error handling is missing" ← This is a symptom, not root cause
- ❌ "The code crashes" ← This is the symptom, not cause

### Step 3: SCOPE - Check for Similar Patterns

Search the codebase for similar patterns that might have the same bug:
- Use Grep to find similar code patterns
- List ALL affected locations
- A fix that only addresses 1 of N similar issues is incomplete

### Step 4: PROPOSE - Suggest Fix Options

Provide 1-N fix options. Ideally suggest 3 levels when appropriate:
1. **Quick Fix** (S complexity) - Minimal change, addresses immediate symptom
2. **Standard Fix** (M complexity) - Proper fix, addresses root cause
3. **Refactor** (L/XL complexity) - Comprehensive fix, improves architecture

BUT: Only include options that genuinely make sense. Don't invent artificial options.

For each option, specify:
- **destination**: "implement" (simple, can go directly to code) or "tech-design" (needs design doc first)
- **complexity**: S, M, L, or XL
- **files affected**: Which files need changes

---

## OUTPUT FORMAT

Provide your response as structured JSON with these fields:

\`\`\`json
{
  "rootCauseFound": true/false,
  "confidence": "low" | "medium" | "high",
  "rootCauseAnalysis": "Detailed analysis of what causes the bug...",
  "fixOptions": [
    {
      "id": "opt1",
      "title": "Add null check",
      "description": "Add defensive null check before accessing property...",
      "destination": "implement",
      "complexity": "S",
      "filesAffected": ["src/file.ts"],
      "tradeoffs": "Addresses symptom but not underlying design issue",
      "isRecommended": false
    },
    {
      "id": "opt2",
      "title": "Refactor validation logic",
      "description": "Rewrite the validation to properly handle edge cases...",
      "destination": "tech-design",
      "complexity": "M",
      "filesAffected": ["src/file.ts", "src/utils.ts"],
      "tradeoffs": "More work but prevents similar bugs",
      "isRecommended": true
    }
  ],
  "filesExamined": ["src/file1.ts", "src/file2.ts"],
  "additionalLogsNeeded": "Only if rootCauseFound is false - what info would help",
  "summary": "1. Root cause: X\\n2. Confidence: Y\\n3. Recommended fix: Z"
}
\`\`\`

**Summary format:** Use markdown numbered list with each item on a NEW LINE.

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

---

Now investigate this bug. Start by exploring the codebase to understand the failure path.`;
}

/**
 * Build prompt for bug investigation revision based on feedback
 */
export function buildBugInvestigationRevisionPrompt(
    issue: ProjectItemContent,
    diagnostics: BugDiagnostics | null,
    existingInvestigation: string,
    feedbackComments: GitHubComment[]
): string {
    const feedbackSection = feedbackComments
        .map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`)
        .join('\n\n---\n\n');

    // Format diagnostics if available
    let diagnosticsSection = '';
    if (diagnostics) {
        const sessionLogsSection = diagnostics.sessionLogs?.length
            ? `\n**Session Logs (last 20):**\n\`\`\`\n${formatSessionLogs(diagnostics.sessionLogs.slice(-20))}\n\`\`\``
            : '';

        diagnosticsSection = `## Bug Diagnostics (Reference)

${diagnostics.errorMessage ? `**Error Message:** ${diagnostics.errorMessage}\n` : ''}${diagnostics.stackTrace ? `**Stack Trace:** ${diagnostics.stackTrace.slice(0, 500)}...\n` : ''}${sessionLogsSection}`;
    }

    return `You are revising a Bug Investigation based on admin feedback.

CRITICAL: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}

${diagnosticsSection}

## Previous Investigation

${existingInvestigation}

## Admin Feedback

The admin has requested changes to the investigation. Address ALL feedback points:

${feedbackSection}

---

## Your Task

1. Carefully read and understand all feedback comments
2. If feedback indicates incomplete investigation → Re-investigate the code
3. If feedback indicates wrong root cause → Reconsider the analysis
4. If feedback requests different fix options → Provide new options
5. Revise the investigation to address ALL feedback points

## OUTPUT FORMAT

Provide your response as structured JSON with ALL fields (complete investigation, not just changes):

- **rootCauseFound**: true/false
- **confidence**: "low" | "medium" | "high"
- **rootCauseAnalysis**: Complete revised analysis
- **fixOptions**: Complete list of fix options
- **filesExamined**: Complete list of files examined
- **additionalLogsNeeded**: If applicable
- **summary**: Updated summary of investigation

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now revise the Bug Investigation based on the feedback.`;
}

/**
 * Build prompt for continuing bug investigation after clarification
 */
export function buildBugInvestigationClarificationPrompt(
    issue: ProjectItemContent,
    diagnostics: BugDiagnostics | null,
    comments: GitHubComment[],
    clarificationAnswer: GitHubComment
): string {
    // Format diagnostics if available
    let diagnosticsSection = '';
    if (diagnostics) {
        diagnosticsSection = `## Bug Diagnostics (Reference)

${diagnostics.errorMessage ? `**Error Message:** ${diagnostics.errorMessage}\n` : ''}${diagnostics.route ? `**Route:** ${diagnostics.route}\n` : ''}`;
    }

    const previousContext = comments
        .slice(0, -1) // All comments except the clarification answer
        .map((c) => `**${c.author}** (${c.createdAt}):\n${c.body}`)
        .join('\n\n---\n\n');

    return `You are continuing a Bug Investigation after receiving clarification from the admin.

CRITICAL: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Issue Details

**Title:** ${issue.title}
**Number:** #${issue.number || 'Draft'}

${diagnosticsSection}

## Previous Discussion

${previousContext}

## Clarification Received

The admin has provided this clarification:

**${clarificationAnswer.author}** (${clarificationAnswer.createdAt}):
${clarificationAnswer.body}

---

## Your Task

Continue the investigation with the new information provided. Complete the analysis and provide fix options.

## OUTPUT FORMAT

Provide your response as structured JSON with ALL fields:

- **rootCauseFound**: true/false
- **confidence**: "low" | "medium" | "high"
- **rootCauseAnalysis**: Complete analysis
- **fixOptions**: List of fix options
- **filesExamined**: List of files examined
- **additionalLogsNeeded**: If applicable
- **summary**: Summary of investigation

${MARKDOWN_FORMATTING_INSTRUCTIONS}

${AMBIGUITY_INSTRUCTIONS}

Now complete the Bug Investigation with the clarification provided.`;
}
