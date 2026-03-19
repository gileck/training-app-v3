---
description: Comprehensive code review, documentation check, and push changes to repository
---

# Review, Document, and Push Code Command

This command performs a comprehensive code review, documentation check, and pushes changes to the master branch.

## Process Overview

Execute the following steps in order:

### Step 1: Review Added/Changed Code from Current Conversation
- Review all files that were added or modified during the current conversation
- For each changed file:
  - Read the file contents to understand the changes
  - Verify the changes align with the conversation's objectives
  - Logic review: Does the logic make sense? Can we do it better?
  - Did we add any complex code that could be simplified?
  - Code Duplication Check: Did we copy code or logic instead of sharing it? It's best to never copy code/logic and always share the logic (unless instructed to copy)
  - Check for code quality issues (TypeScript types, naming conventions, etc.)
  - Ensure changes follow project guidelines and patterns
  - Verify no debug code, console.logs, or temporary fixes remain
  - Check for proper error handling
  - Did we add hacks or workarounds that the user should know about?
  - Design Rules Review:
    - **Dark/Light Mode Support**: Ensure all UI changes properly support both dark and light modes
    - **Custom Dialogs Only**: Never use native alerts/confirmation dialogs - always use custom designed alerts/confirmation dialogs
- After manual review, run automated checks:
  - Run TypeScript type checking
  - Run ESLint for code quality issues
  - Execute `yarn checks` to verify all guidelines compliance
- Review any linter errors or TypeScript issues and fix them
- Ensure all fixes maintain code consistency with project guidelines

**If any issues, concerns, or potential improvements are found during the review:**
  - Document all findings clearly
  - Let the user know about each issue or concern
  - Ask for confirmation before proceeding to fixes or continuing with the process

### Step 2: Document Code Changes
- Review all modified files for proper documentation:
  - Ensure functions have JSDoc comments where appropriate
  - Verify complex logic has explanatory comments
  - Check that new APIs follow the API documentation guidelines
  - Confirm React components have proper prop type definitions
  - Verify any new features are documented in relevant README or docs
- Add inline comments for non-obvious code sections
- Update/Create relevant documentation files if needed
- For complex logic and main app flows:
  - Ensure they are documented in their own logical documentation file
  - Update the documentation according to new changes
  - If no documentation exists for a complex flow, create one
  - Verify the documentation accurately reflects the current implementation
- Check if new/modified documentation files can be unified:
  - Review all new or modified documentation files (*.md, docs/)
  - Determine if multiple separate docs cover related topics
  - Consider if they can be merged into a single logical documentation file
  - If unification makes sense, propose consolidation to the user for confirmation

### Step 3: Run Final Checks
- Execute `yarn checks` again to ensure all fixes are correct
- Verify no new errors were introduced
- Confirm all TypeScript and ESLint errors are resolved (0 errors)

### Step 4: Stage and Commit Changes
- Review git status to see all changed files
- Stage all relevant changes using `git add`
- Create a meaningful commit message that:
  - Clearly describes what was changed
  - Explains why the change was made
  - References any related issues or features
- Commit the changes with the descriptive message

### Step 5: Push to Master
- Push the committed changes to the master branch
- Verify the push was successful
- Confirm the remote repository has been updated

## Important Notes

- **Never force push to master** unless explicitly requested
- **Do not skip git hooks** (--no-verify, --no-gpg-sign)
- Only proceed with push if `yarn checks` shows 0 errors
- Ensure all documentation is complete before committing
- Write clear, descriptive commit messages

## Execution

When this command is invoked, execute each step sequentially, ensuring each step completes successfully before moving to the next one.
