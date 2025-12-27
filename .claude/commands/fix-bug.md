---
description: Systematic approach for fixing bugs with proper analysis and verification
---

# Bug Fix Command

This document outlines the systematic approach for fixing bugs in any project.

## Process Overview

Follow these steps in order to ensure high-quality bug resolution:

---

## Step 1: Understand the Bug
- **Objective**: Gain clear understanding of the problem
- **Actions**:
  - Read the bug report carefully (from the user)
  - Identify the expected behavior vs actual behavior
  - Note any error messages, stack traces, or logs
  - Ask clarifying questions to the user if anything is not clear
  - Identify the severity and impact of the bug
  - Confirm understanding before proceeding

---

## Step 2: Reproduce the Bug (if possible)
- **Objective**: Verify the bug exists and understand how to trigger it
- **Actions**:
  - Follow the steps to reproduce the bug
  - Identify the exact conditions that cause the bug
  - Note any patterns or edge cases
  - Document the reproduction steps if not already clear
  - If unable to reproduce, ask the user for more details

---

## Step 3: Understand the Related Codebase
- **Objective**: Familiarize yourself with relevant code
- **Actions**:
  - Locate the code responsible for the buggy behavior
  - Read relevant documentation files (usually in the /docs folder)
  - Examine the code flow and logic
  - Understand the architecture and patterns
  - Identify all components affected by the bug
  - Look for related code that might have similar issues

---

## Step 4: Read Project Guidelines
- **Objective**: Ensure compliance with project standards
- **Actions**:
  - Check `CLAUDE.md` or similar configuration files
  - Review coding standards and conventions
  - Understand the project's architectural patterns
  - Note any specific requirements or constraints
  - Check if there are testing requirements

---

## Step 5: Suggest Options to Fix the Bug
- **Objective**: Present multiple solutions with trade-offs
- **Actions**:
  - Identify all possible approaches to fix the bug
  - Consider both short-term quick fixes and long-term solutions
  - For each option, provide:
    - Clear description of the approach
    - Pros (benefits, advantages)
    - Cons (drawbacks, limitations, risks)
    - Estimated complexity/effort
    - Impact on codebase

  ### Presentation Format:

  **Option 1 (Recommended): [Name of recommended approach]**
  - Description: [How this fix works]
  - Pros:
    - [Advantage 1]
    - [Advantage 2]
  - Cons:
    - [Limitation 1]
    - [Limitation 2]
  - Complexity: [Low/Medium/High]
  - Impact: [Description of what will change]

  **Option 2: [Name of alternative approach]**
  - Description: [How this fix works]
  - Pros:
    - [Advantage 1]
  - Cons:
    - [Limitation 1]
  - Complexity: [Low/Medium/High]
  - Impact: [Description of what will change]

  **Option 3: [Quick fix/workaround if applicable]**
  - Description: [How this fix works]
  - Pros:
    - [Advantage 1]
  - Cons:
    - [Limitation 1]
  - Complexity: [Low/Medium/High]
  - Impact: [Description of what will change]

  ### Guidelines for Options:
  - Present your **recommended option first**
  - Include quick fixes if they exist (but note their limitations)
  - Include proper long-term solutions (even if more complex)
  - Include refactoring options if the bug reveals deeper issues
  - Be honest about trade-offs
  - Consider: time to implement, risk, maintainability, scalability
  - Wait for user approval before implementing (especially if options are significantly different)

---

