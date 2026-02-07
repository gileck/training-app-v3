# Telegram Integration

This document explains all Telegram functionality in the GitHub agents workflow, including notifications, quick actions, and setup.

## Overview

Telegram integration provides real-time notifications and one-click actions for the entire workflow. Admins receive instant alerts and can approve/reject/merge with a single button click.

**Key Features:**
- Real-time notifications for all workflow events
- One-click approve/reject/merge actions
- GitHub activity notifications (issues, PRs, commits)
- Separate notification channels for different event types
- Preview deployment notifications

## Notification Channels

The system supports **3 separate Telegram chats** to organize notifications by type and reduce information overload:

| Channel | Priority | Frequency | Config Env Var |
|---------|----------|-----------|----------------|
| **Agent Workflow** | High | High | `AGENT_TELEGRAM_CHAT_ID` |
| **GitHub Activity** | Low | Medium | `GITHUB_TELEGRAM_CHAT_ID` |
| **Vercel Deployments** | Medium | Low | `VERCEL_TELEGRAM_CHAT_ID` |

**Simple Mode (Single Chat):**
- Set only `LOCAL_TELEGRAM_CHAT_ID`
- All notifications go to one chat
- Good for low-traffic projects

**Advanced Mode (Multi-Chat):**
- Set all 3 channel-specific env vars
- Notifications routed by category
- Recommended for active projects

## Setup

### Prerequisites

1. **Create Telegram Bot:**
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Send `/newbot` and follow prompts
   - Save the bot token

2. **Get Chat IDs:**
   ```bash
   # Add TELEGRAM_BOT_TOKEN to .env first
   yarn telegram-setup
   ```

   This will:
   - Prompt you to message the bot
   - Display your chat ID
   - Optionally create group chats and get those IDs

3. **Configure Environment Variables:**

   **Simple Mode (single chat):**
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   LOCAL_TELEGRAM_CHAT_ID=your_chat_id
   ```

   **Advanced Mode (multi-chat):**
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   AGENT_TELEGRAM_CHAT_ID=agent_chat_id
   GITHUB_TELEGRAM_CHAT_ID=github_chat_id
   VERCEL_TELEGRAM_CHAT_ID=vercel_chat_id
   ```

4. **Deploy to Vercel:**
   ```bash
   # Push env vars to Vercel
   yarn vercel-cli env:push

   # Deploy
   git push origin main
   ```

### Webhook Setup

The Telegram webhook is automatically registered when the app starts. The webhook URL is:

```
https://your-app.vercel.app/api/telegram-webhook
```

**Verify webhook:**
```bash
curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

## Notification Types

### 1. Workflow Notifications (Agent Workflow Channel)

**New Feature Request/Bug Report:**
```
🎯 New Feature Request #45

Title: Add search functionality
User: john@example.com
Priority: High
Complexity: Medium

Description:
Users need ability to search tasks by title and description...

[Approve] [Reject]
```

**Approval Confirmation:**
```
✅ Feature Request #45 Approved

Issue created: https://github.com/user/repo/issues/45
Added to: Backlog

Where should this item start?

[🎨 Product Design] [🔧 Tech Design] [⚡ Ready for Dev] [📋 Backlog]
```

**Design PR Created:**
```
📝 Product Design Ready #45

Title: Add search functionality
Design PR: https://github.com/user/repo/pull/123

Please review the design document.

[Approve Design] [Reject Design]
```

**Design Approved:**
```
✅ Design Approved #45

Title: Add search functionality
PR merged: https://github.com/user/repo/pull/123
Status: Tech Design → Ready for Dev

Implementation will start automatically.
```

**Implementation PR Created:**
```
🔨 Implementation Ready #45

Title: Add search functionality
PR: https://github.com/user/repo/pull/124
Review Status: Waiting for Review

PR review agent will review automatically.
```

**PR Review Complete:**
```
✅ PR Review Passed #45

