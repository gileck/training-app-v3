/**
 * Shared Instructions for Agent Prompts
 *
 * Contains reusable instruction blocks used across multiple prompt templates.
 */

// ============================================================
// AMBIGUITY HANDLING INSTRUCTIONS
// ============================================================

export const AMBIGUITY_INSTRUCTIONS = `
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
\`\`\`

When you output a clarification request:
- The system will post it as a comment on the GitHub issue
- Admin will be notified via Telegram with an interactive UI link
- Your work will pause until admin responds
- Admin will select an option or provide a custom response via the UI
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
