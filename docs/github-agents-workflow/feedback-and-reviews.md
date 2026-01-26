# Feedback and Reviews

This document explains the feedback loop mechanics, clarification questions, rejection handling, and review best practices for the GitHub agents workflow.

## Overview

The agents workflow includes multiple feedback loops to ensure quality and clarity:

1. **Clarification Flow** - Agent asks questions before starting work
2. **Design Review** - Admin reviews and approves/rejects design PRs
3. **Implementation Review** - Admin reviews code changes via PR review agent
4. **Feedback Integration** - Agent incorporates feedback and creates updated PRs

## Agent Clarification Flow

When an issue description is unclear or incomplete, agents can request clarification before starting work.

### When Clarification Happens

**Product Design Agent:**
- Missing user personas or target audience
- Unclear feature requirements
- Ambiguous UI/UX expectations
- Missing acceptance criteria

**Tech Design Agent:**
- Unclear technical constraints
- Ambiguous integration requirements
- Missing performance requirements
- Unclear data model requirements

**Implementation Agent:**
- Ambiguous implementation details
- Missing edge case handling
- Unclear testing requirements
- Conflicting requirements

### Clarification Process

**1. Agent Detection**
- Agent analyzes issue description
- Identifies gaps or ambiguities
- Decides if work can proceed or clarification needed

**2. Clarification Request**
- Agent posts GitHub comment with questions
- Uses structured format with numbered questions
- Adds label: `needs-clarification`
- Sends Telegram notification to admin

**3. Admin Response**
- Admin answers questions in GitHub comment
- Removes `needs-clarification` label
- Agent monitors for label removal

**4. Agent Resumes**
- Agent reads admin's answers
- Incorporates clarifications into design/implementation
- Proceeds with normal workflow

### Example Clarification Flow

**Issue #45: Add search functionality**

**Agent Comment:**
```markdown
I need clarification on the following points before proceeding with the design:

1. **Search scope**: Should search include only task titles, or also descriptions, tags, and comments?

2. **Search type**: Should this be:
   - Simple text matching
   - Fuzzy search (handles typos)
   - Advanced search with filters (date, status, assignee)

3. **Performance**: Expected dataset size? (affects indexing strategy)

4. **UI placement**: Should search be:
   - In header (global)
   - In task list view (filtered)
   - Both

Please answer these questions and remove the `needs-clarification` label.
```

**Admin Response:**
```markdown
1. Search should include titles and descriptions, not tags/comments initially
2. Start with simple text matching, we can add fuzzy search later
3. Dataset will be under 10,000 tasks per user
4. Search in task list view only for now
```

**Agent Action:**
- Reads responses
- Updates design document with clarifications
- Creates PR with design

### Clarification Best Practices

**For Agents:**
- Ask specific, numbered questions
- Provide context for each question
- Suggest options when applicable
- Keep questions concise and focused

**For Admins:**
- Answer all questions clearly
- Use numbered responses matching questions
- Provide examples when helpful
- Remove `needs-clarification` label when done

## Handling Feedback Loops

Feedback loops occur when an admin rejects a design or requests changes to an implementation.

### Design Review Feedback Loop

**Scenario:** Admin rejects product or tech design PR

**Flow:**

**1. Admin Rejects Design**
- Via Telegram "Reject" button
- Or directly in GitHub PR (Request Changes)
- **MUST include explanation in PR comment**

**2. Status Update**
- Issue status → "Rejected"
- Rejection reason stored in MongoDB
- GitHub comment added explaining rejection

**3. Admin Reviews and Edits**
- **Option A: Admin fixes design directly**
  - Edit design file in PR branch
  - Commit changes to same PR
  - Approve PR via Telegram or GitHub
  - PR auto-merges → status advances

- **Option B: Request agent revision**
  - Comment on PR with specific feedback
  - Remove "Rejected" label, add "needs-revision"
  - Agent creates new PR with updated design

**4. New PR Review**
- Admin reviews updated design
- Approves → design advances to next phase
- Rejects → cycle repeats (rare)

### Implementation Review Feedback Loop

**Scenario:** PR review agent or admin finds issues in code

**Flow:**

**1. Issues Identified**
- PR review agent posts review comments
- Or admin manually reviews PR
- Sets Review Status = "Changes Requested"

