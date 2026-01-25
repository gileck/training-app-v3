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

## Step 1: Load Log File
- **Objective**: Get the log file to analyze
- **Actions**:
  - If issue number provided: Read `agent-logs/issue-{N}.md`
  - If no argument: List logs, select most recent
  - Validate file exists and has content

## Step 2: Parse Log Structure
- **Objective**: Understand the execution context
- **Extract**:
  - Issue type (feature/bug)
  - Phases executed (Product Design, Tech Design, Implement, PR Review)
  - Models used
  - Total duration and cost
  - Phase-by-phase breakdown

## Step 3: Analyze for Issues
- **Categories**:
  1. **Errors**: Look for error markers, error messages, stack traces
  2. **Token Waste**: Repeated tool calls, large outputs not used
  3. **Performance**: Long phases, many tool calls for simple tasks
  4. **Reasoning Quality**: Thinking blocks that show confusion
  5. **Tool Usage**: Suboptimal tool selection, missing tools

## Step 4: Generate Recommendations
- **Output**:
  - Summary with severity (Critical / Warning / Info)
  - Specific findings with log references
  - Actionable improvements
  - Priority ranking

## Step 5: Present Results
- **Format**: Structured report with sections
- **Optional**: Offer to create task/issue for major findings

---

## Analysis Checklist

### Errors & Failures
- [ ] Any error markers?
- [ ] Stack traces present?
- [ ] Unhandled exceptions?
- [ ] Git operation failures?
- [ ] API/network errors?

### Efficiency
- [ ] Same file read multiple times?
- [ ] Large token counts for simple tasks?
- [ ] Redundant Grep/Glob patterns?
- [ ] Excessive thinking for trivial decisions?

### Workflow
- [ ] Phase transitions correct?
- [ ] Status changes appropriate?
- [ ] Auto-advance working?
- [ ] PR created successfully?

### Prompts
- [ ] Agent confused by prompt?
- [ ] Missing context in prompt?
- [ ] Prompt too long/verbose?
- [ ] Output format issues?

---

## Log File Structure Reference

Log files follow this format:
```markdown
# Issue #33: [title]
**Type:** feature/bug
**Started:** [ISO timestamp]

## Phase: [Product Design/Tech Design/Implement/PR Review]
**Agent:** [agent-type]
**Mode:** [New design/Feedback/Clarification]
**Started:** [HH:MM:SS]

### Prompt
**Model:** sonnet | **Tools:** Read, Glob, Grep, WebFetch | **Timeout:** 600s

### Agent Execution
**[HH:MM:SS]** Tool: [name] (ID: [id])
**[HH:MM:SS]** Result (ID: [id])
**[HH:MM:SS]** Thinking: [content]
**[HH:MM:SS]** Response: [content]
**[HH:MM:SS]** Tokens: [in]/[out] | Cost: $X.XX

### Phase Result
**Duration:** Xm Xs | **Tool calls:** N | **Tokens:** N | **Cost:** $X.XX

## Summary
| Phase | Duration | Tools | Tokens | Cost |
```

---

## Example Output

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

1. **Redundant File Reads** (Tech Design phase)
   - `src/agents/shared/prompts.ts` read 4 times
   - **Timestamp**: [11:45:22] - [11:52:18]
   - **Impact**: ~2000 extra tokens ($0.03)
   - **Recommendation**: Cache file contents in agent context

2. **Long Thinking Block** (Implement phase)
   - 800 tokens of thinking for simple import statement
   - **Timestamp**: [14:22:10]
   - **Recommendation**: Add example imports to prompt

#### Info (3)
[...]

### Recommendations
1. [High] Update prompts to include common import patterns
2. [Medium] Consider file caching for repeated reads
3. [Low] Add explicit phase transition logging
```
