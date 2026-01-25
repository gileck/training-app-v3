---
description: Start implementing a task from task-manager/tasks.md with full workflow support
---

# Start Task Command

Implement a task from `task-manager/tasks.md` following a systematic approach with proper planning, implementation, and verification.

## Usage

Invoke this command with a task number:
- `/start-task 1` - Start task 1
- `/start-task --task 3` - Start task 3

## ⚠️ CRITICAL WORKFLOW REQUIREMENT ⚠️

**YOU MUST REQUEST USER REVIEW AND APPROVAL (STEP 8) BEFORE COMMITTING ANY CODE**

This is NOT optional. This step is MANDATORY for all tasks, regardless of size.

**The workflow is:**
1. Implement the task
2. Run `yarn checks` to validate
3. **STOP and request user review (Step 8)** ← YOU ARE HERE
4. Wait for explicit user approval
5. ONLY THEN proceed to commit (Step 9)

**Why this is critical:**
- Prevents accidental commits of incorrect implementations
- Allows user to review before changes are permanent
- Gives user chance to request modifications
- Essential for maintaining code quality and collaboration

**If you skip Step 8, you MUST revert and start over.**

## Process Overview

Follow these steps to implement a task from task-manager/tasks.md:

---

## Step 1: Load Task Details and Mark In Progress
- **Objective**: Read the specific task and mark it as being worked on
- **Actions**:
  - **FIRST**: Mark task as in progress: `yarn task mark-in-progress --task N`
  - Run: `yarn task work --task N` (where N is the task number)
  - This displays:
    - Full task details (priority, size, complexity, implementation details)
    - Files to modify
    - Next steps
  - Read the task content carefully
  - Note the task priority, size, and complexity

**IMPORTANT:** Work stays on main branch unless user explicitly requested a separate branch before starting the task.

---

## Step 2: Understand Requirements
- **Objective**: Gain clear understanding of what needs to be done
- **Actions**:
  - Read the task summary and impact
  - Review the implementation details section
  - Identify files to modify
  - Note any specific code examples or patterns to follow
  - Check for any "CRITICAL" or "IMPORTANT" notes
  - If anything is unclear, ask the user for clarification

---

## Step 3: Review Related Documentation
- **Objective**: Ensure compliance with project standards
- **Actions**:
  - Check `CLAUDE.md` for relevant guidelines
  - Review any documentation mentioned in the task (e.g., specific docs/ files)
  - Understand the project's architectural patterns
  - Note any specific requirements or constraints

---

## Step 4: Explore Relevant Code
- **Objective**: Familiarize yourself with the code to be modified
- **Actions**:
  - Read the files listed in "Files to Modify" section
  - Understand the current implementation
  - Identify where changes need to be made
  - Look for existing patterns to follow
  - Note any dependencies or related code

---

## Step 5: Create Implementation Plan
- **Objective**: Break down the work into manageable steps
- **Actions**:
  - For complex tasks (M/L/XL), create a plan file:
    - Write plan to: `task-manager/plans/task-N-plan.md`
    - Include: objectives, approach, sub-tasks, file changes
  - Use the TodoWrite tool to create a structured task list if helpful
  - Break down implementation into logical sub-tasks
  - Order sub-tasks by dependencies
  - For simple tasks (XS/S), you may skip this step

**If a plan file is created, update tasks.md:**
- Add a `**Plan:**` field to the task with the path to the plan file
- Example in task-manager/tasks.md:
  ```markdown
  **Plan:** `task-manager/plans/task-7-plan.md`
  ```

**Example Plan File (`task-manager/plans/task-N-plan.md`):**
```markdown
# Task N: [Task Title] - Implementation Plan

## Objective
Brief description of what we're implementing.

## Approach
High-level approach and key decisions.

## Sub-tasks
- [ ] Read and understand current implementation
- [ ] Add new field to TypeScript interface
- [ ] Implement server-side logic
- [ ] Add client-side hook
- [ ] Update component to use new field
- [ ] Test the implementation
- [ ] Run validation checks

## Files to Modify
- `path/to/file.ts` - What changes
```

---

## Step 6: Implement the Task
- **Objective**: Execute the implementation following best practices

### Core Guidelines:

**Follow Task Instructions**
- Implement exactly what the task specifies
- Use code examples provided in the task
- Follow file structure and patterns mentioned
- Don't add features beyond the task scope

**Keep It Simple**
- Fix only what's specified in the task
- Don't over-engineer the solution
- Use straightforward approaches

**Follow Project Guidelines**
- Implement according to established patterns
- Maintain consistency with existing code
- Use the same styling and naming conventions
- Check CLAUDE.md for specific rules

**Maintain Code Quality**
- Avoid code duplication
- Keep files modular and focused
- Add proper error handling
- Follow TypeScript strict mode

**For Multi-Step Tasks:**
- Implement one sub-task at a time
- Mark each sub-task complete before moving to next
- Keep commits logical and focused

---

## Step 7: Run Validation Checks
- **Objective**: Ensure code quality and correctness
- **Actions**:
  - Run: `yarn checks`
  - This runs both TypeScript and ESLint checks
  - Fix any errors or warnings
  - Re-run until all checks pass
  - **DO NOT proceed to next step until checks pass**

**If checks fail:**
1. Read the error messages carefully
2. Fix TypeScript errors first
3. Fix ESLint errors second
4. Re-run `yarn checks`
5. Repeat until all checks pass

---

## Step 8: Request User Review and Approval (MANDATORY)

### ⚠️⚠️⚠️ CRITICAL - DO NOT SKIP THIS STEP ⚠️⚠️⚠️

**YOU MUST STOP HERE AND REQUEST USER APPROVAL BEFORE PROCEEDING TO STEP 9**

