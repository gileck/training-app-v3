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
- Errors and failures
- Inefficiencies (token/cost, redundant operations)
- Workflow bottlenecks
- Prompt improvement opportunities
- Code/infrastructure issues

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

## Step 3: Analyze Findings

For each red flag found:
1. Note the line number from Grep
2. Read only 50-100 lines around that area
3. Understand context and root cause
4. Categorize: Error / Inefficiency / Workflow issue / Prompt issue

## Step 4: Generate Recommendations

**Output**:
- Summary with severity (Critical / Warning / Info)
- Specific findings with line references
- Actionable improvements
- Priority ranking

## Step 5: Present Results

**Format**: Structured report with sections
**Optional**: Offer to create task/issue for major findings

## Step 6: Write Review to Issue Log File (REQUIRED)

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
| Rule Update | `.ai/skills/xyz/SKILL.md` | [What to add/change] |
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

---

## Analysis Checklist

### Errors & Failures
- [ ] Any error markers? (`Grep pattern="\[LOG:ERROR\]\|\[LOG:FATAL\]"`)
- [ ] Stack traces in error blocks? (Read lines around `[LOG:ERROR]` matches)
- [ ] Git operation failures? (`Grep pattern="\[LOG:GITHUB\].*failed\|\[LOG:ERROR\].*git"`)

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
   - Should `CLAUDE.md` or `.ai/skills/` be updated?
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
- [ ] Can this be fixed by updating `CLAUDE.md` or `.ai/skills/`?
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