## Step 6: Implement the Fix
- **Objective**: Resolve the bug following best practices
- **Core Guidelines**:

  ### Keep It Simple
  - Fix only what's broken
  - Don't over-engineer the solution
  - Use straightforward approaches when possible
  - If the fix becomes complicated:
    - Explain the complexity to the user
    - Ask for approval before proceeding
    - Consider if there's a simpler alternative

  ### Avoid Code Duplication
  - Don't copy existing code
  - Refactor common functionality into reusable components if needed
  - Only duplicate code if specifically requested by the user
  - Follow the DRY (Don't Repeat Yourself) principle

  ### Follow Project Guidelines
  - Implement according to established patterns
  - Maintain consistency with existing code
  - Use the same styling and naming conventions

  ### Maintain Modular Code Organization
  - When fixing bugs in existing files, evaluate if refactoring is needed
  - If the fix reveals poor code organization:
    - Consider extracting logic into dedicated files
    - Improve maintainability while fixing
    - But don't refactor unrelated code without user approval
  - Keep the scope focused on the bug fix

  ### Root Cause Analysis
  - Fix the root cause, not just the symptoms
  - Consider if the same issue exists elsewhere in the codebase
  - Address similar patterns if they pose the same risk

  ### No Workarounds or Hacks
  - Implement proper fixes, not temporary workarounds
  - Avoid hacky solutions that might cause issues later
  - Only use workarounds if explicitly asked by the user
  - If a workaround is necessary, document it clearly and explain why

  ### Create Todo List (if needed)
  - For complex bugs affecting multiple areas:
    - Break down the fix into sub-tasks
    - Use the TodoWrite tool to create a structured task list
    - Fix sub-tasks one by one in order
    - Mark each sub-task as complete before moving to the next

  ## IMPORTANT: DO NOT DOCUMENT ON THIS STEP! Only document in step 9.

---

## Step 7: Review the Code
- **Objective**: Ensure code quality before deployment
- **Actions**:
  - Review your fix for potential side effects
  - Check for edge cases
  - Verify error handling
  - Ensure the fix doesn't introduce new bugs
  - Validate adherence to guidelines
  - Consider performance implications
  - IMPORTANT: DO NOT DOCUMENT ON THIS STEP!  Only document in step 9.

---

## Step 8: Verify the Fix - DO NOT SKIP THIS STEP!!!
- **Objective**: Confirm the bug is resolved
- **Actions**:
  - Ask the user to verify the bug is fixed, OR
  - Try to verify yourself using the native browser extension (if available)
  - Test the original reproduction steps
  - Verify the expected behavior now works
  - Test edge cases if applicable
  - Ensure no regressions in existing features
  - Confirm no new bugs were introduced

---

## Step 8.1: If the user reports the bug still exists or the fix doesn't work:
1. Understand the feedback — clarify what's still broken and why
2. Return to Step 3 (Understand Codebase) if needed, or Step 5 (Suggest Options) or Step 6 (Implement)
3. Apply the feedback and adjust the fix
4. Repeat Step 7 (Review) to ensure the updated fix is correct
5. Run Step 8 (Verify) again and ask the user to re-check before moving on

---

*** IMPORTANT: DO NOT ADVANCE TO STEP 9 UNTIL THE USER EXPLICITLY CONFIRMS THE BUG IS FIXED ***

---

## Step 9: Document
- **Objective**: Provide clear documentation for future reference
- **Actions**:
  - Add inline comments explaining the fix if the code is non-obvious
  - Update any affected documentation
  - If the bug revealed a common pitfall:
    - Document it in project guidelines or README
    - Add warnings or notes for future developers
  - Update CHANGELOG if the project maintains one
  - Document any workarounds that were removed

---

## Step 10: Commit and Push
- **Objective**: Save the work to version control
- **Actions**:
  - Stage the changes
  - Write a proper commit message that:
    - Clearly describes the bug that was fixed
    - Explains the root cause (if not obvious)
    - References any related issues or tickets (e.g., "Fixes #123")
    - Follows project commit message conventions
    - Use conventional commit format if applicable (e.g., "fix: resolve null pointer in user authentication")
  - Push to master (or appropriate branch)

---

## Step 11: Summarize
- **Objective**: Provide clear completion report to the user
- **Actions**:
  - Summarize what bug was fixed
  - Explain the root cause
  - Highlight key changes or files modified
  - Note any important decisions made
  - Mention if similar issues were found and fixed
  - Note any follow-up items if applicable
  - Confirm the bug is fixed and deployed

---

## Quick Checklist

- [ ] Bug understood clearly
- [ ] Bug reproduced successfully
- [ ] Root cause identified
- [ ] Codebase understood
- [ ] Project guidelines reviewed
- [ ] Options presented with pros/cons
- [ ] Recommended approach selected
- [ ] Todo list created (if needed for complex bugs)
- [ ] Fix is simple and targeted
- [ ] No unnecessary code duplication
- [ ] Root cause addressed (not just symptoms)
- [ ] Code reviewed for quality and side effects
- [ ] Bug verified as fixed
- [ ] No regressions introduced
- [ ] Documentation updated
- [ ] Code committed with proper message
- [ ] Changes pushed to repository
- [ ] User informed with summary

---

## Common Bug-Fixing Best Practices

### Before You Start
- Always reproduce the bug first
- Never assume you understand the bug without seeing it
- Document your reproduction steps

### During the Fix
- Make minimal changes necessary to fix the bug
- Resist the urge to refactor unrelated code
- Test your fix incrementally
- Keep the scope focused

### After the Fix
- Always verify the fix works in the actual environment
- Check for similar bugs in related code
- Consider if tests should be added to prevent regression
- Document any non-obvious fixes

### What to Avoid
- Don't fix bugs you can't reproduce
- Don't make large refactors while bug fixing
- Don't skip testing "obvious" fixes
- Don't forget to check for similar issues elsewhere
