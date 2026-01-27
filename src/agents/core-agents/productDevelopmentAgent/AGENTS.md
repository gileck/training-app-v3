# Product Development Agent

## Overview

The Product Development Agent is an **OPTIONAL** phase that transforms vague feature ideas into concrete product specifications. It sits between Backlog and Product Design in the workflow.

**Key Differentiator:**
- **Product Development** (this agent): WHAT to build & WHY (requirements, business value)
- **Product Design**: HOW it looks & feels (UI/UX, user flows)
- **Technical Design**: HOW to implement (architecture, code structure)

## When to Use

Route to Product Development when:
- Feature idea is vague or incomplete
- Requirements need clarification
- Acceptance criteria need to be defined
- Scope boundaries are unclear

**Skip Product Development** when:
- Requirements are already clear
- Feature has detailed specifications
- It's a bug report (bugs always skip this phase)

## Workflow

```
Backlog → [Product Development] → Product Design → Tech Design → Implementation → PR Review → Done
                  ↑
            (OPTIONAL)
```

### Flow A: New Document
1. Fetches items in "Product Development" status with empty Review Status
2. Explores codebase in READ-ONLY mode
3. Generates Product Development Document (PDD)
4. Creates PR with design file at `design-docs/issue-{N}/product-development.md`
5. Sends Telegram notification with Approve & Merge buttons
6. Sets Review Status to "Waiting for Review"

### Flow B: Address Feedback
1. Fetches items with Review Status = "Request Changes"
2. Reads admin feedback from PR comments
3. Revises the PDD based on feedback
4. Updates existing PR
5. Sets Review Status back to "Waiting for Review"

### Flow C: Clarification
1. Fetches items with Review Status = "Clarification Received"
2. Reads admin's clarification from issue comments
3. Continues generating the PDD
4. Creates/updates PR

## Output Document Structure

The PDD includes:

```markdown
# Product Development: [Feature Title]

**Size: M**

## Problem Statement
[1-2 paragraphs explaining the problem and why it matters]

## Target Users
[Who are the users? What are their key needs?]

## Requirements

### R1: [First requirement]
**Acceptance Criteria:**
- [ ] [Testable condition 1]
- [ ] [Testable condition 2]

### R2: [Second requirement]
**Acceptance Criteria:**
- [ ] [Testable condition 1]

## Success Metrics
- [Metric 1]: [How to measure]
- [Metric 2]: [How to measure]

## Scope

### In Scope
- [Feature/capability 1]
- [Feature/capability 2]

### Out of Scope
- [Feature NOT included 1] - [Why/when it might be added]
```

**Optional Sections:**
- Dependencies
- Risks & Mitigations
- Open Questions

## Size Estimates

| Size | Meaning | Typical Duration |
|------|---------|------------------|
| S | Small, few hours | < 1 day |
| M | Medium | 1-2 days |
| L | Large | Multiple days |
| XL | Epic | Weeks, may need multiple phases |

## Integration with Product Design

When a PDD is approved:
1. Auto-advances to Product Design status
2. Product Design Agent reads the PDD from file
3. PDD provides context for UI/UX design decisions
4. Product Design focuses on HOW it looks, not WHAT to build

## CLI Usage

```bash
# Process all pending items
yarn agent:product-dev

# Process specific item
yarn agent:product-dev --id <item-id>

# Preview without saving
yarn agent:product-dev --dry-run

# Stream Claude output
yarn agent:product-dev --stream
```

## Configuration

Uses the same configuration as other agents in `src/agents/agents.config.ts`.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Main agent script |
| `AGENTS.md` | This documentation |

## Telegram Notifications

### Routing Notification
Features show "📋 Product Dev" button (bugs do not):
```
Where should this feature start?

[📋 Product Dev] [🎨 Product Design]
[🔧 Tech Design] [⚡ Implementation]
[📋 Keep in Backlog]
```

### PR Ready Notification
```
Agent (Product Development): ✅ PR Ready

📋 Feature title
🔗 Issue #123 → PR #456

[✅ Approve & Merge] [📝 Request Changes]
[👀 View PR]
```

## Error Handling

- **Bug reports**: Automatically skipped with message explaining bugs bypass this phase
- **Missing issue**: Returns error, no notification sent
- **Agent clarification needed**: Posts question to issue, sets "Waiting for Clarification"
- **Uncommitted changes**: Fails fast, requires clean working directory
