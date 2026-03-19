---
description: Review agent workflow logs and suggest improvements to the github-agents workflow
---

# Workflow Review

Review agent execution logs and identify issues, inefficiencies, and improvement opportunities.

## Usage

- `/workflow-review 43` - Review log for issue #43
- `/workflow-review` - Review most recent log file

## Process Overview

Analyze workflow execution logs to identify:
- Errors and failures — with **root cause analysis**
- Inefficiencies (token/cost, redundant operations)
- Workflow bottlenecks
- Prompt improvement opportunities
- Code/infrastructure issues

---

## CRITICAL: Senior Engineer Mindset

**You are a senior engineer investigating production issues, NOT a log scanner that reports surface-level observations.**

The user already knows what the logs say — they can read error messages themselves. Your job is to find **why** things happened and **what should change** to prevent recurrence.

### Investigation Principles

1. **Understand the system before judging it.** Before flagging anything as an issue, you MUST understand the workflow mechanisms. The system has built-in recovery, retry, and error handling patterns. If you don't understand them, you'll report false positives (e.g., "dirty working directory" when `--reset` exists to handle that).

2. **Always ask "why?" at least twice.** Surface observation: "Phase failed with error X." First why: "What triggered error X?" Second why: "Why didn't the existing recovery mechanism handle it?" — This is where the real finding lives.

3. **Don't report what the user can already see.** If the log says `[LOG:ERROR] dirty working directory`, don't tell the user "there was a dirty working directory error." Instead, investigate: the task config uses `--reset` which runs `git reset --hard && git clean -fd` — so why was the directory still dirty? Was `--reset` not running? Did it run but fail? Was there a race condition?

4. **Cross-reference aggressively.** Issue logs show WHAT happened to a specific issue. Task runner logs (`agent-tasks/all/runs/`) show the process-level context (crashes, timeouts, git failures). Source code shows the mechanisms. Use ALL of them to build a complete picture.

5. **Every finding must have a root cause.** If you can't determine the root cause, say so explicitly and recommend what additional logging would be needed. "Unknown root cause" with a logging improvement recommendation is more valuable than a surface-level observation.

6. **Distinguish between symptoms and causes.** A missing `[LOG:PHASE_END]` is a symptom. The cause might be a timeout kill, a crash, a network failure, or a code bug. Find the cause.

---

## CRITICAL: Efficient Reading Strategy

**Log files can be very large (1000+ lines). DO NOT read the entire file at once.**

Use this incremental approach:

### Phase 1: Get Overview (Read sparingly)
1. **Read header only** (first 30 lines) - Get issue title, type, start time
2. **Read Summary section** (last 50 lines) - Get totals, phase breakdown table

### Phase 2: Search for Issues (Use Grep)
Use Grep to find problems WITHOUT reading full content.

**Log entries use `[LOG:TYPE]` markers for precise searching:**

| What to Find | Grep Pattern |
|--------------|--------------|
| Errors | `\[LOG:ERROR\]\|\[LOG:FATAL\]` |
| All phases | `\[LOG:PHASE_START\]` |
| Phase results | `\[LOG:PHASE_END\]` |
| Execution start/end | `\[LOG:EXECUTION_START\]\|\[LOG:EXECUTION_END\]` |
| Tool calls | `\[LOG:TOOL_CALL\]` |
| Tool results | `\[LOG:TOOL_RESULT\]` |
| Token usage | `\[LOG:TOKENS\]` |
| Status changes | `\[LOG:STATUS\]` |
| GitHub actions | `\[LOG:GITHUB\]` |
| Webhook events | `\[LOG:WEBHOOK\]` |
| Webhook phase start/end | `\[LOG:WEBHOOK_START\]\|\[LOG:WEBHOOK_END\]` |
| GitHub Action events | `\[LOG:ACTION\]` |
| GitHub Action phase start/end | `\[LOG:ACTION_START\]\|\[LOG:ACTION_END\]` |
| Telegram events | `\[LOG:TELEGRAM\]` |
| Summary | `\[LOG:SUMMARY\]` |
| Previous reviews | `\[LOG:REVIEW\]` |
| Feature branch ops | `\[LOG:FEATURE_BRANCH\]` |
| Final review status | `\[LOG:FINAL_REVIEW\]` |
| Run trigger source | `Triggered by:` |
| Run start/end time | `Start time:\|End time:\|Total duration:` |

