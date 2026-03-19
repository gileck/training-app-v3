# Task 42: Create Bug Investigator Agent for GitHub Workflow - Implementation Plan

## Objective

Create a read-only bug-investigator agent that investigates bug root causes, outputs investigation summaries with multiple fix options to GitHub issues, and integrates with the existing GitHub agents workflow. This agent will provide an intermediate step between bug submission and technical design, giving admins choice over fix complexity before proceeding.

## Approach

The Bug Investigator Agent will follow the established patterns from existing agents (technicalDesignAgent, implementAgent), with these key differentiators:

1. **Read-only operation**: Uses only `Read`, `Glob`, `Grep`, `WebFetch` tools (similar to the existing `scripts/template/investigate-bugs.ts` reference implementation)
2. **Multiple fix options**: Outputs structured investigation results with quick fix, standard fix, and full refactor options
3. **Issue-centric output**: Posts investigation summary directly to GitHub issue comments (not MongoDB like the reference implementation)
4. **Admin choice workflow**: Integrates with clarification flow for admin to choose fix option
5. **Iterative investigation**: Supports requesting additional logs when root cause cannot be determined

### Key Architectural Decisions

1. **New GitHub Project status column**: Recommend adding "Bug Investigation" status between "Backlog" and "Technical Design" (or "Ready for development" for simple fixes)
2. **Clarification flow for option selection**: Reuse existing clarification infrastructure for admin to select fix option
3. **Read-only enforcement**: Agent will NOT create PRs for logging - this deviates from the open question in the task. Adding logging should be handled by the implementation agent after admin chooses an option.
4. **New agent identity**: Add "bug-investigator" to the AgentName type with appropriate emoji (e.g., "🔍")

## Sub-tasks

### Phase 1: Core Agent Infrastructure

- [ ] **1.1** Create new agent directory structure at `src/agents/core-agents/bugInvestigatorAgent/`
- [ ] **1.2** Define output schema for bug investigation in `src/agents/shared/output-schemas.ts`:
  - `BugInvestigationOutput` interface with:
    - `rootCauseFound: boolean`
    - `confidence: 'low' | 'medium' | 'high'`
    - `rootCauseAnalysis: string`
    - `fixOptions: FixOption[]` (array with complexity levels)
    - `filesExamined: string[]`
    - `additionalLogsNeeded?: string` (optional request for more logs)
    - `needsClarification?: boolean` (to trigger option selection)
    - `clarification?: StructuredClarification`

- [ ] **1.3** Add agent identity "bug-investigator" to `src/agents/shared/agent-identity.ts`

### Phase 2: Prompts

- [ ] **2.1** Create `src/agents/shared/prompts/bug-investigation.ts` with:
  - `buildBugInvestigationPrompt()` - Initial investigation prompt
  - `buildBugInvestigationClarificationPrompt()` - Continue after admin clarification
  - `buildBugInvestigationRevisionPrompt()` - Revise based on feedback

- [ ] **2.2** Update `src/agents/shared/prompts/index.ts` to export new prompt builders

### Phase 3: Agent Implementation

- [ ] **3.1** Create main agent file at `src/agents/core-agents/bugInvestigatorAgent/index.ts`:
  - Follow existing agent patterns (technicalDesignAgent structure)
  - Process items in "Bug Investigation" status
  - Support modes: 'new', 'feedback', 'clarification'
  - Use `runAgent()` with read-only tools only
  - Post investigation summary to GitHub issue
  - Present fix options via clarification flow
  - Set Review Status appropriately

### Phase 4: Workflow Integration

- [ ] **4.1** Update `src/agents/auto-advance.ts`:
  - Add "Bug Investigation" to `STATUS_TRANSITIONS`
  - When approved, route to:
    - Tech Design (for complex fixes)
    - Ready for development (for simple fixes)
    - Based on admin's chosen option

- [ ] **4.2** Update `src/agents/index.ts`:
  - Add bug-investigator to SCRIPTS
  - Add to ALL_ORDER if appropriate

