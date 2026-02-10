---
number: 22
title: Per-Issue Plan Subagent Toggle
priority: Low
size: S
complexity: Low
status: TODO
dateAdded: 2026-01-27
dateUpdated: 2026-01-27
---

# Task 22: Per-Issue Plan Subagent Toggle

**Summary:** Add ability to toggle Plan Subagent on/off per issue, rather than globally via config.

## Problem

Currently, `planSubagent.enabled` in `agents.config.ts` is a global toggle. There's no way to enable/disable Plan Subagent for specific issues based on their characteristics (e.g., complexity, type).

## Possible Approaches

1. **Telegram checkbox** - Add a checkbox in the Telegram approval message to enable/disable Plan Subagent for this specific issue
2. **Issue labels** - Use GitHub labels (e.g., `skip-plan`, `with-plan`) to control behavior
3. **Auto-detection** - Automatically skip Plan Subagent for simple bugs or S-sized features
4. **Issue metadata** - Store preference in issue artifact comment

## Considerations

- Plan Subagent adds cost (~$0.05-0.20) but can improve implementation quality
- For simple issues, the plan may be unnecessary overhead
- For complex issues, the plan is valuable for reducing implementation iterations

## Files to Modify (TBD)

- `src/agents/lib/index.ts` - Accept per-run flag
- `src/agents/core-agents/implementAgent/` - Pass flag through
- Telegram notification code (if using checkbox approach)

## Notes

- Depends on choosing the right approach for the use case
- Consider monitoring Plan Subagent costs in workflow-review to inform decision

---
