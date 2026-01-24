# Product Design Agent

## Purpose

The Product Design Agent generates user-facing product design documents for feature requests. It translates user requirements into structured product specifications, defining what the feature should do from a user's perspective, including UI/UX, user flows, acceptance criteria, and edge cases.

**Key Responsibilities:**
- Generate product designs for new features
- Revise designs based on admin feedback
- Answer admin clarification requests
- Skip bugs (they bypass product design by default)

## Entry Point

**File:** `src/agents/core-agents/productDesignAgent/index.ts`

**Invocation:**
```bash
yarn agent:product-design                    # Process all pending
yarn agent:product-design --id <item-id>     # Process specific item
yarn agent:product-design --dry-run          # Preview without saving
yarn agent:product-design --stream           # Stream Claude output
```

## Integration in Overall Flow

### Position in Pipeline

```
Issue Created
     ↓
   Inbox
     ↓
Product Design ← YOU ARE HERE (for features only)
     ↓
Technical Design
     ↓
Implementation
     ↓
PR Review
     ↓
   Done
```

### Trigger Conditions

The agent processes items that match:
1. **Status:** `"Product Design"`
2. **Review Status:** Empty (new design) OR `"Request Changes"` (revision) OR `"Clarification Received"`
3. **Type:** NOT a bug (bugs skip this phase)

### Status Transitions

**Input States:**
- Status: `"Product Design"` + Review Status: `null` → Generate new design
- Status: `"Product Design"` + Review Status: `"Request Changes"` → Revise design
- Status: `"Product Design"` + Review Status: `"Clarification Received"` → Continue after clarification

**Output State:**
- Status: `"Product Design"` (unchanged)
- Review Status: `"Waiting for Review"`

**Next Phase (after admin approval):**
- Admin sets Review Status: `"Approved"`
- Auto-advance moves to Status: `"Technical Design"`

## How It Works

### Flow A: New Design

```
1. Fetch GitHub Project item
   - Status: "Product Design"
   - Review Status: empty
   - Has linked issue

2. Read issue data
   - Issue number, title, body
   - Labels (to detect bugs)
   - Comments (for context)

3. Check if bug
   - If bug label exists → Skip (bugs bypass product design)
   - Continue only for features

4. Idempotency check
   - Extract existing product design from issue body
   - If found → Skip (avoid duplication)
   - If not found → Continue

5. Build prompt
   - Use buildProductDesignPrompt()
   - Include: issue description, comments

6. Run LLM
   - Model: Configured in agentConfig
   - Output format: PRODUCT_DESIGN_OUTPUT_FORMAT (structured JSON)
   - Expected output: { design: string, comment: string }

7. Extract output
   - Primary: Use structuredOutput.design
   - Fallback: Extract markdown from text response

8. Check for clarification request
   - If LLM needs clarification → Post comment, set status, exit
   - If no clarification needed → Continue

9. Update issue body
   - Preserve original description
   - Add product design section with markers
   - Format: <!-- PRODUCT_DESIGN_START --> ... <!-- PRODUCT_DESIGN_END -->

10. Post summary comment
    - Use structuredOutput.comment
    - Add agent prefix: [Product Design Agent]

11. Set Review Status
    - Update to "Waiting for Review"

12. Send notification
    - Notify admin via Telegram
    - Include summary if available
```

### Flow B: Address Feedback

```
1. Fetch GitHub Project item
   - Status: "Product Design"
   - Review Status: "Request Changes"

2. Read existing design
   - Extract product design from issue body
   - If not found → Error (nothing to revise)

3. Read feedback comments
   - Get all issue comments
   - If no comments → Error (need feedback)

4. Build revision prompt
   - Use buildProductDesignRevisionPrompt()
   - Include: original design, feedback comments

5. Run LLM (same as Flow A)

6. Extract and update (same as Flow A, steps 7-12)
```

### Flow C: Continue After Clarification

```
1. Fetch GitHub Project item
   - Status: "Product Design"
   - Review Status: "Clarification Received"

2. Read clarification
   - Get latest comment (admin's answer)

3. Build clarification prompt
   - Use buildProductDesignClarificationPrompt()
   - Include: original request, all comments, admin answer

4. Run LLM (same as Flow A)

5. Extract and update (same as Flow A, steps 7-12)
```

## GitHub Issue Interaction

### Reading from Issue

**Issue Body Structure:**
```markdown
[Original user request]

<!-- PRODUCT_DESIGN_START -->
<!-- Generated: 2024-01-24T10:00:00Z -->
<!-- Iteration: 1 -->

# Product Design

[Product design content...]

<!-- PRODUCT_DESIGN_END -->

<!-- TECH_DESIGN_START --> (added later by tech design agent)
...
<!-- TECH_DESIGN_END -->
```