- [ ] **4.3** Add Telegram notification for bug investigation in `src/agents/shared/notifications.ts`:
  - `notifyBugInvestigationReady()` - Investigation complete, choose fix option
  - Accepts `commentId` to build direct link to investigation comment
  - URL buttons only (no callback buttons except Request Changes):
    - "View Full Investigation" → GitHub comment URL
    - "Choose Fix Option" → `/bug-fix/:issueNumber` UI route
    - "Request Changes" → callback button (back to investigator)

- [ ] **4.4** Create Bug Fix Selection UI route at `src/client/routes/BugFix/`:
  - New route `/bug-fix/:issueNumber`
  - Display: root cause summary, confidence level
  - Radio buttons for fix options (from agent output)
  - Optional free text for custom solution
  - Destination selector (if custom solution provided)
  - Submit button
  - Share UI components with clarification flow where possible

- [ ] **4.5** Create Bug Fix Selection webhook at `src/pages/api/bug-fix-select.ts`:
  - Handle form submission from UI
  - Post decision comment to GitHub issue (with HTML markers)
  - Update item status based on destination (Tech Design or Ready)
  - Clear Review Status
  - Share logic with clarification webhook where possible

- [ ] **4.6** Add Request Changes handler in `src/server/webhooks/telegram-webhook.ts`:
  - Handle `bug_investigate_changes:{issueNumber}` callback
  - Set Review Status back to "Request Changes"

### Phase 5: Configuration

- [ ] **5.1** Update `src/server/template/project-management/config.ts`:
  - Add `bugInvestigation: 'Bug Investigation'` to STATUSES

- [ ] **5.2** Update `src/agents/shared/index.ts`:
  - Export new bug investigation prompts
  - Export new output schema

### Phase 6: Clean Up Tech Design Agent (Remove Bug Handling)

**Important:** The tech-design agent currently handles bugs. With the new bug-investigator agent, ALL bug-related code should be removed from tech-design. The tech-design agent is for technical design ONLY.

- [ ] **6.1** Remove bug-related code from `src/agents/core-agents/technicalDesignAgent/index.ts`:
  - Remove `getBugDiagnostics` import and usage
  - Remove `buildBugTechDesignPrompt` and `buildBugTechDesignRevisionPrompt` imports
  - Remove `issueType === 'bug'` checks and branches
  - Remove diagnostics loading logic
  - Remove bug warning Telegram notifications
  - Simplify to feature-only technical design

- [ ] **6.2** Update `src/agents/core-agents/technicalDesignAgent/AGENTS.md`:
  - Remove all bug-related documentation
  - Update to indicate features-only scope

- [ ] **6.3** Remove or repurpose `src/agents/shared/prompts/bug-fix.ts`:
  - Move relevant investigation logic to new `bug-investigation.ts`
  - Delete the file if no longer needed
  - Update `src/agents/shared/prompts/index.ts` exports

- [ ] **6.4** Update `src/agents/shared/utils.ts`:
  - Remove `getBugDiagnostics()` function (or move to bug-investigator)
  - Remove `getIssueType()` if only used for bug detection

### Phase 7: Documentation

- [ ] **7.1** Create comprehensive bug investigation docs at `docs/template/github-agents-workflow/bug-investigation.md`:
  - Full E2E flow with diagrams
  - Agent structured output schema
  - Fix options format and recommended 3 levels
  - GitHub comments pattern (summary + decision)
  - Bug Fix Selection UI usage guide
  - Telegram notification format
  - How downstream agents consume the context
  - Custom solution flow
  - Request changes flow
  - Examples of different bug scenarios

- [ ] **7.2** Update `docs/template/github-agents-workflow/overview.md`:
  - Add Bug Investigation to workflow diagram
  - Link to new bug-investigation.md
  - Clarify that tech-design is features-only now
  - Update status column descriptions