```bash
# Find errors (precise - no false positives from design docs)
Grep pattern="\[LOG:ERROR\]\|\[LOG:FATAL\]" path="agent-logs/issue-{N}.md"

# Find high costs (look for $X.XX patterns above threshold)
Grep pattern="\$[1-9][0-9]*\." path="agent-logs/issue-{N}.md"

# Find tool calls (count for efficiency analysis)
Grep pattern="\[LOG:TOOL_CALL\]" path="agent-logs/issue-{N}.md"

# Find phase results
Grep pattern="\[LOG:PHASE_END\]" path="agent-logs/issue-{N}.md" -A 5

# Find status changes
Grep pattern="\[LOG:STATUS\]" path="agent-logs/issue-{N}.md"
```

### Phase 3: Drill Down (Read specific sections only)
Only read specific line ranges when investigating a finding:
- Use `Read` with `offset` and `limit` parameters
- Focus on 50-100 lines around the issue

---

## Step 0: Understand the Workflow System (MANDATORY — Do This First)

**Before looking at ANY logs, you MUST read the workflow documentation to understand how the system works.** Without this context, you will make incorrect observations and miss root causes.

**Actions:**
1. Read the workflow overview: `docs/template/github-agents-workflow/overview.md`
2. Read how agents are run: `docs/template/github-agents-workflow/running-agents.md`
3. Read the task runner system: `docs/template/github-agents-workflow/agent-tasks.md`
4. Read troubleshooting patterns: `docs/template/github-agents-workflow/troubleshooting.md`

**After reading, you should understand these key mechanisms (do NOT proceed until you do):**

- **`--reset` flag**: Every scheduled run does `git reset --hard origin/main && git clean -fd` before running agents. This is the primary dirty-state recovery mechanism. If you see a dirty directory error, the question is "why didn't --reset prevent this?" not "there was a dirty directory."
- **`--global-limit`**: Agents run sequentially; after the first agent that processes items, the rest are skipped until the next cycle. This creates intentional gaps between phases.
- **Retry-by-stasis**: Failed items stay in their current status and are automatically retried in the next 10-minute cycle. There is no explicit retry queue — the retry IS the next scheduled run picking up the same item.
- **Task-level retry**: The task runner itself retries crashed runs up to 3 times with exponential backoff.
- **Batch processor**: Each agent's `runBatch()` catches per-item failures and continues processing remaining items. A single item failure doesn't kill the entire run.
- **Directory lock**: `/tmp/agent-dir-{hash}.lock` with PID-based directory locking prevents concurrent execution.
- **Agent copy isolation**: Agents run in a separate git worktree (`../[project]-agents`), not in the main repo.

**Also read if relevant to the issue type:**
- Multi-phase features: `docs/template/github-agents-workflow/multi-phase-features.md`
- Bug investigation: `docs/template/github-agents-workflow/bug-investigation.md`
- Feedback/reviews: `docs/template/github-agents-workflow/feedback-and-reviews.md`

## Step 1: Load Log File Header & Summary

**Actions**:
1. If issue number provided: Target `agent-logs/issue-{N}.md`
2. If no argument: List `agent-logs/` and select most recent by timestamp
3. Read first 30 lines (header with issue info)
4. Read last 50 lines (Summary table)

This gives you:
- Issue title, type, start time
- Phase breakdown (duration, tools, tokens, cost per phase)
- Total cost and duration

## Step 2: Search for Red Flags

Use Grep with `[LOG:*]` markers for precise searches:

| Pattern | What it finds |
|---------|---------------|
| `\[LOG:ERROR\]\|\[LOG:FATAL\]` | Errors and failures |
| `\[LOG:PHASE_END\]` with `-A 5` | Phase summaries |
| `\[LOG:TOOL_CALL\].*Read` | File read operations |
| `\[LOG:TOKENS\]` | Token usage entries |
| `\$[1-9]` | High costs (> $1) |

## Step 3: Cross-Reference with Task Runner Logs (MANDATORY for any failure/anomaly)