**What we read:**
- `extractOriginalDescription()` - Gets text before design markers
- `extractProductDesign()` - Extracts content between PRODUCT_DESIGN markers
- `adapter.getIssueComments()` - Gets all comments for context/feedback

### Writing to Issue

**Update Issue Body:**
```typescript
const originalDescription = extractOriginalDescription(content.body);
const newBody = buildUpdatedIssueBody(
    originalDescription,  // User's original request
    design,               // NEW product design
    null                  // No tech design yet (this agent doesn't touch it)
);
await adapter.updateIssueBody(issueNumber, newBody);
```

**Post Comment:**
```typescript
const prefixedComment = addAgentPrefix('product-design', comment);
await adapter.addIssueComment(issueNumber, prefixedComment);
```

Comment format:
```markdown
**[Product Design Agent]**

[Summary of the design, key decisions, etc.]
```

## LLM Response Format

### Structured Output Schema

```typescript
{
    type: 'json_schema',
    schema: {
        type: 'object',
        properties: {
            design: {
                type: 'string',
                description: 'Complete product design document in markdown'
            },
            comment: {
                type: 'string',
                description: 'Summary comment to post on issue'
            }
        },
        required: ['design', 'comment']
    }
}
```

### Expected Response

```json
{
    "design": "# Product Design\n\n## Overview\n[...detailed design in markdown...]",
    "comment": "I've created a product design that focuses on [...summary...]"
}
```

### Fallback Handling

If structured output fails:
1. Extract markdown from raw text using `extractMarkdown()`
2. Use extracted content as design
3. No summary comment (comment will be undefined)

## Status Field Updates

### Review Status Changes

| From | To | Trigger |
|------|----|----|
| `null` (empty) | `"Waiting for Review"` | New design generated |
| `"Request Changes"` | `"Waiting for Review"` | Revised design generated |
| `"Clarification Received"` | `"Waiting for Review"` | Clarification addressed |
| Any | `"Waiting for Clarification"` | Agent needs clarification |

### GitHub Project Fields Updated

```typescript
// Set Review Status
await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForReview);

// Status field is NOT changed by this agent (stays "Product Design")
```

## Connection to Other Agents

### Upstream (Before)

**None** - This is typically the first agent in the workflow for features.

User creates issue → Manual move to "Product Design" status → This agent runs

### Downstream (After)

**Technical Design Agent:**
- Reads the product design from issue body
- Uses it to generate technical specifications
- Triggered when: Status = "Technical Design" (after admin approves)

### Parallel/Related

**Auto-Advance Agent:**
- Monitors Review Status changes
- When admin sets Review Status to "Approved" → Moves to next status
- Enables automatic workflow progression

## Edge Cases

### 1. Bug Reports

**Scenario:** Issue has "bug" label

**Handling:**
```typescript
const issueType = getIssueType(content.labels);
if (issueType === 'bug') {
    console.log('⏭️  Skipping bug - bugs bypass Product Design phase');
    return { success: false, error: 'Bug reports skip Product Design by default' };
}
```

**Reason:** Most bugs need technical fixes, not product redesign. Admin can manually move bugs to Product Design if UX changes are needed.

### 2. Design Already Exists

**Scenario:** Running agent on issue that already has product design

**Handling:**
```typescript
const existingDesign = extractProductDesign(content.body);
if (existingDesign) {
    console.log('⚠️  Product design already exists - skipping to avoid duplication');
    return { success: false, error: 'Product design already exists (idempotency check)' };
}
```

**Resolution:** Use `--id` flag to force re-run on specific item, or use feedback mode

### 3. No Feedback Comments

**Scenario:** Review Status = "Request Changes" but no comments found

**Handling:**
```typescript
if (issueComments.length === 0) {
    return { success: false, error: 'No feedback comments found' };
}
```

**Resolution:** Admin must post feedback comment before agent can revise

### 4. LLM Needs Clarification

**Scenario:** Agent doesn't have enough information to proceed

**Handling:**
```typescript
const clarificationRequest = extractClarification(result.content);
if (clarificationRequest) {
    return await handleClarificationRequest(
        adapter,
        { id: item.id, content: {...} },
        issueNumber,
        clarificationRequest,
        'Product Design',
        content.title,
        issueType,
        options,
        'product-design'
    );
}
```

**Flow:**
1. Extract clarification questions from LLM response
2. Post questions as comment on issue
3. Set Review Status to "Waiting for Clarification"
4. Exit (agent will resume when admin answers)

### 5. Markdown Extraction Failure

**Scenario:** Structured output missing, and can't extract markdown from text

**Handling:**
```typescript
const extracted = extractMarkdown(result.content);
if (!extracted) {
    const error = 'Could not extract design document from output';
    await notifyAgentError('Product Design', content.title, issueNumber, error);
    return { success: false, error };
}
```

