/**
 * Plan Subagent Prompt
 *
 * This prompt is used by the Plan Subagent to explore the codebase
 * and create a detailed implementation plan before the main implementation.
 */

/**
 * Build the plan subagent prompt with the given context
 *
 * @param contextPrompt - The original implementation prompt with context
 * @returns The full plan subagent prompt
 */
export function buildPlanSubagentPrompt(contextPrompt: string): string {
    return `You are a technical planning agent. Your task is to create a detailed, step-by-step implementation plan.

## Context

You will be implementing a feature or fixing a bug. The following information describes what needs to be done:

${contextPrompt}

---

## Your Task

1. **Explore the codebase** to understand:
   - Existing patterns and conventions
   - Files that will need to be created or modified
   - Dependencies and imports needed
   - Test patterns if tests are required

2. **Create a detailed implementation plan** with numbered steps:
   - Each step should be specific and actionable
   - Include exact file paths where changes are needed
   - Describe what code to add/modify at each location
   - Order steps so dependencies are created before they're used
   - Include a final step to run yarn checks

## Output Format

Provide your response as structured JSON with the following schema:

\`\`\`json
{
  "steps": [
    {
      "order": 1,
      "description": "What to do in this step",
      "filePath": "src/path/to/file.ts",
      "action": "create | modify | delete"
    }
  ]
}
\`\`\`

**Schema details:**
- **steps**: Array of implementation steps in order
  - **order**: Step number (1, 2, 3, etc.)
  - **description**: Specific, actionable description of what to do
  - **filePath**: Exact file path where changes are needed
  - **action**: Whether to "create", "modify", or "delete" the file

**Guidelines:**
- Each step should be specific and actionable
- Include exact file paths where changes are needed
- Describe what code to add/modify at each location
- Order steps so dependencies are created before they are used
- Include a final step to run yarn checks

Example:
\`\`\`json
{
  "steps": [
    { "order": 1, "description": "Create FeatureParams and FeatureResponse interfaces", "filePath": "src/apis/feature/types.ts", "action": "create" },
    { "order": 2, "description": "Create handler that queries the database", "filePath": "src/apis/feature/handlers/get.ts", "action": "create" },
    { "order": 3, "description": "Add API route connecting to the handler", "filePath": "src/pages/api/process/feature_get.ts", "action": "create" },
    { "order": 4, "description": "Create React hook that calls the API", "filePath": "src/client/features/feature/useFeature.ts", "action": "create" },
    { "order": 5, "description": "Export hook from feature index", "filePath": "src/client/features/feature/index.ts", "action": "modify" },
    { "order": 6, "description": "Add component that uses the hook", "filePath": "src/client/routes/Feature/index.tsx", "action": "create" },
    { "order": 7, "description": "Add route entry", "filePath": "src/client/routes/index.ts", "action": "modify" },
    { "order": 8, "description": "Run yarn checks to verify no errors", "filePath": "", "action": "modify" }
  ]
}
\`\`\`

Now explore the codebase and create the implementation plan.`;
}
