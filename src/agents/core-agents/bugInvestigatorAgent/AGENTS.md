# Bug Investigator Agent

## Purpose

The Bug Investigator Agent performs read-only investigation of bug reports to identify root causes and suggest fix options. It analyzes the codebase without making any changes, posts its investigation as a GitHub issue comment, and sends a Telegram notification with a link for the admin to select a fix approach.

**Key Responsibilities:**
- Investigate bugs using TRACE/IDENTIFY/SCOPE/PROPOSE methodology
- Analyze session logs, stack traces, and error diagnostics
- Post root cause analysis with fix options to GitHub issue
- Route to Tech Design or Implementation based on admin's fix selection
- Revise investigations based on admin feedback
- Answer admin clarification requests

## Entry Point

**File:** `src/agents/core-agents/bugInvestigatorAgent/index.ts`

**Invocation:**
```bash
yarn agent:bug-investigator                    # Process all pending
yarn agent:bug-investigator --id <item-id>     # Process specific item
yarn agent:bug-investigator --dry-run          # Preview without saving
yarn agent:bug-investigator --stream           # Stream Claude output
```

## Integration in Overall Flow

### Position in Pipeline

```
Issue Created (Bug Report)
     |
   Inbox
     |
   Approved (auto-routed)
     |
Bug Investigation <- YOU ARE HERE (for bugs only)
     |
Admin Selects Fix Approach (via web UI)
     |
     +-> Technical Design (complex fixes)
     +-> Implementation (simple fixes)
     |
PR Review
     |
   Done
```

### Trigger Conditions

The agent processes items that match:
1. **Status:** `"Bug Investigation"`
2. **Review Status:** Empty (new investigation) OR `"Request Changes"` (revision) OR `"Clarification Received"`
3. **Type:** Bug reports only (features skip this phase)

### Status Transitions

**Input States:**
- Status: `"Bug Investigation"` + Review Status: `null` -> Generate new investigation
- Status: `"Bug Investigation"` + Review Status: `"Request Changes"` -> Revise investigation
- Status: `"Bug Investigation"` + Review Status: `"Clarification Received"` -> Continue after clarification

**Output State:**
- Status: `"Bug Investigation"` (unchanged)
- Review Status: `"Waiting for Review"`

**Next Phase (after admin selects fix):**
- Admin selects fix approach via `/decision/:issueNumber` web UI
- Routes to `"Technical Design"` (complex fixes) or `"Ready for development"` (simple fixes)

## How It Works

### Flow A: New Investigation

```
1. Fetch project item
   - Status: "Bug Investigation"
   - Review Status: empty
   - Has linked issue

2. Read issue data
   - Issue number, title, body
   - Labels
   - Comments (for context)

3. Fetch bug diagnostics
   - Session logs from MongoDB reports collection
   - Stack traces, error messages
   - Browser info, performance data
   - Bug category (bug vs performance)

4. Idempotency check
   - Check for existing investigation comment
   - If found -> Skip (avoid duplication)
   - If not found -> Continue

5. Build prompt
   - Use buildBugInvestigationPrompt()
   - Include: issue description, diagnostics, comments
   - TRACE/IDENTIFY/SCOPE/PROPOSE methodology

6. Run LLM (READ-ONLY mode)
   - Model: Configured in agentConfig
   - Tools: Read, Glob, Grep, WebFetch only (no git operations)
   - Output format: BUG_INVESTIGATION_OUTPUT_FORMAT (structured JSON)
   - Expected output: { rootCauseFound, confidence, rootCauseAnalysis,
     fixOptions, filesExamined, summary }

7. Extract output
   - Use structuredOutput fields
   - Validate fix options have required fields

8. Check for clarification request
   - If LLM needs clarification -> Post comment, set status, exit
   - If no clarification needed -> Continue

9. Format and post investigation comment
   - Use decision comment format with fix options
   - Each option includes: title, description, complexity, destination, files affected
   - Save decision data to MongoDB for web UI

10. Send notification
    - Notify admin via Telegram
    - Include link to /decision/:issueNumber web UI
    - Admin selects fix approach from the options

11. Set Review Status
    - Update to "Waiting for Review"
```

### Flow B: Address Feedback

```
1. Fetch project item
   - Status: "Bug Investigation"
   - Review Status: "Request Changes"

2. Read existing investigation
   - Get investigation comment from issue
   - If not found -> Error (nothing to revise)

3. Read feedback comments
   - Get all issue comments
   - If no comments -> Error (need feedback)

4. Build revision prompt
   - Use buildBugInvestigationRevisionPrompt()
   - Include: original investigation, feedback comments

5. Run LLM (same as Flow A, read-only mode)

6. Extract and update (same as Flow A, steps 7-11)
```

### Flow C: Continue After Clarification