**This is NOT optional.** For ANY error, missing phase, unexpected gap, or anomaly found in Step 2, you MUST check the task runner logs. The issue logs show what happened to the issue; the task runner logs show what happened to the process. You need BOTH to determine root cause.

**IMPORTANT:** The `agent-tasks/all/runs/` directory is relative to the same repo as the issue log file. If the log file is from a child project repo, look for `agent-tasks/all/runs/` in that same child repo, not this template repo.

**The task runner logs contain information NOT in issue logs:**
- Process crashes before agent logging starts
- Git fetch/push failures at the runner level
- GitHub API timeouts during project initialization
- Script exit codes and stderr output
- Timeout kills (process killed after 15min)
- Network connectivity failures

### How to Find the Relevant Run

1. **Get the phase timestamp** from the issue log (from `[LOG:PHASE_START]` or `**Started:**` field)
2. **List run files around that time:**
   ```bash
   # If phase started at 2026-02-07 02:50, look for runs around that time
   Bash command="ls agent-tasks/all/runs/status-20260207-02*.json"
   ```
3. **Check status files** to find the run that was active during the phase:
   ```bash
   # Read the status file to see start/end times and status
   Read file_path="agent-tasks/all/runs/status-YYYYMMDD-HHMMSS-mmm.json"
   ```
   Status file contains: `status` (completed/failed/timeout), `exitCode`, `startedAt`, `finishedAt`, `durationMs`

4. **Read the output log** for the matching run:
   ```bash
   # Search for the issue number in the output log
   Grep pattern="issue.*#N\|Processing.*#N\|\[N/\|item.*N" path="agent-tasks/all/runs/output-YYYYMMDD-HHMMSS-mmm.log"

   # Search for errors in the output log
   Grep pattern="\[ERR\]|Error:|fatal:|failed" path="agent-tasks/all/runs/output-YYYYMMDD-HHMMSS-mmm.log"
   ```

### Run Log File Structure

**Files in `agent-tasks/all/runs/`:**

| File Pattern | Contents |
|--------------|----------|
| `output-YYYYMMDD-HHMMSS-mmm.log` | Raw stdout/stderr from the agent process |
| `status-YYYYMMDD-HHMMSS-mmm.json` | Run metadata (status, exitCode, timestamps, duration) |

**Timestamp format:** `YYYYMMDD-HHMMSS-mmm` (date-time-milliseconds), embedded in filename.

**Status file schema:**
```json
{
  "taskId": "uuid",
  "taskName": "Agent(app-template-ai): All",
  "runId": "uuid",
  "status": "completed|failed|timeout",
  "exitCode": 0,
  "startedAt": "ISO-8601",
  "finishedAt": "ISO-8601",
  "durationMs": 30117,
  "duration": "30s"
}
```

**Output log patterns to search:**

| What to Find | Grep Pattern |
|--------------|--------------|
| Errors (stderr) | `\[ERR\]` |
| Git failures | `fatal:.*repository\|Could not read` |
| API timeouts | `Connect Timeout\|ETIMEDOUT\|UND_ERR_CONNECT_TIMEOUT` |
| Script failures | `failed with exit code` |
| Agent processing | `Processing.*item\|Processing issue` |
| Agent name sections | `Running:` |
| No work found | `No items to process` |
| Run trigger source | `Triggered by:` |
| Run timing | `Start time:\|End time:\|Total duration:` |

### Quick Investigation Workflow

```bash
# 1. Find failed/timeout runs in recent days
Bash command="for f in agent-tasks/all/runs/status-2026020*.json; do python3 -c \"import json; d=json.load(open('$f')); s=d['status']; print(f'$f: status={s} dur={d.get(\"duration\",\"?\")}')\" 2>/dev/null; done | grep -v completed"

# 2. For a specific failed run, check the output log
Grep pattern="\[ERR\]" path="agent-tasks/all/runs/output-YYYYMMDD-HHMMSS-mmm.log" output_mode="content"

# 3. Find which run processed a specific issue number
Grep pattern="issue.*#108\|Processing.*108" path="agent-tasks/all/runs/" output_mode="content"
```

## Step 4: Root Cause Investigation (Not Just Reporting)

