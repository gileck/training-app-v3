# Task Format Specification

This document defines the standardized markdown format for tasks in `tasks.md`.

## Format Overview

Each task follows this structure:

```markdown
## N. Task Title

| Priority | Complexity | Size | Status |
|----------|------------|------|--------|
| **[Priority]** | [Complexity] | [Size] | [Status] |

**Date Added:** YYYY-MM-DD
**Date Updated:** YYYY-MM-DD _(Optional, only when task is modified)_

**Summary:** Brief one-sentence description of the task.

**Details:** _(Optional)_
Detailed description, context, problem statement, or background.

**Implementation Notes:** _(Optional)_
Technical details, code snippets, API references, or implementation approach.

**Files to Modify:**
- `path/to/file.ts` - What needs to change
- `path/to/another.ts` - What needs to change

**Dependencies:** _(Optional)_
- Task #N must be completed first
- Requires feature X to be deployed

**Risks/Blockers:** _(Optional)_
- Potential issue that could delay or block this task
- Known challenges or unknowns

**Notes:** _(Optional)_
- Additional context or comments
- Historical information about decisions made
```

## Field Definitions

### Required Fields

#### 1. Number (N)
- **Format:** Sequential integer starting from 1
- **Rules:** Never reuse numbers, even for deleted tasks
- **Example:** `## 1. Task Title`

#### 2. Title
- **Format:** Clear, actionable title in imperative form
- **Rules:**
  - Start with verb when possible: "Add", "Fix", "Refactor", "Update"
  - Keep concise (< 60 characters)
  - For completed tasks: use strikethrough `~~Title~~` and append `✅ DONE`
- **Examples:**
  - Active: `## 5. Add User Authentication`
  - Done: `## 3. ~~Fix Login Bug~~ ✅ DONE`

#### 3. Priority
- **Options:** `Critical`, `High`, `Medium`, `Low`
- **Format:** Bold in table: `**Critical**`
- **Definitions:**
  - **Critical:** Blocks other work, production issue, or security vulnerability
  - **High:** Important for current milestone, impacts user experience
  - **Medium:** Should be done soon, but not urgent
  - **Low:** Nice to have, can be deferred

#### 4. Complexity
- **Options:** `Low`, `Medium`, `High`
- **Format:** Plain text in table
- **Definitions:**
  - **Low:** Straightforward, well-understood, minimal unknowns
  - **Medium:** Some complexity, may require design decisions
  - **High:** Complex problem, significant unknowns, architectural impact

#### 5. Size
- **Options:** `XS`, `S`, `M`, `L`, `XL`
- **Format:** Plain text in table
- **Definitions:**
  - **XS:** < 1 hour, 1-2 files, < 50 lines changed
  - **S:** 1-4 hours, 2-5 files, 50-100 lines changed
  - **M:** 4-8 hours, 5-15 files, 100-500 lines changed
  - **L:** 1-3 days, 15-30 files, 500-1000 lines changed
  - **XL:** 3+ days, 30+ files, 1000+ lines changed

#### 6. Status
- **Options:** `TODO`, `In Progress`, `Blocked`, `✅ DONE`
- **Format:**
  - Active tasks: plain text
  - Done tasks: `✅ **DONE**` in bold
- **Definitions:**
  - **TODO:** Not started, ready to work on
  - **In Progress:** Currently being worked on
  - **Blocked:** Cannot proceed due to dependency or issue
  - **✅ DONE:** Completed and verified

#### 7. Date Added
- **Format:** `**Date Added:** YYYY-MM-DD`
- **Rules:** Required for all tasks
- **Example:** `**Date Added:** 2026-01-24`

#### 8. Summary
- **Format:** `**Summary:** One clear sentence describing what needs to be done.`
- **Rules:**
  - Must be one sentence
  - Describe the problem or desired outcome
  - Should be understandable without reading full details

### Optional Fields

#### 9. Date Updated
- **Format:** `**Date Updated:** YYYY-MM-DD`
- **When to use:** Add this field when task is significantly modified (not for typo fixes)
- **Example:** `**Date Updated:** 2026-01-25`

