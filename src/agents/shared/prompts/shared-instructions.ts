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
3. INSTEAD, use the clarification fields in your structured output:

Set these fields:
- \`needsClarification\`: true
- \`clarification\`: An object with structured clarification data (see format below)
- Leave all other fields empty (design, comment, phases, etc.)

Format for clarification object:
\`\`\`json
{
  "needsClarification": true,
  "clarification": {
    "context": "Explain what is ambiguous or unclear and why clarification is needed.",
    "question": "Your specific, actionable question.",
    "options": [
      {
        "label": "Recommended option name",
        "description": "Detailed explanation of this option, its benefits, and approach.\\n- Bullet point 1\\n- Bullet point 2",
        "isRecommended": true
      },
      {
        "label": "Alternative option name",
        "description": "Detailed explanation of this option and its tradeoffs.\\n- Bullet point 1\\n- Bullet point 2",
        "isRecommended": false
      }
    ],
    "recommendation": "I recommend [option] because [clear reasoning]."
  },
  "design": "",
  "comment": ""
}
\`\`\`

Guidelines for clarification:
- Provide 2-4 options (one should be recommended)
- Use clear, descriptive labels for options
- Include detailed descriptions with bullet points (use \\n for newlines)
- Only set isRecommended=true for ONE option
- Keep the question specific and actionable

When you set needsClarification=true:
- The system will post a formatted comment on the GitHub issue
- Admin will be notified via Telegram with an interactive UI
- Admin can select an option or provide a custom response
- Your work will pause until admin responds
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