**For each anomaly found, perform a proper root cause investigation. Do NOT just describe what the log says — dig into WHY it happened.**

### Investigation Process (for each finding):

1. **Read context** — Read 50-100 lines around the anomaly to understand what happened before and after
2. **Identify the relevant system mechanism** — What part of the workflow system is responsible for this area? What should have happened according to the docs you read in Step 0?
3. **Ask "why didn't the existing mechanism handle this?"** — The system has recovery for most failure modes (`--reset` for dirty state, retry-by-stasis for failed items, batch processor catch for per-item failures, directory lock for concurrency). If something failed, the interesting question is why the recovery didn't work.
4. **Cross-reference with task runner logs** — For ANY failure or missing phase, check `agent-tasks/all/runs/` logs from that time period. The issue log shows the agent's perspective; the task runner log shows the process perspective.
5. **Read source code if needed** — If the mechanism's behavior is unclear from docs alone, read the relevant source files to understand the actual implementation. Key files:
   - `src/agents/index.ts` — master runner, `--reset` implementation, `pullLatestChanges()`
   - `src/agents/shared/batch-processor.ts` — how items are collected and processed
   - `src/agents/shared/git-utils.ts` — git operations, `hasUncommittedChanges()`, branch management
   - `agent-tasks/all/config.json` — task runner configuration (schedule, timeout, retry settings)
6. **Determine root cause** — Categorize as: Code bug / Infrastructure issue / Race condition / Missing mechanism / Configuration issue / Transient failure (self-recovered)
7. **If root cause is still unclear** — Say so explicitly. Recommend specific logging improvements that would have made the root cause obvious (see below). "Root cause unknown — recommend adding X logging" is far more valuable than a surface-level observation.

### Suggesting Logging Improvements

When investigation hits a dead end because logs lack sufficient detail, include **logging improvement recommendations** in the review. The goal is to ensure future occurrences of the same issue are diagnosable.

**Ask yourself:** "What log line, if it existed, would have made this issue obvious?"

**Examples of useful logging suggestions:**
- "Add error context logging before/after the GitHub API call in `src/agents/core-agents/productDesignAgent/index.ts`"
- "Log the item ID and status when skipping items in the auto-advance agent"
- "Add elapsed time logging between agent phases to detect hangs"
- "Log the git branch state before and after checkout operations"
- "Add a structured error summary line when a script exits with non-zero code"

**Format in review output:**
```
#### 🟠 High Priority
- [ ] Add logging: [what to log] in [specific file/function] — would have helped diagnose [this specific issue]
```

## Step 5: Generate Recommendations

**Output**:
- Summary with severity (Critical / Warning / Info)
- Specific findings with line references
- Actionable improvements
- Priority ranking

## Step 6: Present Results

**Format**: Structured report with sections
**Optional**: Offer to create task/issue for major findings

## Step 7: Write Review to Issue Log File (REQUIRED)

**CRITICAL: Always write the review findings to the issue log file after presenting results.**

After completing the analysis, append an "Issue Review" section to the end of the agent log file (`agent-logs/issue-{N}.md`).

**Actions:**
1. Use the `Edit` tool to append the review section at the end of the log file
2. The section should be added AFTER the Summary table

**Format to append:**

```markdown

---

## [LOG:REVIEW] Issue Review

**Reviewed:** [ISO timestamp]
**Reviewer:** workflow-review

### Executive Summary
- **Status**: [Completed/Failed/Partial]
- **Total Cost**: $X.XX
- **Duration**: Xm Xs
- **Overall Assessment**: [Brief 1-2 sentence assessment]

### Findings Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| Critical | N | [Brief list or "None"] |
| Warning | N | [Brief list or "None"] |
| Info | N | [Brief list or "None"] |

### Action Items

> **Priority Legend:** 🔴 Critical (fix now) | 🟠 High (fix soon) | 🟡 Medium (should fix) | 🔵 Low (nice to have)

#### 🔴 Critical
- [ ] [Action item with specific file/location if applicable]

#### 🟠 High Priority
- [ ] [Action item]
- [ ] [Action item]

#### 🟡 Medium Priority
- [ ] [Action item]

#### 🔵 Low Priority
- [ ] [Action item]

### Systemic Improvements

> Changes that would improve the agent workflow for ALL future issues.

| Type | Target File | Recommendation |
|------|-------------|----------------|
| Doc Update | `docs/xyz.md` | [What to add/change] |
| Rule Update | `.ai/commands/xyz.md` | [What to add/change] |
| Prompt Update | `src/agents/prompts/xyz.ts` | [What to add/change] |

### Notes
[Any additional context, observations, or follow-up recommendations]
```