Title: Add search functionality
PR: https://github.com/user/repo/pull/124
Reviewer: Claude PR Review Agent

Commit message generated and saved.
Ready to merge.

[Merge PR] [Request Changes]
```

**Merge Confirmation:**
```
🎉 PR Merged #45

Title: Add search functionality
Commit: abc123def
Issue Status: Done

Feature successfully deployed!
```

**Merge Success Notification (new message with Revert button):**
```
✅ PR Merged Successfully

📝 PR: #124 - Add search functionality
🔗 Issue: #45 - Add search functionality

🎉 Implementation complete! Issue is now Done.

[📄 View PR] [📋 View Issue]
[↩️ Revert]
```

**Revert Confirmation:**
```
↩️ Merge Reverted

📋 Issue: #45 - Add search functionality
🔀 Original PR: #124
🔄 Revert PR: #125

📊 Status: Implementation
📝 Review Status: Request Changes

Next steps:
1️⃣ Click "Merge Revert PR" below to undo the changes
2️⃣ Go to Issue #45 and add a comment explaining what went wrong
3️⃣ Run `yarn agent:implement` - the agent will read your feedback and create a new PR

[✅ Merge Revert PR]
[📄 View Revert PR] [📋 View Issue]
```

**After Revert PR Merged:**
```
✅ Revert PR Merged
Changes have been reverted on main.

Next steps:
1️⃣ Go to Issue #45 and add a comment explaining what went wrong
2️⃣ Run `yarn agent:implement` - the agent will read your feedback and create a new PR
```

**Multi-Phase Progress:**
```
🔨 Phase 2/4 Implementation Ready #45

Title: Add search functionality
Phase: Backend API implementation
PR: https://github.com/user/repo/pull/125

Remaining phases: 2
```

**Agent Needs Clarification:**
```
🤔 Agent Needs Clarification

Phase: Tech Design
✨ Feature

📋 Add search functionality
🔗 Issue #45

Question:
What notification channels should be supported initially?

## Options
✅ Option 1: Email only
⚠️ Option 2: Email + Push notifications
⚠️ Option 3: In-app only

[💬 ANSWER QUESTIONS]
[📋 View Issue]
[✅ Clarification Received]
```

The "ANSWER QUESTIONS" button opens an interactive wizard UI (`/clarify/:issueNumber?token=...`) with:
- **Wizard flow**: One question at a time with progress indicator
- **Options**: Radio buttons with pre-defined choices (✅ recommended, ⚠️ alternatives)
- **"Other" option**: Text area for custom responses
- **Additional notes**: Optional context for any answer
- **Preview step**: Review all answers before submitting
- **Edit capability**: Go back to change any answer
- **Auto-submit**: Posts formatted answer to GitHub, updates status to "Clarification Received"

The page is a public, full-screen route (no authentication required, no header/navbar).

### 2. GitHub Activity Notifications (GitHub Channel)

**New Issue:**
```
📋 New Issue #46

Title: Fix login button alignment
Author: @username
Labels: bug, ui

https://github.com/user/repo/issues/46
```

**Issue Commented:**
```
💬 Comment on Issue #45

Author: @username
Issue: Add search functionality

Comment preview:
Should search be case-sensitive?

https://github.com/user/repo/issues/45#comment-123
```

**PR Opened:**
```
🔀 New Pull Request #127

Title: feat: Add dark mode toggle
Author: @username
Status: Open

https://github.com/user/repo/pull/127
```

**PR Merged:**
```
✅ PR Merged #127

Title: feat: Add dark mode toggle
Author: @username
Merged by: @admin

https://github.com/user/repo/pull/127
```

**Commit Pushed:**
```
📝 New Commit

Branch: main
Author: @username
Message: fix: resolve authentication bug

https://github.com/user/repo/commit/abc123
```

### 3. Vercel Deployment Notifications (Vercel Channel)

**Deployment Started:**
```
🚀 Deployment Started

Branch: main
Commit: abc123def
Environment: Production

