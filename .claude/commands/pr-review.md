---
allowed-tools: Read, Glob, Grep, Bash
description: Review PR changes for code quality and correctness
---

## Task
Review the code changes in this branch for:
1. Code quality and adherence to project patterns
2. Correctness and potential bugs
3. TypeScript/ESLint compliance
4. Security considerations
5. Adherence to technical design (if provided)

## Changes to Review
!`git diff main...HEAD`

## Changed Files
!`git diff --name-only main...HEAD`

## Instructions

1. **Read the changed files** - Use the Read tool to examine each changed file
2. **Understand the context** - Look at surrounding code to understand the changes
3. **Check for issues** - Look for:
   - TypeScript errors or type safety issues
   - ESLint violations
   - Security vulnerabilities (XSS, SQL injection, etc.)
   - Code quality issues (duplication, complexity, etc.)
   - Adherence to project patterns and guidelines
4. **Make a decision** - Decide whether to approve or request changes

## Output Format

You MUST output your review in this exact format:

```review
## Review Decision
DECISION: APPROVED | REQUEST_CHANGES

## Summary
[1-2 sentence summary of the changes]

## Feedback Items
[If REQUEST_CHANGES, list numbered items with file:line references:]
1. **[file.ts:line]** Description of issue and how to fix it
2. **[General]** Description of broader issue

## What Looks Good
[Positive feedback on the implementation - what was done well]
```

## Important Notes
- Be thorough but constructive
- Provide specific file:line references when possible
- Explain WHY something is an issue, not just WHAT the issue is
- Include positive feedback on what was done well
- If approving, still mention any minor suggestions for future improvements
