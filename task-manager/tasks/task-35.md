---
number: 35
title: Add PR Merge Success Notification with Revert Button
priority: Medium
size: M
complexity: Medium
status: Done
dateAdded: 2026-02-01
dateUpdated: 2026-02-01
dateCompleted: 2026-02-01
planFile: task-manager/plans/task-35-plan.md
---

# Task 35: Add PR Merge Success Notification with Revert Button

**Summary:** After clicking "Merge PR" in Telegram and PR merges successfully, send a follow-up notification showing merge success, current phase state, and action buttons including a Revert option

## Details

When a user clicks the "Merge PR" button in Telegram and the PR is successfully merged:

1. Send a new Telegram message confirming the merge was successful
2. Show the current workflow state:
   - If this was the last phase: "All phases complete!"
   - If more phases remain: "Phase X of Y complete. Next: Phase Y"
3. Include action buttons:
   - **View PR** - Link to the merged PR
   - **View Issue** - Link to the parent GitHub issue
   - **Revert** - Revert the merge and reset the workflow status

The Revert button should:
- Create a revert PR or revert the merge commit
- Update the GitHub Project status back to the previous phase
- Send a confirmation message

## Implementation Notes

### Message Format

```
✅ *PR Merged Successfully*

📝 PR: #123 - Add user authentication
🔗 Issue: #100 - User login feature

📊 Progress: Phase 2 of 3 complete
⏭️ Next: Phase 3 - Final implementation

[View PR] [View Issue] [Revert]
```

Or for final phase:
```
✅ *PR Merged Successfully*

📝 PR: #123 - Final polish
🔗 Issue: #100 - User login feature

🎉 All phases complete! Feature ready for review.

[View PR] [View Issue] [Revert]
```

### Revert Flow

1. User clicks "Revert" button
2. Create revert commit/PR using GitHub API
3. Update GitHub Project item status back to previous column
4. Send confirmation: "Merge reverted. Status reset to [previous phase]"

## Files to Modify

- `src/server/telegram/handlers/` - Add merge success handler
- `src/server/telegram/messages/` - Add merge success message template
- `src/server/github/` - Add revert PR functionality
- `src/server/github-sync/` - Add status revert logic

## Dependencies

- Existing Telegram merge PR flow must be working
- GitHub Project integration for phase tracking

## Risks

- Revert might fail if there are conflicts
- Need to handle edge cases (PR already reverted, branch deleted, etc.)

## Notes

This improves the feedback loop for the agent workflow, giving users immediate confirmation and easy recovery options.