**2. Admin Decision via Telegram**
- **Merge** button: Squash merge with saved commit message
- **Request Changes** button: Send back to agent

**3. Request Changes Path**
- Admin MUST comment on PR explaining changes needed
- Issue status remains in "PR Review"
- Agent monitors for new comments

**4. Agent Response**
- Agent reads admin's feedback comments
- Incorporates changes into code
- Pushes updates to same PR
- Comments on PR summarizing changes
- Sets Review Status back to "Waiting for Review"

**5. Re-review**
- PR review agent reviews updated code
- Or admin manually reviews
- Approves → ready for merge
- More changes needed → cycle repeats

### Multi-Phase Feedback

For multi-phase features (L/XL complexity), feedback is **phase-specific**.

**Phase Implementation:**
- Each phase has independent PR
- Feedback applies only to current phase
- Previous phases already merged (immutable)

**Phase Review:**
- PR review agent verifies phase scope
- Ensures PR doesn't include future phase code
- Checks phase completion criteria

**Cross-Phase Issues:**
- If phase N reveals issues in merged phase N-1:
  - Create new issue for fix
  - Or note for future refactoring
  - Don't reopen previous phase

## Rejection Handling

### When to Reject

**Product Design Rejection:**
- Design doesn't match requirements
- UX/UI patterns inconsistent with app
- Missing critical user flows
- Scope creep beyond original issue

**Tech Design Rejection:**
- Architecture doesn't fit existing system
- Performance concerns not addressed
- Security vulnerabilities in approach
- Over-engineered or under-engineered solution

**Implementation Rejection:**
- Code doesn't follow project guidelines
- Tests missing or inadequate
- Breaking changes without migration plan
- Performance regressions

### Rejection Process

**1. Reject with Clear Explanation**
```markdown
I'm rejecting this design because:

1. **Authentication flow is incomplete**: The design doesn't address session timeout or token refresh.

2. **State management approach conflicts with existing patterns**: This uses Context API, but we standardized on Zustand for client state.

3. **Missing error handling**: No design for error states (network failures, validation errors).

Please revise the design to address these issues.
```

**2. Rejection via Telegram**
- Click "Reject" button on Telegram notification
- **CRITICAL**: Must add explanation comment to PR
- System updates GitHub status automatically

**3. Rejection via GitHub**
- Request Changes in PR review
- Add detailed comments on specific issues
- System detects review status change

**4. Agent Next Steps**
- For design PRs: Agent creates new PR with revisions (if `needs-revision` label)
- For implementation PRs: Agent updates same PR with fixes
- Status remains in current phase until approved

### Rejection Best Practices

**Be Specific:**
- ❌ "This doesn't look right"
- ✅ "The authentication flow is incomplete - missing session timeout handling"

**Provide Context:**
- ❌ "Wrong approach"
- ✅ "This uses Context API, but we standardized on Zustand for client state (see docs/state-management.md)"

**Suggest Solutions:**
- ❌ "Error handling is wrong"
- ✅ "Add error handling using our standard ErrorBoundary pattern (see src/client/components/ErrorBoundary.tsx)"

**Reference Examples:**
- ❌ "Follow existing patterns"
- ✅ "Follow the pattern used in src/client/features/auth/store.ts for state management"

## Writing Effective Review Comments

Effective review comments help agents understand issues and incorporate feedback accurately.

### Comment Structure

**1. Identify the Issue**
- Be specific about what's wrong
- Reference line numbers or file paths
- Quote problematic code if helpful

**2. Explain Why It's Wrong**
- Reference project guidelines
- Explain impact (security, performance, maintainability)
- Link to relevant documentation

**3. Suggest Solution**
- Provide concrete example
- Reference existing code to follow
- Explain trade-offs if applicable

### Example Review Comments

**❌ Poor Comment:**
```markdown
This code is wrong and needs to be fixed.
```

**✅ Good Comment:**
```markdown
**Issue**: This mutation updates UI from server response instead of optimistically.

**Why**: Violates our offline-first pattern (see docs/offline-pwa-support.md). When offline, the UI won't update until back online.

**Solution**: Move the `queryClient.setQueryData` call to `onMutate`:

\`\`\`typescript
onMutate: async (vars) => {
  const previous = queryClient.getQueryData(['todos']);
  queryClient.setQueryData(['todos'], [...previous, vars]);
  return { previous };
},
onSuccess: () => {}, // EMPTY
\`\`\`

See example in `src/client/routes/Todos/hooks.ts:45-60`.
```