**Important:**
- Use checkboxes `- [ ]` for action items so they can be tracked
- If no items in a severity category, write "None" or omit the section
- Keep action items specific and actionable
- Link to specific line numbers when referencing issues in the log
- The `[LOG:REVIEW]` marker enables future grep searches for reviews
- **Every finding MUST include a root cause**, not just a symptom description. If root cause is unknown, state "Root cause unknown" and recommend logging improvements.
- **Reference the system mechanism** that was relevant (e.g., "`--reset` should have cleaned this but didn't because...")

---

## Analysis Checklist

### Errors & Failures
- [ ] Any error markers? (`Grep pattern="\[LOG:ERROR\]\|\[LOG:FATAL\]"`)
  - **For EACH error:** Don't just report it. Investigate: What system mechanism should have prevented or recovered from this? Why didn't it? Check task runner logs for the same time window.
- [ ] Stack traces in error blocks? (Read lines around `[LOG:ERROR]` matches)
- [ ] Git operation failures? (`Grep pattern="\[LOG:GITHUB\].*failed\|\[LOG:ERROR\].*git"`)
- [ ] Missing `[LOG:PHASE_END]` for any phase that has a `[LOG:PHASE_START]`? If so, ALWAYS check the task runner logs — the phase was likely killed (timeout, crash, OOM) and the issue log won't have the reason.
- [ ] Phase ran multiple times? (Multiple `[LOG:PHASE_START]` for same phase type) — Investigate: was the first attempt a failure that was retried by the next cycle? Check task runner logs for the first attempt's run to find what happened.

### Efficiency
- [ ] Same file read multiple times **within a single phase**? (`Grep pattern="\[LOG:TOOL_CALL\].*Read"` then check for duplicates within each phase)
  - **IMPORTANT**: Repeated reads **across different phases** is expected and acceptable. Each agent runs independently with no shared state - this is by design.
  - Only flag as inefficiency if the same file is read 3+ times within ONE agent's execution.
- [ ] Large token counts for simple tasks? (`Grep pattern="\[LOG:TOKENS\]"` or check Summary table)
- [ ] Redundant Grep/Glob patterns? (`Grep pattern="\[LOG:TOOL_CALL\].*Grep\|\[LOG:TOOL_CALL\].*Glob"`)
- [ ] MCP startup delays? (Implementation phase with local testing)
  - Look for long gap between phase start and first `mcp__playwright__` tool call
  - If first Playwright tool takes >30s after phase start, MCP server startup may be slow
  - Check for `[LOG:ERROR]` with MCP or Playwright-related messages

### Workflow
- [ ] Phase transitions correct? (`Grep pattern="\[LOG:PHASE_START\]\|\[LOG:PHASE_END\]"`)
- [ ] PR created successfully? (`Grep pattern="\[LOG:GITHUB\].*pr_created\|\[LOG:GITHUB\].*PR"`)
- [ ] Status updates correct? (`Grep pattern="\[LOG:STATUS\]"`)

### Feature Branch Flow (Multi-Phase Only)

For multi-phase features, verify the feature branch workflow is correctly implemented:

**Detection Patterns:**
```bash
# Check if feature branch workflow was used
Grep pattern="\[LOG:FEATURE_BRANCH\]" path="agent-logs/issue-{N}.md"

# Find feature branch creation
Grep pattern="\[LOG:FEATURE_BRANCH\].*Creating feature branch" path="agent-logs/issue-{N}.md"

# Find PR targeting
Grep pattern="\[LOG:FEATURE_BRANCH\].*targeting" path="agent-logs/issue-{N}.md"

# Find final PR creation
Grep pattern="\[LOG:FEATURE_BRANCH\].*Final PR" path="agent-logs/issue-{N}.md"

# Find Final Review transitions
Grep pattern="\[LOG:FINAL_REVIEW\]" path="agent-logs/issue-{N}.md"
```

