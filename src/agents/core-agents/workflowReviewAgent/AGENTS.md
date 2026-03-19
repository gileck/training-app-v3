# Workflow Review Agent

## Purpose

The Workflow Review Agent is the final step in the pipeline. It picks up completed workflow items (status "Done", not yet reviewed), analyzes their agent execution logs via LLM, appends a review section to the log file, stores a summary on the workflow item in MongoDB, sends a Telegram notification, and creates improvement issues for any findings.

**Key Responsibilities:**
- Analyze agent execution logs for completed workflow items
- Identify errors, inefficiencies, and systemic improvements
- Append `[LOG:REVIEW]` section to agent log files
- Create workflow items for findings via `yarn agent-workflow create`
- Store review summary on the workflow item in MongoDB
- Send Telegram notification with review results

## Entry Point

**File:** `src/agents/core-agents/workflowReviewAgent/index.ts`

**Invocation:**
```bash
yarn agent:workflow-review                    # Process all pending
yarn agent:workflow-review --id <item-id>     # Process specific item
yarn agent:workflow-review --dry-run          # Preview without saving
yarn agent:workflow-review --stream           # Stream Claude output
```

## Integration in Overall Flow

### Position in Pipeline

```
Issue Created
     |
   Inbox
     |
Product Design / Bug Investigation
     |
Technical Design
     |
Implementation
     |
PR Review
     |
   Done
     |
Workflow Review <- YOU ARE HERE (last step)
```

### Trigger Conditions

The agent processes items that match:
1. **Status:** `"Done"`
2. **Reviewed:** `!== true` (not yet reviewed)
3. **Has GitHub issue number** (`githubIssueNumber != null`)
4. **Has local log file** (`agent-logs/issue-{N}.md` exists)

### Status Transitions

**Input State:**
- Status: `"Done"` + `reviewed !== true`

**Output State:**
- Status: `"Done"` (unchanged)
- `reviewed: true` in MongoDB
- `reviewSummary` stored in MongoDB

## How It Works

### Flow A: New Review

```
1. Query Done items from MongoDB
   - Filter: reviewed !== true, has githubIssueNumber
   - Sort: by updatedAt descending
   - Apply limit (default: 1 item per run)

2. Check log file exists
   - Path: agent-logs/issue-{N}.md
   - If not found -> Skip item

3. Idempotency check
   - Read tail of log file (last 4KB)
   - Check for [LOG:REVIEW] marker
   - If found -> Mark as reviewed in DB, skip

4. Build prompt
   - Use buildWorkflowReviewPrompt()
   - Include: item metadata, phases, designs, history timeline
   - Provide log file path for LLM to read incrementally
   - Include analysis checklist (errors, efficiency, workflow, cost, prompts)

5. Run LLM (READ-ONLY mode)
   - Tools: Read, Grep, Glob only (no write operations)
   - Output format: WORKFLOW_REVIEW_OUTPUT_FORMAT (structured JSON)
   - Expected output: { executiveSummary, findings, systemicImprovements }

6. Create workflow items for findings
   - For each finding: spawn `yarn agent-workflow create`
   - Includes type, title, description, priority, size, complexity
   - Uses --created-by workflow-review attribution
   - If ALL findings fail to create -> Don't mark as reviewed (retry next run)

7. Append review section to log file
   - Format: [LOG:REVIEW] marker with executive summary, findings checklist, systemic improvements table
   - Uses appendFileSync for safety

8. Update MongoDB
   - Set reviewed = true
   - Store reviewSummary (overall assessment text)

9. Send Telegram notification
   - Notify admin with item title, issue number, summary, findings count
```

## LLM Response Format

### Structured Output Schema

```typescript
{
    type: 'json_schema',
    schema: {
        type: 'object',
        properties: {
            executiveSummary: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    totalCost: { type: 'string' },
                    duration: { type: 'string' },
                    overallAssessment: { type: 'string' }
                }
            },
            findings: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        severity: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        category: { type: 'string' },
                        type: { type: 'string' },
                        priority: { type: 'string' },
                        size: { type: 'string' },
                        complexity: { type: 'string' },
                        relatedIssue: { type: 'number' },
                        affectedFiles: { type: 'array', items: { type: 'string' } }
                    }
                }
            },
            systemicImprovements: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        type: { type: 'string' },
                        targetFile: { type: 'string' },
                        recommendation: { type: 'string' }
                    }
                }
            }
        }
    }
}
```