- [ ] **7.3** Update `docs/template/github-agents-workflow/setup-guide.md`:
  - Add "Bug Investigation" GitHub Project column setup
  - Document new UI route `/bug-fix/:issueNumber`

- [ ] **7.4** Add inline code documentation:
  - JSDoc comments on all new functions
  - README in `src/agents/core-agents/bugInvestigatorAgent/`
  - Comments explaining shared code patterns with clarification flow

## Files to Modify

### New Files
- `src/agents/core-agents/bugInvestigatorAgent/index.ts` - Main agent implementation
- `src/agents/shared/prompts/bug-investigation.ts` - Investigation prompt builders

### Modified Files
- `src/agents/shared/output-schemas.ts` - Add BugInvestigationOutput and BUG_INVESTIGATION_OUTPUT_FORMAT
- `src/agents/shared/agent-identity.ts` - Add 'bug-investigator' to AgentName type
- `src/agents/shared/prompts/index.ts` - Export bug investigation prompts, remove bug-fix exports
- `src/agents/shared/index.ts` - Export new types and prompts
- `src/agents/shared/notifications.ts` - Add notifyBugInvestigationReady()
- `src/agents/auto-advance.ts` - Add Bug Investigation status transitions
- `src/agents/index.ts` - Register bug-investigator in SCRIPTS
- `src/server/template/project-management/config.ts` - Add bugInvestigation status
- `src/server/webhooks/telegram-webhook.ts` - Add Request Changes handler for bug investigation
- `src/client/routes/index.ts` - Add /bug-fix/:issueNumber route

### New UI & API Files
- `src/client/routes/BugFix/index.tsx` - Bug Fix Selection UI page
- `src/client/routes/BugFix/components/` - UI components (share with clarify where possible)
- `src/pages/api/bug-fix-select.ts` - Webhook for fix selection submission

### Documentation Files
- `docs/template/github-agents-workflow/overview.md` - Update workflow overview
- `docs/template/github-agents-workflow/bug-investigation.md` - NEW: Comprehensive bug investigation flow docs

### Tech Design Agent Cleanup (Remove Bug Handling)
- `src/agents/core-agents/technicalDesignAgent/index.ts` - Remove ALL bug-related code (~50 lines)
- `src/agents/core-agents/technicalDesignAgent/AGENTS.md` - Remove bug documentation
- `src/agents/shared/prompts/bug-fix.ts` - Delete or repurpose for bug-investigator
- `src/agents/shared/utils.ts` - Remove getBugDiagnostics(), getIssueType() if bug-only

## E2E Flow

```
1. BUG ENTERS WORKFLOW
   ├─ Bug submitted via bug report form (or manually created)
   └─ Admin approves → Status: "Bug Investigation"

2. BUG INVESTIGATOR AGENT RUNS
   ├─ Investigates codebase (read-only: Read, Glob, Grep, WebFetch)
   ├─ Posts COMMENT 1: Investigation summary to GitHub issue
   ├─ Sets Review Status: "Waiting for Review"
   └─ Sends Telegram notification with fix option buttons

3. ADMIN REVIEWS & CLICKS TELEGRAM BUTTON
   └─ Clicks one of: "Quick → Impl (S)" / "Standard → Tech (M)" / "Refactor → Tech (L)"

4. WEBHOOK HANDLER PROCESSES CLICK
   ├─ Posts COMMENT 2: Decision comment to GitHub issue
   ├─ Updates GitHub Project status based on destination:
   │   - "→ Implementation" → Status: "Ready"
   │   - "→ Tech Design" → Status: "Technical Design"
   └─ Clears Review Status (so next agent picks it up)

5. NEXT AGENT RUNS (based on destination)
   ├─ IF routed to "Technical Design":
   │   └─ Tech Design agent reads comments for context, creates design
   └─ IF routed to "Ready" (Implementation):
       └─ Implementation agent reads comments, implements fix directly

6. REST OF WORKFLOW
   └─ Normal flow: PR Review → Done
```