### Comment Categories

**Code Quality:**
```markdown
**Code Quality**: This component is 300 lines. Split into smaller components following our guideline of max 150 lines per component.

Suggested split:
- `TaskList.tsx` - List container (current file, ~80 lines)
- `TaskItem.tsx` - Individual task rendering (~100 lines)
- `TaskFilters.tsx` - Filter controls (~80 lines)
```

**Architecture:**
```markdown
**Architecture**: This creates a new API endpoint, but the functionality should use existing `todos/update` API.

Reason: Avoids code duplication and maintains single responsibility for todo updates.

Update: Add `markComplete` parameter to existing API instead of new endpoint.
```

**Guidelines Violation:**
```markdown
**Guidelines Violation**: Uses `any` type on line 45.

Our TypeScript guidelines (docs/typescript-guidelines.md) prohibit `any` types.

Fix: Define proper type based on API response:

\`\`\`typescript
interface TodoResponse {
  id: string;
  title: string;
  completed: boolean;
}
\`\`\`
```

**Testing:**
```markdown
**Testing**: Missing tests for edge cases.

Required tests:
1. Empty state (no todos)
2. Error state (API failure)
3. Loading state (before data loads)

Add tests following pattern in `src/client/routes/Todos/__tests__/TodoList.test.tsx`.
```

**Performance:**
```markdown
**Performance**: This query fetches all 10,000+ todos on every render.

Issue: No pagination or filtering, causing slow page loads.

Solution: Add pagination to API:
- Server: Limit to 50 items per page
- Client: Use `useInfiniteQuery` for scroll-to-load

See `src/client/routes/Users/hooks.ts` for pagination example.
```

### Review Comment Checklist

Before submitting review:

- [ ] Issue clearly identified with specific examples
- [ ] Explanation includes why it's problematic
- [ ] Solution provided with code examples
- [ ] References to docs or existing code included
- [ ] Tone is constructive and educational
- [ ] All critical issues addressed
- [ ] Nice-to-have improvements marked as optional

## Feedback Loop Best Practices

### For Admins

**1. Review Promptly**
- Faster feedback = faster iteration
- Agents are blocked while waiting for review
- Set up Telegram notifications for immediate alerts

**2. Be Thorough But Focused**
- Address all critical issues in one review
- Avoid nitpicking minor style issues
- Focus on functionality, architecture, guidelines

**3. Provide Context**
- Explain reasoning behind feedback
- Link to relevant documentation
- Reference existing code examples

**4. Balance Speed and Quality**
- Minor issues: Approve and create follow-up issue
- Major issues: Request changes with detailed feedback
- Critical issues: Reject with clear explanation

### For Agents (Guidelines)

**1. Read Feedback Carefully**
- Address all points raised
- Don't assume or extrapolate beyond feedback
- Ask for clarification if feedback is unclear

**2. Incorporate Feedback Accurately**
- Make exact changes requested
- Don't introduce unrelated changes
- Test changes thoroughly

**3. Document Changes**
- Comment on PR explaining what was changed
- Reference admin's feedback comments
- Highlight any trade-offs or concerns

**4. Learn from Feedback**
- Use feedback to improve future work
- Update understanding of project guidelines
- Apply lessons to similar situations

## Summary

**Clarification Flow:**
- Agent asks questions before starting
- Admin answers in GitHub comment
- Agent incorporates answers into work

**Design Feedback:**
- Admin reviews design PR
- Rejects with explanation → agent revises
- Approves → advances to next phase

**Implementation Feedback:**
- PR review agent or admin finds issues
- Admin requests changes with detailed comments
- Agent updates PR → re-review cycle

**Effective Reviews:**
- Be specific with examples
- Explain why it's wrong
- Suggest concrete solutions
- Reference docs and existing code

**See also:**
- [Running Agents](./running-agents.md) - How to run agents and view logs
- [Telegram Integration](./telegram-integration.md) - Telegram notifications and quick actions