**Feature Branch Checklist:**
- [ ] Multi-phase detection: `\[LOG:FEATURE_BRANCH\].*Multi-phase feature` or `\[LOG:FEATURE_BRANCH\].*Detected multi-phase`
- [ ] Feature branch created: `\[LOG:FEATURE_BRANCH\].*Creating feature branch.*from main`
- [ ] Phase PRs target feature branch: `\[LOG:FEATURE_BRANCH\].*targeting feature branch`
- [ ] Final PR created after last phase: `\[LOG:FEATURE_BRANCH\].*Final PR.*created`
- [ ] Final Review status set: `\[LOG:FINAL_REVIEW\].*Status transition.*Final Review`
- [ ] Branch cleanup after merge: `\[LOG:FEATURE_BRANCH\].*Deleted branch`

**Common Issues to Flag:**
- ❌ Phase PR targeting main instead of feature branch (should see `targeting feature branch`)
- ❌ Feature branch not created for multi-phase (should see `Creating feature branch`)
- ❌ Final PR not created after last phase (should see `Final PR` after all phases complete)
- ⚠️ Branches not cleaned up after merge (should see `Deleted branch` entries)

### Task Runner Logs (MANDATORY for any failure — not optional)

**Always check task runner logs when you see errors, missing phases, or anomalies. Do not skip this step.**

- [ ] Did the run fail or timeout? (Check `status-*.json` files around the phase timestamp)
- [ ] Git fetch/push failures? (`Grep pattern="\[ERR\].*fatal\|Could not read from remote" path="agent-tasks/all/runs/output-*.log"`)
- [ ] GitHub API timeouts? (`Grep pattern="Connect Timeout\|UND_ERR_CONNECT_TIMEOUT" path="agent-tasks/all/runs/output-*.log"`)
- [ ] Process killed by timeout? (Status file shows `"status": "timeout"`)
- [ ] Script exit with non-zero code? (`Grep pattern="failed with exit code" path="agent-tasks/all/runs/output-*.log"`)
- [ ] Agent never started processing? (`Grep pattern="No items to process" path="agent-tasks/all/runs/output-*.log"` for the specific agent phase)

**Common Infrastructure Patterns:**
- ❌ **Network flap**: Multiple agents fail with `Connect Timeout` in the same run → transient network issue, not an agent bug
- ❌ **Git SSH failure**: `Could not read from remote repository` → SSH key or network issue
- ❌ **Run timeout (15min)**: Long-running implementation killed mid-execution → consider increasing timeout or splitting work
- ⚠️ **Retry succeeded**: Failed run followed by successful run within minutes → transient failure, but should verify no data corruption

### Directory Lock
- [ ] Lock acquired at start? (`Grep pattern="\\[LOCK\\].*acquired" path="agent-tasks/all/runs/output-*.log"`)
- [ ] Lock released at end? (`Grep pattern="\\[LOCK\\].*released" path="agent-tasks/all/runs/output-*.log"`)
- [ ] Stale lock force-cleared? (`Grep pattern="\\[LOCK\\].*Stale" path="agent-tasks/all/runs/output-*.log"`) — investigate why previous run didn't release
- [ ] Lock blocked run? (`Grep pattern="\\[LOCK\\].*held by" path="agent-tasks/all/runs/output-*.log"`) — check if concurrent runs are happening
- [ ] Lock held duration reasonable? (compare `[LOCK].*released.*held for` to total run duration)

### Prompts
- [ ] Agent confused? (`Grep pattern="\[LOG:RESPONSE\]"` then read for confusion indicators)
- [ ] Missing context? (`Grep pattern="\[LOG:TOOL_RESULT\].*not found\|\[LOG:ERROR\].*missing"`)

### Systemic Improvement (Feedback Loop)

**When any phase ends with "Request Changes" or requires multiple iterations**, investigate how the overall system can be improved. The goal is not to fix this specific issue, but to improve the agents' ability to handle similar issues in the future.

**Trigger**: Look for multiple Implementation/PR Review cycles, design revisions, or clarification requests.

**Key Principle: Docs/Rules are the Source of Truth**

