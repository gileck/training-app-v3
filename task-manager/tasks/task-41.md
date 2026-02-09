---
number: 41
title: "Add Admin Feedback Form for PR Request Changes via Telegram"
priority: High
size: M
complexity: Medium
status: TODO
dateAdded: 2026-02-04
---

# Task 41: Add Admin Feedback Form for PR Request Changes via Telegram

**Summary:** Create a web form that admin can open from Telegram to submit feedback/requested changes, which automatically posts the comment on the PR and changes status to "Request Changes"

## Details

When admin clicks "Request Changes" in Telegram, instead of immediately changing the status, they should be redirected to a feedback form where they can:
1. Add their feedback and requested changes as a comment
2. Submit the form to automatically post the comment on the PR
3. Change the PR review status to "Request Changes"

The admin should also have the option to request changes WITHOUT a comment (for cases where they already left the comment directly on the issue or PR).

## Implementation Notes

- Create a new route/page for the feedback form (e.g., `/admin/pr-feedback`)
- Form should accept issue ID/PR number as URL parameter
- Form fields:
  - Feedback/comments textarea (optional if admin checks "no comment" option)
  - Checkbox: "Request changes without comment" (for when comment was left directly on PR/issue)
  - Submit button
- On submit:
  - If comment provided: Post comment to PR using GitHub API
  - Update review status to "Request Changes" in GitHub Project
  - Send confirmation notification to Telegram
- Update Telegram webhook to redirect to this form instead of directly changing status

## Files to Modify

- `src/pages/admin/pr-feedback.tsx` - New page for feedback form (create)
- `src/client/routes/admin/pr-feedback/` - Route components and hooks (create)
- `src/apis/admin/pr-feedback/` - API for posting comment and updating status (create)
- `src/server/telegram/webhook/handlers/` - Update "Request Changes" button handler to redirect to form
- `src/server/github/` - May need PR comment posting functionality

## Dependencies

- Existing Telegram webhook infrastructure
- GitHub API integration for posting comments
- GitHub Projects API for status updates

## Risks

- Need to handle authentication for the admin page (ensure only admin can access)
- URL needs to be secure and not easily guessable (include auth token or session validation)
- Form submission should be idempotent to prevent duplicate comments