## Important: Read-Only Mode

Like the Bug Investigator, the Workflow Review Agent does **NOT** perform any write operations via the LLM:
- Only uses Read, Glob, Grep tools
- No git operations
- No file modifications via LLM
- The review section is appended by the agent script itself (not the LLM)

## Important: No Local State

Review state is stored entirely in MongoDB:
- `reviewed: boolean` - Whether the item has been reviewed
- `reviewSummary: string` - The overall assessment text
- The `[LOG:REVIEW]` marker in the log file is a safety net for idempotency

## Connection to Other Agents

### Upstream (Before)

**PR Review Agent:**
- Items reach "Done" status after PR merge
- Workflow Review picks up Done items that haven't been reviewed

### Downstream (After)

**Workflow Items Created:**
- Findings are created as new workflow items via `yarn agent-workflow create`
- These go through the normal approval flow (Telegram notification to admin)
- Admin decides whether to approve each finding for implementation

### Pipeline Position

- Part of the `ALL_ORDER` in the master orchestrator
- Runs after `pr-review` in every cycle when using `--all`
- Default limit of 1 item per run to avoid excessive processing

## Edge Cases

### 1. Log File Not Found

**Scenario:** Done item has no local log file

**Handling:** Skips the item with a message. Does not mark as reviewed (item will be skipped again on subsequent runs).

### 2. Already Reviewed (Marker in Log)

**Scenario:** Log file already contains `[LOG:REVIEW]` marker

**Handling:** Marks as reviewed in DB and skips processing. Prevents duplicate reviews.

### 3. All Findings Fail to Create

**Scenario:** Every `yarn agent-workflow create` call fails

**Handling:** Does NOT mark as reviewed, so the item will be retried on the next run.

### 4. Partial Finding Failures

**Scenario:** Some but not all findings fail to create

**Handling:** Proceeds with partial results. Marks as reviewed. Logs warnings for failed findings.

### 5. LLM Returns No Structured Output

**Scenario:** Agent run fails or returns no structured output

**Handling:** Logs error, sends error notification to admin, does not mark as reviewed.

## CLI Options

```bash
--id <itemId>        # Process specific item by ID or issue number
--limit <number>     # Limit number of items to process (default: 1)
--timeout <seconds>  # Override default timeout
--dry-run            # Preview without saving (no DB updates, no findings created)
--stream             # Stream Claude output in real-time
--verbose            # Show additional debug output
```

## Debugging

**Dry Run Mode:**
```bash
yarn agent:workflow-review --dry-run --stream --verbose
```

Shows:
- Which Done items would be processed
- Whether log files exist
- Whether items are already reviewed
- Full LLM response (if --stream)

**Common Issues:**

1. **"Skipping: log file not found"**
   - Cause: No `agent-logs/issue-{N}.md` file exists
   - Fix: Ensure agents ran with logging enabled

2. **"[LOG:REVIEW] marker already present"**
   - Cause: Item was already reviewed
   - Fix: Check if `reviewed` flag is also set in DB

3. **"All findings failed to create"**
   - Cause: `yarn agent-workflow create` command failing
   - Fix: Check agent-workflow CLI is working, verify MongoDB connection

4. **"No structured output"**
   - Cause: LLM did not return expected format
   - Fix: Check prompt, try with --stream to see raw output

## Related Documentation

- **Overall workflow:** `docs/template/github-agents-workflow/overview.md`
- **Workflow review details:** `docs/template/github-agents-workflow/workflow-review.md`
- **Agent logging:** `docs/template/github-agents-workflow/agent-logging.md`
- **Running agents:** `docs/template/github-agents-workflow/running-agents.md`
- **Output schemas:** `src/agents/shared/output-schemas.ts`