The workflow architecture:
1. **Tech design** identifies relevant docs/rules as "related files"
2. **Implementation** receives and follows those docs
3. If docs have the correct info, the pipeline works

**Do NOT bloat prompts with feature-specific guidelines.** If every issue adds specific fixes to prompts, they become unmaintainable.

---

**Investigation Priority (in order):**

**1. First: Update Project Docs/Rules** (preferred solution)
   - Is there a missing pattern in `docs/` that should be documented?
   - Should `CLAUDE.md` or `.ai/commands/` be updated?
   - Example: Missing "multi-cache update" pattern in `docs/react-query-mutations.md`

**2. Second: Verify the Pipeline Worked**
   - Did the tech design include the relevant docs as "related files"?
   - If YES → the gap is in doc content (fix the doc)
   - If NO → tech design prompt may need better doc selection guidance

**3. Third: General Prompt Principles** (only if truly universal)
   - Is this a universal principle that applies to ALL features?
   - Examples: "verify schema before designing UI", "follow project docs over reviewer suggestions"
   - Keep it brief (1-2 lines) - not feature-specific guidance

**4. Last Resort: Feature-Specific Prompt Additions** (avoid)
   - Only if the pattern is too unique to generalize
   - Usually indicates a missing doc/rule instead

---

**Checklist for each finding:**

- [ ] Can this be fixed by updating a doc in `docs/`?
- [ ] Can this be fixed by updating `CLAUDE.md` or `.ai/commands/`?
- [ ] Did tech design include the relevant docs? (check log for "related files")
- [ ] Is this a universal principle (applies to all features)?
- [ ] Would adding to prompt make it bloated/unmaintainable?

**Output format:**

```
## Systemic Improvement: [Issue Title]

### Finding: [What went wrong]
- Root cause: [Why it happened]
- Tech design included relevant docs: Yes/No

### Recommended Fix (choose one):
1. **Update docs** → [specific doc and what to add]
2. **Update rules** → [specific rule file and what to add]
3. **General prompt note** → [brief universal principle]
```

**This is the most valuable part of the review** - each issue processed is an opportunity to make the entire agent workflow better for future issues.

---

## Log File Structure Reference

Log files use `[LOG:TYPE]` markers for easy grep searching:

```markdown
# Issue #33: [title]
**Type:** feature/bug
**Started:** [ISO timestamp]

## [LOG:PHASE_START] Phase: [Product Design/Tech Design/Implement/PR Review]
**Agent:** [agent-type]
**Mode:** [New design/Feedback/Clarification]
**Started:** [HH:MM:SS]

### [LOG:PROMPT] Prompt
**Model:** sonnet | **Tools:** Read, Glob, Grep, WebFetch | **Timeout:** 600s

### [LOG:EXECUTION_START] Agent Execution
**[HH:MM:SS]** [LOG:TOOL_CALL] 🔧 Tool: [name] (ID: [id])
**[HH:MM:SS]** [LOG:TOOL_RESULT] ✅ Result: [name] (ID: [id])
**[HH:MM:SS]** [LOG:THINKING] 💭 Thinking: [content]
**[HH:MM:SS]** [LOG:RESPONSE] 📝 Response: [content]
**[HH:MM:SS]** [LOG:TOKENS] 📊 Tokens: [in]/[out] | Cost: $X.XX
**[HH:MM:SS]** [LOG:STATUS] 🔄 Status: [from] → [to]
**[HH:MM:SS]** [LOG:GITHUB] 🔀 pr_created: [details]
**[HH:MM:SS]** [LOG:ERROR] ❌ Error: [message]
**[HH:MM:SS]** [LOG:FATAL] ❌ Error: [message]
### [LOG:EXECUTION_END] Agent Execution

---

## [LOG:PHASE_END] Phase: [Product Design/Tech Design/Implement/PR Review]
**Duration:** Xm Xs
**Tool calls:** N
**Tokens:** N
**Cost:** $X.XX
**Status:** ✅ Success

## [LOG:SUMMARY] Summary
| Phase | Duration | Tools | Tokens | Cost |
```

### Marker Reference

