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

**2. Agent Structured Output**
- Agent sets `needsClarification: true` in structured output
- Agent provides structured `clarification` object with:
  - `context`: What's ambiguous and why clarification is needed
  - `question`: The specific question being asked
  - `options`: Array of options (2-4) with labels, descriptions, and `isRecommended` flags
  - `recommendation`: Why the agent recommends a specific option
- Agent leaves other output fields empty (design, comment, etc.)

**3. System Handling**
- System detects `needsClarification=true` flag
- Formats structured clarification data as markdown
- Posts clarification question as GitHub issue comment
- Sets Review Status to "Waiting for Clarification"
- Sends Telegram notification with "ANSWER QUESTIONS" button

**4. Admin Response (Two Options)**

**Option A: Interactive Web UI (Recommended)**
- Click "ANSWER QUESTIONS" button in Telegram
- Opens dedicated clarification page (`/clarify/:issueNumber`)
- Select from pre-defined options or provide custom answer
- Submit → answer posted to GitHub, status updated automatically

**Option B: Manual GitHub Comment**
- Click "View Issue" to open GitHub
- Add comment with your answer
- Click "Clarification Received" button in Telegram
- Status updates to "Clarification Received"

**5. Agent Resumes**
- Agent reads admin's answers
- Incorporates clarifications into design/implementation
- Proceeds with normal workflow

### Interactive Clarification UI

The clarification page (`/clarify/:issueNumber?token=...`) provides a wizard-style interface for answering agent questions.

**Wizard Flow:**
1. **One question at a time** - Focused view, less overwhelming
2. **Progress indicator** - Dots showing current position and answered questions
3. **Back/Next navigation** - Step through questions freely
4. **Preview step** - Review all answers before submitting
5. **Edit capability** - Click pencil icon or progress dots to change any answer

**Features:**
- **Structured Questions**: Parsed from agent's comment with collapsible context
- **Radio Options**: Pre-defined choices with emoji indicators (✅ recommended, ⚠️ alternatives)
- **Option Details**: Bullet points showing pros/cons for each option
- **Recommendation Banner**: Agent's recommendation highlighted with reasoning
- **"Other" Option**: Text area for completely custom responses
- **Additional Notes**: Optional notes field for any answer (adds context without changing selection)
- **Mobile-Optimized**: Full-screen layout, touch-friendly, fixed bottom navigation

**URL Format:**
```
https://your-app.vercel.app/clarify/45?token=abc123
```

**Route Configuration:**
- Path: `/clarify/:issueNumber`
- Public route (no authentication required)
- Full-screen mode (no header/navbar)

**Security:**
- Token-based access (8-char SHA256 hash of issue number + JWT_SECRET)
- Token validated server-side before showing data or accepting submissions
- Submissions only allowed when issue is in "Waiting for Clarification" status

### Example Clarification Flow

**Issue #45: Add search functionality**

**Agent Structured Output:**
```json
{
  "needsClarification": true,
  "clarification": {
    "context": "The feature request asks for 'search functionality' but doesn't specify the scope or type of notifications to send when search results change.",
    "question": "What notification channels should be supported initially?",
    "options": [
      {
        "label": "Email only",
        "description": "Send notifications via email.\n- Simpler to implement\n- Most users have email configured\n- No additional infrastructure needed",
        "isRecommended": true
      },
      {
        "label": "Email + Push notifications",
        "description": "Send via both email and browser push notifications.\n- More complex, requires service worker\n- Better UX for time-sensitive alerts\n- Requires user opt-in for push",
        "isRecommended": false
      },
      {
        "label": "In-app only",
        "description": "Show notifications only within the app.\n- Simplest to implement\n- Users must be in app to see them\n- No external dependencies",
        "isRecommended": false
      }
    ],
    "recommendation": "I recommend 'Email only' because it provides reliable delivery with minimal complexity. We can add push notifications in a future iteration."
  },
  "design": "",
  "comment": ""
}
```

