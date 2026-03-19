---
description: Systematic approach for implementing new features with proper planning and verification
---

# New Feature Implementation Command

This document outlines the systematic approach for implementing new features in any project.

## Process Overview

Follow these steps in order to ensure high-quality feature implementation:

---

## Step 1: Understand the Feature
- **Objective**: Gain clear understanding of what needs to be built
- **Actions**:
  - Read the feature request carefully
  - Identify any ambiguities or unclear requirements
  - Ask clarifying questions to the user if anything is not clear
  - Confirm understanding before proceeding

---

## Step 2: Understand the Related Codebase
- **Objective**: Familiarize yourself with relevant code and documentation
- **Actions**:
  - Read relevant documentation files
  - Examine existing code that relates to the feature
  - Understand the current architecture and patterns
  - Identify where the new feature will integrate
  - Read App's documentation (Readme and/or related docs on /docs folder)

---

## Step 3: Read Project Guidelines
- **Objective**: Ensure compliance with project standards
- **Actions**:
  - Check `CLAUDE.md` or similar configuration files
  - Review coding standards and conventions
  - Understand the project's architectural patterns
  - Note any specific requirements or constraints

---

## Step 4: Implement the Feature
- **Objective**: Build the feature following best practices
- **Core Guidelines**:

  ### Keep It Simple
  - Don't overcomplicate the solution
  - Use straightforward approaches when possible
  - If the implementation becomes complicated:
    - Explain the complexity to the user
    - Ask for approval before proceeding
    - Consider if there's a simpler alternative

  ### Avoid Code Duplication
  - Don't copy existing code
  - Refactor common functionality into reusable components
  - Only duplicate code if specifically requested by the user
  - Follow the DRY (Don't Repeat Yourself) principle

  ### Follow Project Guidelines
  - Implement according to established patterns
  - Maintain consistency with existing code
  - Use the same styling and naming conventions

  ### Maintain Modular Code Organization
  - When adding logic to existing files, evaluate if the new logic should be separated
  - If the new functionality is substantial or logically distinct:
    - Extract it into its own dedicated file
    - Import and use the logic in the existing file
    - This prevents files from growing too large
    - Improves maintainability and code organization
  - Keep files focused on a single responsibility when possible

  ### Create Todo List (Recommended)
  - Break down the feature into sub-tasks if needed
  - Use the TodoWrite tool to create a structured task list
  - Implement sub-tasks one by one in order
  - Mark each sub-task as complete before moving to the next
  - Benefits:
    - Better organization for complex features
    - Clear progress tracking
    - Easier to manage multi-step implementations
    - Ensures nothing is missed

---

## Step 5: Review the Code
- **Objective**: Ensure code quality before deployment
- **Actions**:
  - Review your implementation for bugs
  - Check for edge cases
  - Verify error handling
  - Ensure code readability and maintainability
  - Validate adherence to guidelines

---

## Step 6: Verify Functionality - DO NOT SKIP THIS STEP!!!
- **Objective**: Confirm the feature works as expected
- **Actions**:
  - Ask the user to verify the feature is working, OR
  - Try to verify yourself using the native browser extension (if available)
  - Test main functionality
  - Test edge cases if applicable
  - Ensure no regressions in existing features


## Step 6.1: If the user reports the feature does not work or does not meet expectations:
1. Understand the feedback — clarify the expected behavior and failure mode.
2. Return to Step 4 (Implement) and apply the feedback.
3. Repeat Step 5 (Test) to ensure the fix behaves correctly.
4. Run Step 6 (Verify) again and ask the user to re-check before moving on.

---

*** IMPORTANT: DO NOT ADVANCE TO STEP 7 UNTIL THE USER EXPLICITLY CONFIRMS THE FEATURE WORKS ***

---

## Step 7: Document
- **Objective**: Provide clear documentation for future reference
- **Actions**:
  - Add proper inline code documentation (comments, JSDoc, etc.)
  - Update the README file if needed
  - Create a dedicated document file for the feature if:
    - The feature is complex
    - It requires user-facing documentation
    - It doesn't already exist
  - If there is a feature document in the project (usually under docs folder), add this feature to the feature list with a brief description
  - Document any new APIs, functions, or components

---

## Step 8: Commit and Push
- **Objective**: Save the work to version control
- **Actions**:
  - Stage the changes
  - Write a proper commit message that:
    - Clearly describes what was added
    - Follows project commit message conventions
    - References any related issues or tickets
  - Push to master (or appropriate branch)

---

## Step 9: Summarize
- **Objective**: Provide clear completion report to the user
- **Actions**:
  - Summarize what was implemented
  - Highlight key changes or files modified
  - Note any important decisions made
  - Mention any follow-up items if applicable
  - Confirm the feature is complete and deployed

---

## Quick Checklist

- [ ] Feature requirements clarified
- [ ] Codebase understood
- [ ] Project guidelines reviewed
- [ ] Todo list created (if needed)
- [ ] Implementation is simple and clean
- [ ] No unnecessary code duplication
- [ ] Code reviewed for quality
- [ ] Feature verified/tested
- [ ] Documentation added
- [ ] Code committed with proper message
- [ ] Changes pushed to repository
- [ ] User informed with summary