**Impact:** Agent fails, admin gets notified via Telegram

### 6. Issue Not Linked

**Scenario:** GitHub Project item has no linked issue

**Handling:**
```typescript
if (!content || content.type !== 'Issue') {
    return { success: false, error: 'Item has no linked issue' };
}
```

**Resolution:** Admin must link an issue to the project item

## Implementation Details

### Key Dependencies

```typescript
// Project management
import { getProjectManagementAdapter } from '../../shared';

// Prompts
import {
    buildProductDesignPrompt,
    buildProductDesignRevisionPrompt,
    buildProductDesignClarificationPrompt
} from '../../shared';

// Parsing
import {
    extractOriginalDescription,
    extractProductDesign,
    buildUpdatedIssueBody
} from '../../shared';

// Logging
import {
    createLogContext,
    runWithLogContext,
    logExecutionStart,
    logExecutionEnd
} from '../../lib/logging';
```

### Prompts Location

**Files:**
- `src/agents/shared/prompts/product-design.ts` - buildProductDesignPrompt()
- `src/agents/shared/prompts/product-design-revision.ts` - buildProductDesignRevisionPrompt()
- `src/agents/shared/prompts/product-design-clarification.ts` - buildProductDesignClarificationPrompt()

### Notification System

**Telegram Notifications:**
```typescript
// Start notification
await notifyAgentStarted('Product Design', title, issueNumber, mode, issueType);

// Success notification
await notifyProductDesignReady(title, issueNumber, isRevision, issueType, summary);

// Error notification
await notifyAgentError('Product Design', title, issueNumber, errorMessage);
```

**Recipients:**
- Owner telegram (configured in `app.config.js`)
- Includes clickable issue link

### Logging

**Session Logs:**
```typescript
const logCtx = createLogContext({
    issueNumber,
    workflow: 'product-design',
    phase: 'Product Design',
    mode: mode === 'new' ? 'New design' : 'Address feedback',
    issueTitle: content.title,
    issueType
});

return runWithLogContext(logCtx, async () => {
    logExecutionStart(logCtx);
    // ... agent work ...
    logExecutionEnd(logCtx, {
        success: true,
        toolCallsCount: 0,
        totalTokens: 0,
        totalCost: 0
    });
});
```

**Log Storage:**
- Stored in MongoDB via `src/server/database/collections/agent-logs.ts`
- Accessible via `/agent-logs` route
- Includes: timestamp, workflow, phase, status, error details

### Idempotency

**Multiple Runs:**
- Running on same item twice → Skips if design exists
- Running after changes → Use feedback mode instead
- Force re-run → Manually remove existing design from issue body first

**Safe Operations:**
- Status updates use GitHub API (atomic)
- Issue body updates are full replacements (no merge conflicts)
- Comments are append-only (safe)

## Configuration

**Agent Config:**
```typescript
// src/agents/agents.config.ts
export const agentConfig = {
    claude: {
        timeoutSeconds: 600,  // 10 minutes max per agent run
        // ... other settings
    }
};
```

**Timeout Behavior:**
- If LLM takes > timeout → Agent fails
- Error notification sent
- Can retry with `--timeout` flag

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
yarn agent:product-design --dry-run --stream --verbose
```

Shows:
- What would be updated (issue body, review status)
- What comment would be posted
- Full LLM response (if --stream)
- Detailed execution logs (if --verbose)

**Common Issues:**

1. **"Product design already exists"**
   - Cause: Idempotency check triggered
   - Fix: Use feedback mode or manually remove existing design

2. **"No feedback comments found"**
   - Cause: Review Status = "Request Changes" but no comments
   - Fix: Admin must post feedback first

3. **"Item has no linked issue"**
   - Cause: GitHub Project item not linked to issue
   - Fix: Link issue in GitHub Projects UI

4. **"Could not extract design document"**
   - Cause: LLM output malformed
   - Fix: Check LLM response in logs, may need prompt adjustment

## Testing

**Manual Test:**
```bash
# 1. Create test issue
# 2. Add to GitHub Project with status "Product Design"
# 3. Run agent
yarn agent:product-design --id <project-item-id> --dry-run --stream

# 4. Verify output looks correct
# 5. Run without --dry-run
yarn agent:product-design --id <project-item-id>

# 6. Check issue body has design
# 7. Check Review Status = "Waiting for Review"
```

## Related Documentation

- **Overall workflow:** `docs/github-projects-integration.md`
- **Setup guide:** `docs/init-github-projects-workflow.md`
- **Prompts:** `src/agents/shared/prompts/`
- **Output schemas:** `src/agents/shared/output-schemas.ts`