Building...
```

**Deployment Success:**
```
✅ Deployment Successful

Branch: main
Environment: Production
URL: https://your-app.vercel.app

Build time: 2m 34s
```

**Deployment Failed:**
```
❌ Deployment Failed

Branch: main
Environment: Production

Error: Build failed - TypeScript errors

[View Logs](https://vercel.com/user/project/deployments/abc123)
```

**Preview Deployment:**
```
🔍 Preview Deployment Ready

Branch: feature/search
PR: #124
URL: https://your-app-git-feature-search.vercel.app

Test the changes before merging.
```

## Quick Actions

Quick actions allow admins to perform workflow operations with a single button click directly from Telegram.

### Approval Actions

**Approve Feature Request:**
- Button: `[Approve]` on new feature/bug notification
- Action: Creates GitHub issue, adds to Backlog
- Response: Routing message with phase selection buttons

**Reject Feature Request:**
- Button: `[Reject]` on new feature/bug notification
- Action: Updates MongoDB status to Rejected
- Response: Confirmation message

### Routing Actions

**Route to Product Design:**
- Button: `[🎨 Product Design]` on routing message
- Action: Moves issue to Product Design column
- Response: Confirmation + agent run prompt

**Route to Tech Design:**
- Button: `[🔧 Tech Design]` on routing message
- Action: Moves issue to Tech Design column
- Response: Confirmation + agent run prompt

**Route to Ready for Dev:**
- Button: `[⚡ Ready for Dev]` on routing message
- Action: Moves issue to Ready for Development column
- Response: Confirmation + agent run prompt

**Keep in Backlog:**
- Button: `[📋 Backlog]` on routing message
- Action: Keeps issue in Backlog (no change)
- Response: Confirmation message

### Design Review Actions

**Approve Design:**
- Button: `[Approve Design]` on design PR notification
- Action: Approves and merges design PR, advances status
- Response: Confirmation + next phase notification

**Request Changes on Design:**
- Button: `[📝 Request Changes]` on design PR notification
- Action: Requests changes on PR, updates review status
- Response: Confirmation + reminder to add explanation comment + **Undo button**

**Request Changes/Reject on Design Review:**
- Button: `[📝 Request Changes]` or `[❌ Reject]` on design review notification
- Action: Updates review status to Changes Requested or Rejected
- Response: Confirmation message + **Undo button**

### Implementation Review Actions

**Merge PR:**
- Button: `[Merge PR]` on PR review notification
- Action: Squash merges PR using saved commit message
- Response: Merge confirmation + success notification with Revert button

**Request Changes:**
- Button: `[Request Changes]` on PR review notification
- Action: Updates review status to Changes Requested
- Response: Confirmation + reminder to add explanation comment + **Undo button**

### Revert Actions

**Revert Merge:**
- Button: `[↩️ Revert]` on merge success notification
- Action: Creates a revert PR, restores workflow status
- Response: Confirmation with Merge Revert PR button and links

The Revert action is available after any PR merge and:
- Creates a revert PR (doesn't directly push to main)
- Restores the workflow status to "Implementation" with "Request Changes" review status
- For multi-phase features, restores the phase counter
- Updates MongoDB status back to in_progress/investigating
- The agent can then pick up the work and fix the issues based on feedback

**Merge Revert PR:**
- Button: `[✅ Merge Revert PR]` on revert confirmation notification
- Action: Merges the revert PR (squash merge), deletes the revert branch
- Response: Confirmation that changes have been reverted
- Note: Does not change status (stays as Implementation with Request Changes)

### Clarification Actions

**Answer Questions (Interactive UI):**
- Button: `[💬 ANSWER QUESTIONS]` on clarification notification
- Action: Opens web UI at `/clarify/:issueNumber?token=...`
- UI allows selecting from options or providing custom answer
- Submit → posts answer to GitHub, sets status to "Clarification Received"

**Mark Clarification Received (Fallback):**
- Button: `[✅ Clarification Received]` on clarification notification
- Action: Sets review status to "Clarification Received"
- Use this if you answered manually in GitHub comment
- Response: Confirmation message

### Undo Actions (5-Minute Window)

All "Request Changes" and "Reject" actions show an **Undo button** that remains active for 5 minutes. This allows you to recover from accidental clicks without manual intervention.

**Undo Implementation PR Request Changes:**
- Button: `[↩️ Undo (4:32)]` on confirmation message
- Action: Restores status to PR Review, clears review status
- Response: Re-sends the PR Ready notification with Merge/Request Changes buttons

**Undo Design PR Request Changes:**
- Button: `[↩️ Undo (4:32)]` on confirmation message
- Action: Clears review status (keeps design phase status)
- Response: Re-sends the Design PR Ready notification with Approve/Request Changes buttons

**Undo Design Review (Changes/Reject):**
- Button: `[↩️ Undo (4:32)]` on confirmation message
- Action: Clears review status
- Response: Sends new notification with Approve/Request Changes/Reject buttons

**After 5 Minutes:**
- Clicking Undo shows error: "Undo window expired (5 minutes)"
- Manual recovery required via admin workflow UI

**Example Undo Flow:**

1. Admin accidentally clicks `[Request Changes]` on PR Review:
```
✅ PR Review Passed #45
...
[Merge PR] [Request Changes]
```

2. Confirmation with Undo button appears:
```
🔄 Marked for Changes

📊 Status: Implementation
📋 Review Status: Request Changes

Next: Comment on the PR explaining what needs to change.

Changed your mind? Click Undo within 5 minutes.

[↩️ Undo (4:58)]
```

3. Admin clicks Undo within 5 minutes:
```
↩️ Undone!

📊 Status restored to: PR Review
📋 Review Status: (cleared)

Re-sending PR Ready notification...
```

4. Original notification re-sent:
```
✅ PR Review Passed #45
...
[Merge PR] [Request Changes]
```

## Action Flow Examples

### Complete Feature Approval Flow

**1. New Feature Request Submitted:**
```
🎯 New Feature Request #45
...
[Approve] [Reject]
```

**Admin clicks:** `[Approve]`

**2. Routing Message:**
```
✅ Feature Request #45 Approved
...
[🎨 Product Design] [🔧 Tech Design] [⚡ Ready for Dev] [📋 Backlog]
```

**Admin clicks:** `[🎨 Product Design]`

**3. Confirmation:**
```
✅ Issue #45 moved to Product Design

Run product design agent:
cd ../app-template-ai-agents && yarn agent:product-design
```

**4. Design PR Created (later):**
```
📝 Product Design Ready #45
...
[Approve Design] [Reject Design]
```

**Admin clicks:** `[Approve Design]`

**5. Design Merged:**
```
✅ Design Approved #45
...
Status: Tech Design → Ready for Dev
```

**6. Implementation PR Created (later):**
```
🔨 Implementation Ready #45
...
Review Status: Waiting for Review
```

**7. PR Review Complete:**
```
✅ PR Review Passed #45
...
[Merge PR] [Request Changes]
```

**Admin clicks:** `[Merge PR]`

**8. Final Confirmation:**
```
🎉 PR Merged #45
...
Issue Status: Done
```

### Design Rejection Flow

**1. Design PR Notification:**
```
📝 Product Design Ready #45
...
[Approve Design] [Reject Design]
```

**Admin clicks:** `[Reject Design]`

**2. Rejection Confirmation:**
```
❌ Design Rejected #45

PR: https://github.com/user/repo/pull/123

⚠️ IMPORTANT: Add a comment to the PR explaining why you rejected it.

The agent needs clear feedback to improve the design.
```

**Admin:** Adds detailed comment to PR

**3. Agent Response (later):**
```
📝 Updated Design Ready #45

PR: https://github.com/user/repo/pull/123
Changes: Incorporated feedback from review

Please review the updated design.

[Approve Design] [Reject Design]
```

## Webhook Implementation

The Telegram webhook handles all incoming messages and callback queries.

### Webhook Endpoint

**File:** `src/pages/api/telegram-webhook.ts`

**Request Format:**
```json
{
  "message": {
    "chat": { "id": 123456 },
    "text": "Message text"
  },
  "callback_query": {
    "id": "query123",
    "data": "action:param1:param2",
    "message": { "message_id": 789 }
  }
}
```

### Callback Query Format

All quick action buttons use callback queries with this format:

```
action:param1:param2:...
```

**Examples:**
- `approve_request:requestId` - Approve feature request and create GitHub issue
- `approve_bug:reportId` - Approve bug report and create GitHub issue
- `delete_request:requestId` - Delete feature request from MongoDB
- `delete_bug:reportId` - Delete bug report from MongoDB
- `route_feature:requestId:destination` - Route feature to destination
- `route_bug:reportId:destination` - Route bug to destination
- `approve_design:45:123` - Approve design PR #123 for issue #45
- `reject_design:45:123` - Reject design PR #123 for issue #45
- `merge_pr:45:124` - Merge implementation PR #124 for issue #45
- `request_changes:45:124` - Request changes on PR #124 for issue #45
- `clarified:45` - Mark clarification received for issue #45

**Undo Callbacks (5-minute window):**
- `u_rc:45:124:1234567890` - Undo implementation PR request changes (issue #45, PR #124, timestamp)
- `u_dc:123:45:tech:1234567890` - Undo design PR request changes (PR #123, issue #45, type, timestamp)
- `u_dr:45:changes:product-design:1234567890` - Undo design review changes/reject (issue #45, action, previous status, timestamp)

**Revert Callbacks:**
- `rv:45:124:abc1234:impl:1/3` - Revert merge (issue #45, PR #124, short SHA, previous status, phase)
- `merge_rv:45:125` - Merge the revert PR (issue #45, revert PR #125)

**URL Buttons:**
- `💬 ANSWER QUESTIONS` → Opens `/clarify/:issueNumber?token=...` (web UI for answering)

### Security

**Webhook Verification:**
```typescript
// Verify request is from Telegram
const token = process.env.TELEGRAM_BOT_TOKEN;
if (req.headers['x-telegram-bot-api-secret-token'] !== token) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**User Authorization:**
```typescript
// Only allow configured admin chat IDs
const allowedChatIds = [
  process.env.LOCAL_TELEGRAM_CHAT_ID,
  process.env.AGENT_TELEGRAM_CHAT_ID,
  process.env.GITHUB_TELEGRAM_CHAT_ID,
  process.env.VERCEL_TELEGRAM_CHAT_ID,
].filter(Boolean);

if (!allowedChatIds.includes(chatId.toString())) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

## Notification Utilities

### Sending Notifications

**From Server Code:**
```typescript
import { sendNotificationToOwner } from '@/server/telegram';

// Send to appropriate channel based on context
await sendNotificationToOwner(
  'Message text',
  'agent' // channel: 'agent' | 'github' | 'vercel'
);

// Send with quick action buttons
await sendNotificationToOwner(
  'Feature request needs approval',
  'agent',
  {
    inline_keyboard: [[
      { text: 'Approve', callback_data: 'approve_feature:45' },
      { text: 'Reject', callback_data: 'reject_feature:45' }
    ]]
  }
);
```

**Markdown Formatting:**
```typescript
await sendNotificationToOwner(
  `**Bold text**
  _Italic text_
  [Link text](https://example.com)
  \`code\`

  \`\`\`
  code block
  \`\`\``,
  'agent'
);
```

### Message Templates

**Create reusable templates:**
```typescript
// src/server/telegram/templates.ts

export function featureRequestTemplate(request: FeatureRequest) {
  return `🎯 New Feature Request #${request.id}

**Title:** ${request.title}
**User:** ${request.userEmail}
**Priority:** ${request.priority}
**Complexity:** ${request.complexity}

**Description:**
${request.description}`;
}

export function featureRequestButtons(requestId: number) {
  return {
    inline_keyboard: [[
      { text: 'Approve', callback_data: `approve_feature:${requestId}` },
      { text: 'Reject', callback_data: `reject_feature:${requestId}` }
    ]]
  };
}
```

**Usage:**
```typescript
await sendNotificationToOwner(
  featureRequestTemplate(request),
  'agent',
  featureRequestButtons(request.id)
);
```

## Troubleshooting

### Notifications Not Received

**Check:**
1. `TELEGRAM_BOT_TOKEN` is set correctly
2. Chat ID is correct (run `yarn telegram-setup` again)
3. Bot is not blocked by user
4. Webhook is registered (check with `/getWebhookInfo`)
5. Vercel deployment completed successfully

**Test notification:**
```bash
curl -X POST https://your-app.vercel.app/api/test-telegram
```

### Buttons Don't Work

**Check:**
1. Webhook is registered and responding
2. Callback query handler is implemented
3. Chat ID is authorized
4. No errors in Vercel function logs

**Debug:**
```typescript
// Add logging to webhook endpoint
console.log('Received callback query:', JSON.stringify(callbackQuery));
```

### Wrong Channel Routing

**Check:**
1. Channel-specific env vars are set correctly
2. Fallback to `LOCAL_TELEGRAM_CHAT_ID` is working
3. Channel parameter is passed correctly in code

**Verify configuration:**
```bash
# Check which env vars are set
yarn vercel-cli env:list
```

### Webhook Not Registered

**Re-register webhook:**
```bash
# Delete old webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/deleteWebhook

# Register new webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=https://your-app.vercel.app/api/telegram-webhook" \
  -d "allowed_updates=[\"message\",\"callback_query\"]"
```

## Best Practices

### Notification Design

**1. Be Concise**
- Include only essential information
- Use formatting for readability
- Keep messages under 4096 characters (Telegram limit)

**2. Use Clear Button Labels**
- Action-oriented: "Approve", "Merge PR"
- Not: "Yes", "OK", "Continue"

**3. Provide Context**
- Include issue/PR numbers
- Link to GitHub for details
- Show key information inline

**4. Confirm Actions**
- Send confirmation after button click
- Include what was done
- Provide next steps if applicable

### Button Design

**1. Limit Button Count**
- Max 8 buttons per message (Telegram recommendation)
- Group related actions
- Use separate messages for different contexts

**2. Order Matters**
- Primary action first (left/top)
- Destructive actions last (right/bottom)
- Example: `[Approve] [Reject]`, not `[Reject] [Approve]`

**3. Use Emojis Sparingly**
- Icons help visual scanning
- Don't overuse - reduces clarity
- Be consistent across messages

### Channel Organization

**Agent Workflow (High Priority):**
- Feature/bug approvals
- Design reviews
- PR merges
- Status updates

**GitHub Activity (Low Priority):**
- Issue comments
- Non-workflow PRs
- Commit notifications
- General repo activity

**Vercel Deployments (Medium Priority):**
- Production deployments
- Preview deployments
- Build failures

## Summary

**Setup:**
- Create bot with @BotFather
- Run `yarn telegram-setup` to get chat IDs
- Configure env vars (single or multi-chat)
- Deploy to Vercel

**Notification Channels:**
- Agent Workflow: High priority, high frequency
- GitHub Activity: Low priority, medium frequency
- Vercel Deployments: Medium priority, low frequency

**Quick Actions:**
- Approve/reject feature requests
- Route to workflow phases
- Approve/reject designs
- Merge/request changes on PRs
- **Revert merged PRs** (creates revert PR and restores workflow status)
- **Undo accidental clicks** (5-minute window for Request Changes/Reject actions)

**See also:**
- [Running Agents](./running-agents.md) - How to run agents and view logs
- [Feedback and Reviews](./feedback-and-reviews.md) - Handling feedback loops and reviews