## GitHub Comments Pattern

**COMMENT 1: Investigation Summary** (posted by agent)
```markdown
🔍 **Bug Investigation Summary**

**Root Cause:** ✅ Found (High confidence)
[Analysis details...]

**Files Examined:** 8 files
**Fix Options:**
| Option | Description | Complexity | Destination |
|--------|-------------|------------|-------------|
| Quick fix | Add loading guard | S | Implementation |
| Standard fix ⭐ | Refactor auth flow | M | Tech Design |

<!-- BUG_INVESTIGATION_MARKER -->
<!-- AGENT: bug-investigator -->
```

**COMMENT 2: Decision** (posted by webhook after button click)
```markdown
✅ **Fix Option Selected**

**Chosen:** Standard fix ⭐
**Routed to:** Technical Design
**Complexity:** M

<!-- BUG_FIX_DECISION_MARKER -->
<!-- FIX_OPTION: standard -->
<!-- DESTINATION: tech-design -->
```

## Bug Fix Selection Flow (New UI + Webhook)

Similar to clarification flow but separate implementation for bug-specific context.

### Telegram Notification (Simple - URL buttons only)
```
┌────────────────────────────────────────────────────────────┐
│ 🔍 Bug Investigation Complete                              │
│ Issue #47: Login fails intermittently                      │
│                                                            │
│ Root Cause: ✅ Found 🟢 (high confidence)                  │
│ [Brief summary of root cause...]                           │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐   │
│ │           🔗 View Full Investigation                  │   │  ← URL to GitHub comment
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │           🎯 Choose Fix Option                        │   │  ← URL to /bug-fix/:issueNumber
│ └──────────────────────────────────────────────────────┘   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │           ✏️ Request Changes                          │   │  ← Callback button
│ └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

### Bug Fix Selection UI (`/bug-fix/:issueNumber`)
```
┌────────────────────────────────────────────────────────────┐
│ 🔍 Bug Fix Selection - Issue #47                           │
│ Login fails intermittently                                 │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Root Cause: Race condition in useAuth hook...          │ │
│ │ Confidence: 🟢 High                                    │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ Choose fix approach:                                       │
│                                                            │
│ ○ Add null check (S) → Implementation                      │
│   Quick guard to prevent the error                         │
│                                                            │
│ ● Refactor auth flow (M) → Tech Design ⭐ Recommended      │
│   Fix the race condition properly                          │
│                                                            │
│ ○ Redesign auth architecture (L) → Tech Design             │
│   Full auth system overhaul                                │
│                                                            │
│ Additional notes / Custom solution (optional):             │
│ ┌──────────────────────────────────────────────────────┐   │
│ │                                                       │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                            │
│ If providing custom solution, choose destination:          │
│ ○ Tech Design  ○ Implementation                            │
│                                                            │
│                              [Submit Selection]            │
└────────────────────────────────────────────────────────────┘
```

### Webhook: `/api/bug-fix-select`
Handles form submission:
- If option selected: posts decision comment, routes to option's destination
- If custom text provided: posts custom decision comment, routes to selected destination
- Updates GitHub Project status
- Clears Review Status

### Shared Code with Clarification Flow
- UI components (radio buttons, text area, submit)
- Form handling patterns
- GitHub comment posting
- Status update logic

### Separate from Clarification Flow
- Different structured output (`fixOptions` not `needsClarification`)
- Different UI route (`/bug-fix/:id` not `/clarify/:id`)
- Different webhook (`/api/bug-fix-select` not `/api/clarify`)
- Bug-specific context display (root cause, confidence, destinations)

### View Investigation Button
The "View Full Investigation" button links directly to the GitHub comment:
```
https://github.com/{owner}/{repo}/issues/{issueNumber}#issuecomment-{commentId}
```

Agent flow:
1. Post investigation comment → `adapter.addIssueComment()` returns `commentId`
2. Build comment URL: `https://github.com/${owner}/${repo}/issues/${issueNumber}#issuecomment-${commentId}`
3. Include URL button in Telegram notification (not a callback, just a link)