- **Objective**: Get user approval before committing any code
- **Actions**:
  - **STOP IMMEDIATELY and present to the user:**
    1. **Task Summary**: Remind the user what task was being implemented (task number, title, objective)
    2. **Implementation Summary**: Explain what was done:
       - List all files that were modified/created
       - Briefly describe the key changes in each file
       - Highlight any important decisions made
    3. **Validation Status**: Confirm `yarn checks` passed
    4. **Ask for Approval**: Explicitly ask the user to review and approve before committing

### WHY THIS IS MANDATORY:
- ✅ Gives user visibility into what you implemented
- ✅ Allows user to request changes before code is committed
- ✅ Prevents wasted work from incorrect implementations
- ✅ Essential for collaborative development workflow

**Example message to user:**
```
## Ready for Review

**Task #2:** Debug PR Reviewer + Claude Integration

**What was implemented:**
- `src/agents/core-agents/prReviewAgent/createPrReviewerAgentPrompt.ts`
  - Updated instruction text to require explicit acknowledgment of Claude's feedback
  - Changed "optional guidance" to mandatory AGREE/DISAGREE response format
- `src/agents/core-agents/prReviewAgent/AGENTS.md`
  - Updated documentation to reflect new feedback handling behavior

**Validation:** ✅ `yarn checks` passed

**Please review the changes and let me know if you'd like me to:**
1. Proceed with committing and creating the PR
2. Make any modifications
3. Show you the actual code changes
```

### WAITING FOR USER APPROVAL

- **Wait for explicit approval** before proceeding to commit
- If user requests changes, make them and return to Step 7 (validation)
- Only proceed to Step 9 after user says "yes", "approve", "proceed", or similar

**Valid approval responses:**
- "yes"
- "approve"
- "proceed"
- "looks good"
- "LGTM" (Looks Good To Me)

**If user has NOT given approval, DO NOT proceed to Step 9.**

---

## Step 9: Commit Changes to Main

### ⚠️ PREREQUISITE: User must have approved in Step 8 ⚠️

**Before proceeding, verify:**
- [ ] You requested user review in Step 8
- [ ] User has given explicit approval
- [ ] If NOT approved yet, STOP and wait for approval

- **Objective**: Save the work to version control on main branch
- **Actions**:
  - Ensure you're on main branch: `git branch --show-current`
  - Stage all changes: `git add .`
  - Write a proper commit message following conventional commit format:
    - `fix:` for bug fixes
    - `feat:` for new features
    - `refactor:` for code refactoring
    - `docs:` for documentation changes
  - Include task number in commit message
  - Example: `fix: correct cost tracking in implementation agent (task #1)`
  - Commit: `git commit -m "message"`

---

## Step 10: Mark Task as Done
- **Objective**: Update task status in task-manager/tasks.md immediately after implementation
- **Actions**:
  - Run: `yarn task mark-done --task N` (where N is the task number)
  - This updates the task header with ✅ DONE marker and completion date
  - Stage the change: `git add task-manager/tasks.md`
  - Commit with message: `git commit -m "docs: mark task #N as done"`
  - This creates a **separate commit** following the implementation commit

**Why a separate commit?**
- Keeps implementation and documentation changes separated
- Makes git history cleaner and easier to review
- Follows the principle of atomic commits

---

## Step 11: Push to Main
- **Objective**: Push both commits to main branch
- **Actions**:
  - Push to remote: `git push origin main`
    - This pushes **both commits**: implementation commit + task status commit

---

## Step 12: Summarize
- **Objective**: Provide completion report to the user
- **Actions**:
  - Summarize what was implemented
  - Highlight key changes and files modified
  - List commits pushed to main
  - Confirm validation checks passed
  - Confirm task was marked as done in tasks.md
  - Note any follow-up items if applicable

---

## Quick Checklist

- [ ] Task marked as in progress with `yarn task mark-in-progress --task N`
- [ ] Task loaded with `yarn task work --task N`
- [ ] Staying on main branch (unless user explicitly requested a separate branch)
- [ ] Requirements understood
- [ ] Documentation reviewed (CLAUDE.md, task-specific docs)
- [ ] Relevant code explored
- [ ] Implementation plan created (if M/L/XL) with path recorded in tasks.md
- [ ] Task implemented following guidelines
- [ ] `yarn checks` passed with 0 errors
- [ ] **⚠️ CRITICAL: User review requested and approval received (MANDATORY - DO NOT SKIP)**
- [ ] Changes committed to main with proper message (implementation commit)
- [ ] Task marked as done with `yarn task mark-done --task N` (separate commit)
- [ ] Both commits pushed to main
- [ ] User notified with summary

---

## Important Notes

### Task Size Guidelines

- **XS tasks**: Usually 1 file, < 50 lines changed, no planning needed
- **S tasks**: 2-5 files, < 100 lines, simple planning
- **M tasks**: 5-15 files, < 500 lines, detailed planning recommended
- **L tasks**: 15-30 files, < 1000 lines, comprehensive planning required
- **XL tasks**: 30+ files, > 1000 lines, should be broken into phases

### When to Ask for Help

Ask the user if:
- Task requirements are ambiguous
- Multiple valid approaches exist
- Implementation becomes more complex than expected
- Task size estimate seems wrong
- Breaking changes are required

### Common Pitfalls to Avoid

- Don't skip `yarn checks` - validation is critical
- Don't add features beyond task scope
- Don't refactor unrelated code
- Don't skip documentation if task requires it
- Don't forget to mark task as done (Step 10) before pushing
- Don't ignore "CRITICAL" notes in task description
- Don't combine implementation and task status into one commit - keep them separate