```
1. Fetch project item
   - Status: "Bug Investigation"
   - Review Status: "Clarification Received"

2. Read clarification
   - Get latest comment (admin's answer)

3. Build clarification prompt
   - Use buildBugInvestigationClarificationPrompt()
   - Include: original request, all comments, admin answer

4. Run LLM (same as Flow A, read-only mode)

5. Extract and update (same as Flow A, steps 7-11)
```

## GitHub Issue Interaction

### Reading from Issue

**What we read:**
- Issue title, body, labels
- All issue comments (for context and feedback)
- Bug diagnostics from MongoDB reports collection (session logs, stack traces)

### Writing to Issue

**Post Investigation Comment:**
- Uses decision comment format with structured fix options
- Each option rendered with metadata (complexity badge, destination tag, files list)
- Includes `<!-- AGENT_DECISION_V1 -->` marker for identification
- Decision data saved to MongoDB for web UI rendering

**Comment format:**
```markdown
[Bug Investigator Agent]

## Root Cause Analysis

[Detailed analysis...]

## Fix Options

[Rendered fix options with metadata...]
```

## LLM Response Format

### Structured Output Schema

```typescript
{
    type: 'json_schema',
    schema: {
        type: 'object',
        properties: {
            rootCauseFound: { type: 'boolean' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            rootCauseAnalysis: { type: 'string' },
            fixOptions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        destination: { type: 'string', enum: ['implement', 'tech-design'] },
                        complexity: { type: 'string', enum: ['S', 'M', 'L', 'XL'] },
                        filesAffected: { type: 'array', items: { type: 'string' } },
                        tradeoffs: { type: 'string' },
                        isRecommended: { type: 'boolean' }
                    }
                }
            },
            filesExamined: { type: 'array', items: { type: 'string' } },
            additionalLogsNeeded: { type: 'string' },
            summary: { type: 'string' }
        }
    }
}
```

## Important: Read-Only Mode

Unlike other agents, the Bug Investigator does **NOT** perform any git operations:
- No branch creation
- No file modifications
- No commits or PRs
- Only uses Read, Glob, Grep, and WebFetch tools

The investigation is posted as a GitHub issue comment, not as a PR with design files.

## Connection to Other Agents

### Upstream (Before)

**Approval Handler:**
- Bug reports are auto-routed to Bug Investigation on approval
- No routing message is sent (unlike features)

### Downstream (After)

**Based on admin's fix selection:**
- **Technical Design Agent** - For complex fixes needing architecture design
- **Implementation Agent** - For simple, well-understood fixes

### Parallel/Related

**Decision Web UI:**
- `/decision/:issueNumber` page renders fix options for admin selection
- Admin selects an option, which routes the item to the appropriate next phase

## Edge Cases

### 1. No Diagnostics Available

**Scenario:** Bug report has no linked session logs or stack traces

**Handling:** Agent investigates based on issue description only, notes missing diagnostics in output

### 2. Investigation Already Exists

**Scenario:** Running agent on issue that already has investigation comment

**Handling:** Idempotency check skips to avoid duplication

### 3. Root Cause Not Found

**Scenario:** Agent cannot determine root cause with available information

**Handling:** Sets `rootCauseFound: false`, includes `additionalLogsNeeded` field explaining what information would help

### 4. LLM Needs Clarification

**Scenario:** Agent encounters ambiguity requiring admin input

**Handling:** Posts clarification question, sets Review Status to "Waiting for Clarification"

## CLI Options

```bash
--id <itemId>        # Process specific item by ID
--limit <number>     # Limit number of items to process (batch mode)
--timeout <seconds>  # Override default timeout
--dry-run            # Preview without saving (no GitHub updates)
--stream             # Stream Claude output in real-time (for debugging)
--verbose            # Show additional debug output
```

## Debugging

**Dry Run Mode:**
```bash
yarn agent:bug-investigator --dry-run --stream --verbose
```

Shows:
- What investigation would be posted
- Fix options that would be presented
- Full LLM response (if --stream)
- Detailed execution logs (if --verbose)

**Common Issues:**

1. **"Investigation already exists"**
   - Cause: Idempotency check triggered
   - Fix: Use feedback mode or manually remove existing comment

2. **"No feedback comments found"**
   - Cause: Review Status = "Request Changes" but no comments
   - Fix: Admin must post feedback first

3. **"Item has no linked issue"**
   - Cause: Project item not linked to issue
   - Fix: Link issue to the project item

## Related Documentation

- **Overall workflow:** `docs/template/github-agents-workflow/overview.md`
- **Bug investigation details:** `docs/template/github-agents-workflow/bug-investigation.md`
- **Prompts:** `src/agents/shared/prompts/bug-investigation.ts`
- **Output schemas:** `src/agents/shared/output-schemas.ts`
