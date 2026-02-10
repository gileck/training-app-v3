---
number: 30
title: Telegram Interactive Clarification Flow for Agents
priority: High
size: L
complexity: High
status: Done
dateAdded: 2026-01-28
dateUpdated: 2026-01-28
dateCompleted: 2026-01-28
---

# Task 30: Telegram Interactive Clarification Flow for Agents

**Summary:** Enable agents to request user input via Telegram with a dedicated answer UI, supporting structured questions with options and free-text responses

## Details

### Problem
Currently, agents cannot easily request user input during workflow execution. When an agent needs clarification, there's no streamlined way to pause the workflow, ask questions, and receive structured answers.

### Proposed Solution
Implement a complete flow for agent-to-user clarification via Telegram:

#### 1. Agent Output Format
Agents can output a structured list of questions with options:
```
A. How should we implement the X?
   1. Option 1
   2. Option 2
   3. Option 3
   4. Add your option (free text)
B. Question 2...
   [Options for 2]
```

#### 2. Workflow Handling
When agent outputs clarification questions:
- Comment the questions to the GitHub issue
- Change review status to `waitingForClarification`
- Send Telegram message with an [ANSWER QUESTIONS] button

#### 3. Dedicated Answer UI
The [ANSWER QUESTIONS] button opens a new dedicated page (not the main admin panel):
- Shows questions with select buttons for predefined options
- Free text input for "Add your option" choices
- [SUBMIT ANSWERS] button at the bottom

#### 4. Answer Submission
When admin submits answers:
- Comment formatted answers to the GitHub issue
- Change review status to `clarificationReceived`
- Next agent run detects this status and reads the answers to continue

#### 5. Agent Clarification Mode
When agent runs with `clarificationReceived` status:
- Reads the answers from issue comments
- Continues workflow with the provided clarifications

## Implementation Notes

### Files to Create

- `src/client/routes/Clarify/index.tsx` - Main clarification page component
- `src/client/routes/Clarify/components/QuestionCard.tsx` - Single question renderer
- `src/client/routes/Clarify/hooks.ts` - Data fetching and submission hooks
- `src/apis/clarification/` - New API domain for clarification operations
- `src/agents/shared/clarificationParser.ts` - Parse questions/options from agent output

### Files to Modify

- `src/agents/shared/notifications.ts` - Change button URL in `notifyAgentNeedsClarification()`
- `src/agents/shared/prompts.ts` - Update `AMBIGUITY_INSTRUCTIONS` with machine-parseable format
- `src/client/routes/index.ts` - Add new Clarify route

### Technical Considerations

- The clarification UI should be simple and focused (not full admin panel)
- Mobile-first design for quick Telegram → answer flow
- Questions format should be parseable (structured markdown with clear delimiters)
- URL should include a token/signature for basic access control
- Multiple questions per clarification request supported

## Files to Modify

- `src/agents/shared/notifications.ts` - Change button URL in `notifyAgentNeedsClarification()`
- `src/agents/shared/prompts.ts` - Update `AMBIGUITY_INSTRUCTIONS` with machine-parseable format
- `src/client/routes/index.ts` - Add new Clarify route
- The clarification UI should be simple and focused (not full admin panel)
- Mobile-first design for quick Telegram → answer flow
- Questions format should be parseable (structured markdown with clear delimiters)
- URL should include a token/signature for basic access control
- Multiple questions per clarification request supported

## Dependencies

- Review statuses `waitingForClarification` and `clarificationReceived` already exist
- `handleClarificationRequest()` and `notifyAgentNeedsClarification()` already work
- All agents already support clarification mode

## Risks

- Agent output format change may need iteration to get right (backward compatibility)
- Mobile UX for the clarification UI needs careful design
- URL security - should the page be publicly accessible or require auth?
- Edge cases: expired clarification requests, multiple pending clarifications