## Notes

### Key Design Decisions

1. **No PR creation for logging**: The agent remains strictly read-only. If additional logs are needed, the admin should:
   - Choose "Request more logs" option
   - Implementation agent can then add logging in a subsequent PR
   - This maintains clean separation of concerns

2. **Fix option format**: Each fix option should include:
   ```typescript
   interface FixOption {
     id: string;                                 // "opt1", "opt2", etc. (for callback data)
     title: string;                              // FREE TEXT: "Add null check", "Refactor auth flow"
     description: string;
     destination: 'implement' | 'tech-design';   // Where it routes
     complexity: 'S' | 'M' | 'L' | 'XL';
     filesAffected: string[];
     tradeoffs?: string;
     isRecommended: boolean;
   }
   ```

   **Recommended 3 levels (but not forced):**
   - Agent should AIM for 3 options at different levels: quick fix, standard fix, refactor
   - But ONLY include options that genuinely make sense for the bug
   - If only 1-2 options apply, that's fine - don't invent artificial options
   - Prompt guidance: "Ideally provide 3 options (quick/standard/refactor), but only if they make sense"

3. **Clarification reuse**: The existing clarification flow (options with labels, descriptions, recommendations) maps perfectly to fix option selection. The agent outputs `needsClarification: true` with options formatted as fix choices.

4. **Status flow**:
   - Bug approved → "Bug Investigation" status (Review Status: empty)
   - Agent investigates → posts to issue → sets Review Status: "Waiting for Review"
   - Admin chooses option via clarification flow
   - Admin approval → auto-advance to chosen destination (Tech Design or Implementation)

5. **Integration with existing bug workflow**: Items with `bug` label entering from "Backlog" should route to "Bug Investigation" (configurable via routing buttons).

6. **Tech Design Agent is Features-Only**: With the new bug-investigator agent, the tech-design agent no longer handles bugs. All bug-related code (~50 lines) will be removed from tech-design. Clean separation: bugs → bug-investigator → (optionally) tech-design; features → tech-design.

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Complex state machine for iterative investigation | Reuse existing clarification received/waiting states |
| Unclear handoff to downstream agents | Pass chosen fix option via issue comments (agents already read comments) |
| GitHub Project column configuration | Document setup requirements clearly |
| Root cause detection reliability | Include confidence levels and allow admin override |

### Downstream Agent Integration

Tech Design and Implementation agents read the bug investigation comments:

```typescript
// In tech-design or implementation agent
const comments = await adapter.getIssueComments(issueNumber);

// Find investigation summary (for context)
const investigation = comments.find(c => c.body.includes('BUG_INVESTIGATION_MARKER'));

// Find chosen fix option (for routing decision)
const decision = comments.find(c => c.body.includes('BUG_FIX_DECISION_MARKER'));
const fixOptionMatch = decision?.body.match(/<!-- FIX_OPTION: (\w+) -->/);
const fixOption = fixOptionMatch?.[1]; // 'quick' | 'standard' | 'refactor'

// Use this context in prompts
if (investigation && fixOption) {
  prompt = buildTechDesignPromptWithBugContext(content, {
    bugInvestigation: investigation.body,
    chosenFixOption: fixOption,
  });
}
```

### Dependencies

- Existing clarification flow infrastructure
- GitHub adapter for issue comments
- Claude Code SDK for agent execution
- Telegram webhook for fix option selection buttons

### Critical Files for Implementation
- `src/agents/core-agents/technicalDesignAgent/index.ts` - Pattern to follow for agent structure
- `src/agents/shared/prompts/bug-fix.ts` - Existing bug-related prompts to reference
- `scripts/template/investigate-bugs.ts` - Reference implementation for investigation logic
- `src/agents/shared/output-schemas.ts` - Pattern for structured output schemas
- `src/agents/shared/utils.ts` - Clarification handling utilities to reuse