#### 10. Details
- **Format:** `**Details:** [Multi-paragraph explanation]`
- **When to use:** When summary isn't sufficient for full context
- **Content:** Problem statement, background, user impact, current state

#### 11. Implementation Notes
- **Format:** `**Implementation Notes:** [Technical details]`
- **When to use:** When you have specific technical approach or code examples
- **Content:** Code snippets, API references, technical decisions, approach

#### 12. Files to Modify
- **Format:** Bulleted list with file paths and descriptions
- **When to use:** When you know which files need changes
- **Example:**
  ```markdown
  **Files to Modify:**
  - `src/client/features/auth/store.ts` - Add new authentication state
  - `src/apis/auth/handlers/login.ts` - Implement login validation
  ```

#### 13. Dependencies
- **Format:** `**Dependencies:** [Bulleted list]`
- **When to use:** When task depends on other tasks or external factors
- **Example:**
  ```markdown
  **Dependencies:**
  - Task #5 must be completed first
  - Requires MongoDB migration to be deployed
  ```

#### 14. Risks/Blockers
- **Format:** `**Risks/Blockers:** [Bulleted list]`
- **When to use:** When there are known challenges or potential issues
- **Example:**
  ```markdown
  **Risks/Blockers:**
  - API may have rate limits that affect implementation
  - Unclear if this approach works on Safari iOS
  ```

#### 15. Notes
- **Format:** `**Notes:** [Free-form text]`
- **When to use:** For additional context that doesn't fit elsewhere
- **Content:** Historical decisions, alternative approaches considered, links to discussions

## Completed Tasks

When marking a task as done:

1. **Update title:** Add strikethrough and done marker
   ```markdown
   ## 3. ~~Task Title~~ ✅ DONE
   ```

2. **Update status in table:** `✅ **DONE**`

3. **Add completion info after table:**
   ```markdown
   > **Completed:** YYYY-MM-DD - Brief note about completion (commit hash, PR number, etc.)
   ```

4. **Optional: Add implementation notes if different from plan:**
   ```markdown
   > **Implementation Note:** Implemented differently than originally proposed - [explanation]
   ```

## Complete Example

```markdown
## 7. Add Dark Mode Support

| Priority | Complexity | Size | Status |
|----------|------------|------|--------|
| **High** | Medium | M | In Progress |

**Date Added:** 2026-01-20
**Date Updated:** 2026-01-24

**Summary:** Add dark mode theme toggle with persistent user preference and semantic color tokens.

**Details:**
Users have requested dark mode support for better viewing in low-light environments. The implementation should use semantic color tokens defined in the theming system and persist the user's choice across sessions.

**Implementation Notes:**
- Use existing theming infrastructure with `next-themes`
- All colors must use semantic tokens (no hardcoded colors)
- Preference stored in localStorage via settings store
- Should respect system preference on first visit

**Files to Modify:**
- `src/client/features/settings/store.ts` - Add theme preference
- `src/client/components/layout/Header.tsx` - Add theme toggle button
- `tailwind.config.ts` - Verify dark mode color definitions

**Dependencies:**
- Requires Task #6 (Settings UI) to be completed first

**Risks/Blockers:**
- Some third-party components may not support dark mode
- Need to audit all custom colors to ensure they use semantic tokens

**Notes:**
Originally considered adding auto-schedule (dark at night, light during day) but decided to keep it simple with manual toggle for v1.
```

## Task Ordering

Tasks in `tasks.md` should be ordered by:
1. **Primary:** Priority (Critical → High → Medium → Low)
2. **Secondary:** Date Added (oldest first within each priority)
3. **Completed tasks:** Move to bottom of file, separated by `---`

## Adding New Tasks

When adding a new task:

1. Assign the next sequential number
2. Fill in all required fields
3. Place it in the correct priority section
4. Run `yarn task list` to verify formatting

## Modifying Existing Tasks

When modifying a task:

1. Update relevant fields
2. Add/update `**Date Updated:**` field
3. If changing priority, move to correct section
4. Add note in `**Notes:**` explaining major changes

## Validation

Use `/task-list` slash command or `yarn task list` to verify:
- All required fields are present
- Tasks are ordered correctly
- Status values are valid
- Dates are in correct format