| Marker | Description |
|--------|-------------|
| `[LOG:PHASE_START]` | Beginning of a workflow phase |
| `[LOG:PHASE_END]` | End of phase with result summary (includes phase name) |
| `[LOG:EXECUTION_START]` | Beginning of agent execution within a phase |
| `[LOG:EXECUTION_END]` | End of agent execution within a phase |
| `[LOG:PROMPT]` | Prompt sent to Claude API |
| `[LOG:TOOL_CALL]` | Tool invocation |
| `[LOG:TOOL_RESULT]` | Tool response |
| `[LOG:THINKING]` | Extended thinking block |
| `[LOG:RESPONSE]` | Text response from agent |
| `[LOG:TOKENS]` | Token usage and cost |
| `[LOG:STATUS]` | Status transition |
| `[LOG:GITHUB]` | GitHub API action |
| `[LOG:ERROR]` | Non-fatal error |
| `[LOG:FATAL]` | Fatal error |
| `[LOG:SUMMARY]` | Final summary table |
| `[LOG:REVIEW]` | Issue review section (added by /workflow-review) |
| `[LOG:WEBHOOK_START]` | Webhook phase start |
| `[LOG:WEBHOOK_END]` | Webhook phase end |
| `[LOG:ACTION_START]` | GitHub Action phase start |
| `[LOG:ACTION_END]` | GitHub Action phase end |
| `[LOG:FEATURE_BRANCH]` | Feature branch workflow operations |
| `[LOG:FINAL_REVIEW]` | Final Review status transitions |

---

## Example Output

### Console Output (shown to user)

```
## Workflow Review: Issue #43

### Executive Summary
- **Issue**: Improve Feature Requests List UX/UI
- **Type**: Feature (L - Multi-phase)
- **Total Cost**: $2.45
- **Total Duration**: 45m
- **Phases**: 4 (Product -> Tech -> Implement -> PR Review)
- **Status**: Completed

### Findings

#### Critical (0)
None found.

#### Warning (2)

1. **Redundant File Reads Within Phase** (Tech Design phase)
   - `src/agents/shared/prompts.ts` read 4 times within single agent run
   - **Line**: 1245-1890
   - **Impact**: ~2000 extra tokens ($0.03)
   - **Recommendation**: Investigate if agent is re-reading unnecessarily (note: reads across different phases are expected)

2. **Long Thinking Block** (Implement phase)
   - 800 tokens of thinking for simple import statement
   - **Line**: 2105
   - **Recommendation**: Add example imports to prompt

#### Info (3)
[...]

### Recommendations
1. [High] Update prompts to include common import patterns
2. [Medium] Investigate within-phase redundant reads
3. [Low] Add explicit phase transition logging

✅ Review written to agent-logs/issue-43.md
```

### Written to Log File (appended to agent-logs/issue-43.md)

```markdown
---

## [LOG:REVIEW] Issue Review

**Reviewed:** 2026-01-28T10:30:00Z
**Reviewer:** workflow-review

### Executive Summary
- **Status**: Completed
- **Total Cost**: $2.45
- **Duration**: 45m
- **Overall Assessment**: Successful multi-phase feature implementation with minor efficiency improvements possible.

### Findings Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| Critical | 0 | None |
| Warning | 2 | Redundant file reads, long thinking blocks |
| Info | 3 | Minor optimizations |

### Action Items

> **Priority Legend:** 🔴 Critical (fix now) | 🟠 High (fix soon) | 🟡 Medium (should fix) | 🔵 Low (nice to have)

#### 🟠 High Priority
- [ ] Update implementation prompts to include common import patterns (reduces thinking overhead)

#### 🟡 Medium Priority
- [ ] Investigate redundant file reads in Tech Design phase (line 1245-1890)
- [ ] Consider caching frequently-read files within agent sessions

#### 🔵 Low Priority
- [ ] Add explicit phase transition timing logs

### Systemic Improvements

| Type | Target File | Recommendation |
|------|-------------|----------------|
| Prompt Update | `src/agents/prompts/implement.ts` | Add common import examples section |
| Doc Update | `docs/github-agents-workflow/efficiency.md` | Document expected vs redundant file reads |

### Notes
Multi-phase features (L/XL) naturally have more overhead due to independent agent sessions. The costs observed are within expected ranges for this feature size.
```