**System Posts to GitHub Issue:**
```markdown
## 🤔 Agent Needs Clarification

## Context
The feature request asks for "search functionality" but doesn't specify the scope or type.

## Question
What notification channels should be supported initially?

## Options

✅ Option 1: Email only
   - Simpler to implement
   - Most users have email configured

⚠️ Option 2: Email + Push notifications
   - More complex, requires service worker
   - Better UX for time-sensitive alerts

⚠️ Option 3: In-app only
   - Simplest to implement
   - Users must be in app to see them

## Recommendation
I recommend Option 1 because it provides reliable delivery with minimal complexity.

---
_Please respond with your answer in a comment below, then click "Clarification Received" in Telegram._
```

**Telegram Notification:**
```
🤔 Agent Needs Clarification

Phase: Tech Design
✨ Feature

📋 Add search functionality
🔗 Issue #45

[💬 ANSWER QUESTIONS]
[📋 View Issue]
[✅ Clarification Received]
```

**Admin clicks "ANSWER QUESTIONS":**
- Opens wizard UI showing first question
- Progress dots show "Question 1 of 1"
- Selects "Option 1: Email only"
- Optionally clicks "+ Add additional notes" to provide context
- Clicks "Next" → sees Preview step
- Reviews answer, can click pencil to edit
- Clicks "Submit Answers"

**Answer Posted to GitHub:**
```markdown
## ✅ Clarification Provided

**Question:** What notification channels should be supported initially?

**Answer:** Email only

**Additional notes:** Start simple, we can add push notifications in v2.

---
_Clarification provided via interactive UI. Continue with the selected option(s)._
```

**Result:**
- Comment posted to GitHub with structured Q/A format
- Review Status → "Clarification Received"
- Agent continues on next workflow run with clear answer

### Clarification Best Practices

**For Agents:**
- Set `needsClarification: true` when clarification is needed
- **REQUIRED**: Provide structured `clarification` object (string format not supported)
- Include all required fields: `context`, `question`, `options`, `recommendation`
- Provide 2-4 options with clear labels and descriptions
- Set `isRecommended: true` on exactly ONE option
- Use `\n` for newlines in description text (for bullet points)
- Leave other output fields empty (design, comment, etc.)
- Keep questions specific and focused

**Clarification Object Schema (Required):**
```typescript
{
  needsClarification: true,
  clarification: {
    context: string;        // What's ambiguous and why
    question: string;       // The specific question
    options: [              // 2-4 options (non-empty array required)
      {
        label: string;        // Short option name
        description: string;  // Details with \n for bullets
        isRecommended: boolean;
      }
    ];
    recommendation: string; // Why you recommend the option
  },
  design: "",              // Leave empty
  comment: ""              // Leave empty
}
```

**Error Handling:**
The system will throw errors if agents use incorrect format:
- Using legacy `clarificationRequest` string → Error with migration instructions
- Missing required fields in `clarification` object → Error listing missing fields
- `needsClarification: true` without `clarification` object → Error with required format

**For Admins:**
- Use the interactive UI when possible (faster, less error-prone)
- If using manual comment, be specific and clear
- Provide examples when helpful
- Don't forget to mark "Clarification Received" if using manual flow

## Handling Feedback Loops

Feedback loops occur when an admin rejects a design or requests changes to an implementation.

### Design Review Feedback Loop

The product design agent uses a **2-phase flow**:

**Phase 1** (new items → Waiting for Decision):
- Agent creates 2-3 interactive React mock options (no design doc yet)
- Admin selects an option → reviewStatus set to `Decision Submitted`

**Phase 2** (Decision Submitted → Waiting for Review):
- Agent reads the chosen option, writes a full design document
- Admin approves or requests changes

**Other modes:**
- **Feedback** — Admin requests changes on Phase 2 design doc, agent revises
- **Clarification Needed** — Agent needs more info, admin answers, agent continues

All actions work identically through Telegram or the Workflow UI — the business logic lives in the workflow service layer.

**Request Changes Flow (on Phase 2 design doc):**

1. Admin clicks "Request Changes" (via Telegram or UI)
2. Review Status → "Request Changes" (5-minute undo window)
3. Admin adds feedback comments on the GitHub issue
4. On next agent run, agent detects feedback mode
5. Agent reads existing design + feedback, revises design
6. Updates same PR, posts "Addressed Feedback" marker
7. Review Status → "Waiting for Review"
8. Admin receives new notification to approve or request more changes

