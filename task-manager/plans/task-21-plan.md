# Plan: Integrate Plan Subagent into Agent Workflow

## Overview

Add implementation planning capabilities to the agent workflow:
1. **Tech Design Agent**: Add high-level "Implementation Plan" section to output (all libraries)
2. **Implementor Agent**: Claude-code lib internally uses Plan subagent before implementing (encapsulated)

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Plan location | Tech design (high-level) + implementor (detailed) | Fresh codebase state at implementation time |
| Plan granularity | Per-phase for L/XL, single plan for S/M | Avoids stale plans for multi-phase features |
| Plan subagent | claude-code-sdk + cursor | Both support plan mode (different mechanisms) |
| New artifacts | None | Keep it simple, no new files to manage |

## Implementation Status

### Task 1: Update Tech Design Prompt ✅
- [x] Edit `buildTechDesignPrompt()` in `src/agents/shared/prompts.ts`
- [x] Add "## Implementation Plan" section to required output format
- [x] Add instructions for phase-based organization (L/XL) vs single list (S/M)
- [x] Keep instructions for high-level steps (not overly detailed)
- [x] Update example templates to include Implementation Plan section

### Task 2: Update Bug Tech Design Prompt ✅
- [x] Edit `buildBugTechDesignPrompt()` in `src/agents/shared/prompts.ts`
- [x] Add "## Implementation Plan" section to example output
- [x] Single numbered list (bugs are typically single-phase)

### Task 3: Update Implementor with Plan Subagent ✅
- [x] Update `runAgent()` in `src/agents/lib/index.ts`
- [x] Add Plan subagent call before implementation for libraries that support it
- [x] Add `planMode` capability to `AgentLibraryCapabilities` interface
- [x] Add `planMode` option to `AgentRunOptions` interface
- [x] Update cursor adapter to support `--mode=plan` flag
- [x] Pass tech design + current phase info to Plan subagent
- [x] Include Plan subagent output in implementation prompt
- [x] Ensure encapsulation (workflow doesn't know about 2-step process)

### Task 4: Run Validation Checks
- [x] My changes don't introduce TypeScript errors
- [ ] Test tech design generation (verify Implementation Plan section appears)
- [ ] Test claude-code implementor (verify Plan subagent runs)

## Files Changed

1. `src/agents/shared/prompts.ts`:
   - Added "## Implementation Plan Section" instructions
   - Updated example templates for S/M features with Implementation Plan
   - Updated example templates for L/XL features with phase-based Implementation Plan
   - Updated bug fix example template with Implementation Plan

2. `src/agents/lib/index.ts`:
   - Added `runImplementationPlanSubagent()` function
   - Modified `runAgent()` to run Plan subagent for implementation workflow
   - Supports libraries with `planMode` capability (cursor) or claude-code-sdk
   - Plan subagent explores codebase and generates detailed step-by-step plan
   - Enhanced prompt is passed to main implementation agent

3. `src/agents/lib/types.ts`:
   - Added `planMode?: boolean` to `AgentLibraryCapabilities` interface
   - Added `planMode?: boolean` to `AgentRunOptions` interface

4. `src/agents/lib/adapters/cursor.ts`:
   - Added `planMode: true` capability
   - Updated `buildArgs()` to support `--mode=plan` flag
   - Updated `run()` to pass `planMode` option to `buildArgs()`

## How It Works

### Tech Design Agent (All Libraries)
The tech design prompt now instructs the LLM to include a "## Implementation Plan" section:
- For S/M features: Single numbered list of high-level steps
- For L/XL features: Steps organized by phase

### Implementor Agent (Claude-code Only)
When `runAgent()` is called with:
- `workflow === 'implementation'`
- `library.name === 'claude-code-sdk'`
- `allowWrite === true`

The function automatically:
1. Runs a Plan subagent with read-only tools to explore the codebase
2. Generates a detailed step-by-step implementation plan
3. Augments the original prompt with the detailed plan
4. Runs the main implementation agent with the enhanced prompt

### Other Agent Libraries
Other libraries (cursor, gemini, etc.) don't run the Plan subagent. They:
1. Receive the tech design with the high-level Implementation Plan section
2. Implement based on that guidance

## Notes

- The Plan subagent is fully encapsulated - the implementor agent and workflow code don't know about it
- Pre-existing TypeScript errors in test scripts are unrelated to these changes
- Plan subagent has 2-minute timeout
- If Plan subagent fails, implementation proceeds without the detailed plan

## Library-specific Implementation

| Library | Plan Mechanism | How It Works |
|---------|---------------|--------------|
| claude-code-sdk | Read-only tools | Runs with `allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch']` |
| cursor | `--mode=plan` flag | Runs with `--mode=plan` (built-in plan mode) |
| gemini, openai-codex | Not supported | No plan subagent, uses high-level plan from tech design |