**Design Option Selection Flow (Phase 1 → Phase 2):**

1. Phase 1: Agent generates 2-3 React mock pages in `src/pages/design-mocks/`
2. Mock pages are committed to the design PR branch
3. Decision comment posted on issue with option metadata
4. Review Status → "Waiting for Decision"
5. Admin selects option via "Choose Recommended" (Telegram) or web UI (`/decision/{issueNumber}`)
6. Review Status → "Decision Submitted" (item stays in Product Design)
7. Phase 2: Agent reads chosen option from DB, writes full design document
8. Review Status → "Waiting for Review"

**Approval Flow (after Phase 2):**

1. Admin approves design (via Telegram or UI)
2. Design content read from S3 (saved by Phase 2 agent)
3. Artifact comment updated on issue
4. Status advances to Technical Design
5. Design PR stays open (NOT merged) — closed when feature reaches Done

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

## Reverting Merged PRs

Sometimes a merged PR needs to be reverted due to issues discovered after deployment. The workflow provides a one-click revert option.

### When to Use Revert

- Bug discovered after merging to main
- Feature behavior doesn't match expectations
- Performance regression detected
- Breaking change affects other functionality

### Revert Process

**1. Click Revert Button**

After merging a PR, you receive a success notification with a "Revert" button:

```
✅ PR Merged Successfully

📝 PR: #124 - Add search functionality
🔗 Issue: #45 - Add search functionality

🎉 Implementation complete! Issue is now Done.

[📄 View PR] [📋 View Issue]
[↩️ Revert]
```

**2. Revert Creates Recovery PR**

Clicking "Revert" does NOT directly push to main. Instead:
- Creates a new branch with the revert commit
- Opens a new PR (e.g., #125) for the revert
- Restores issue status to "Implementation" with "Request Changes" review status
- For multi-phase features, restores the phase counter

**3. Confirmation with Next Steps**

```
↩️ Merge Reverted

📋 Issue: #45 - Add search functionality
🔀 Original PR: #124
🔄 Revert PR: #125

📊 Status: Implementation
📝 Review Status: Request Changes

Next steps:
1️⃣ Click "Merge Revert PR" below to undo the changes
2️⃣ Go to Issue #45 and add a comment explaining what went wrong
3️⃣ Run `yarn agent:implement` - the agent will read your feedback and create a new PR

[✅ Merge Revert PR]
[📄 View Revert PR] [📋 View Issue]
```

**4. Merge Revert PR**

Click "Merge Revert PR" to complete the revert. Changes are now undone on main.

**5. Provide Feedback on Issue**

Add a comment to the **issue** (not PR) explaining what went wrong. The implementation agent reads issue comments when starting work.

Example feedback comment:
```markdown
The search feature has an issue:

1. Search results don't update when the filter changes
2. Performance is slow with more than 100 items
3. Search doesn't work in offline mode

Please fix these issues and ensure search works offline.
```

**6. Agent Creates New PR**

Run `yarn agent:implement` - the agent will:
- Read your feedback from the issue comments
- Understand what went wrong
- Create a new implementation PR addressing the issues

### Revert Best Practices

**Provide Clear Feedback:**
- Explain what went wrong specifically
- Include reproduction steps if applicable
- Reference any error messages or logs

**Use Issue Comments:**
- Comment on the **issue** (not the PR)
- Agent reads issue comments for context
- Previous PR context is still available

**Multi-Phase Features:**
- Revert affects only the current phase
- Previous phases remain merged
- Phase counter is restored to current phase

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

**Reverting Merged PRs:**
- Click "Revert" on merge success notification
- Creates revert PR (not direct push to main)
- Add feedback to issue explaining what went wrong
- Agent reads feedback and creates new PR

**Effective Reviews:**
- Be specific with examples
- Explain why it's wrong
- Suggest concrete solutions
- Reference docs and existing code

**See also:**
- [Running Agents](./running-agents.md) - How to run agents and view logs
- [Telegram Integration](./telegram-integration.md) - Telegram notifications and quick actions
