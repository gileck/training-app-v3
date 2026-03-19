---
number: 33
title: "Add sendAgentNotification() Function for Agent-Specific Telegram Notifications"
priority: Medium
size: S
complexity: Low
status: TODO
dateAdded: 2026-01-30
---

# Task 33: Add sendAgentNotification() Function for Agent-Specific Telegram Notifications

**Summary:** Create a dedicated sendAgentNotification() function that uses AGENT_TELEGRAM_CHAT_ID env var for agent workflow notifications, supporting forum topics.

## Details

Currently, agent workflow notifications use sendNotificationToOwner() which is a generic function for all owner notifications. We need a dedicated function for agent notifications that uses the AGENT_TELEGRAM_CHAT_ID environment variable, supporting forum topics.

This separation allows agent notifications to be routed to a specific Telegram forum topic while keeping generic owner alerts (signups, errors, bug/feature submissions) in the main owner chat.

## Implementation Notes

1. **Add new function in `src/server/template/telegram/index.ts`:**

```typescript
/**
 * Send a Telegram notification for AGENT WORKFLOW events.
 *
 * This is for agent-specific notifications:
 * - Agent started/completed/failed
 * - PR created by agent
 * - Approval requests
 * - Workflow status updates
 *
 * Uses AGENT_TELEGRAM_CHAT_ID env var which supports forum topics (format: chatId:threadId).
 * Falls back to ownerTelegramChatId if env var not set.
 *
 * @example
 * await sendAgentNotification(`Agent completed: ${issueTitle}`);
 */
export async function sendAgentNotification(
    message: string,
    options?: SendMessageOptions
): Promise<SendMessageResult> {
    // Priority: AGENT_TELEGRAM_CHAT_ID env var (supports topics) → app.config fallback
    const chatId = process.env.AGENT_TELEGRAM_CHAT_ID || appConfig.ownerTelegramChatId;

    if (!chatId) {
        console.warn('[Telegram] Agent notification skipped: AGENT_TELEGRAM_CHAT_ID not configured');
        return { success: false, error: 'Agent chat ID not configured' };
    }

    return sendToChat(chatId, message, options);
}
```

2. **Revert app.config.js** - Remove any AGENT_TELEGRAM_CHAT_ID logic if present; ownerTelegramChatId should remain generic.

3. **Update callers to use the new function:**

   Replace sendNotificationToOwner() with sendAgentNotification() in:
   - `src/agents/shared/notifications.ts` - agent workflow notifications
   - `src/agents/lib/logging/cost-summary.ts` - cost summaries
   - `src/pages/api/telegram-webhook.ts` - multi-phase PR notifications (around line 1106)

   Keep sendNotificationToOwner() for generic owner alerts in:
   - `src/apis/reports/handlers/createReport.ts` - bug report alerts
   - `src/apis/feature-requests/handlers/createFeatureRequest.ts` - feature request alerts
   - `src/server/template/telegram/index.ts` - sendBugReportNotification, sendFeatureRoutingNotification, sendBugRoutingNotification

4. **Export the new function** from `src/server/template/telegram/index.ts`.

5. **Update documentation** in `docs/telegram-notifications.md`.

### Summary of separation

| Function | Purpose | Chat ID Source |
|----------|---------|----------------|
| `sendNotificationToOwner()` | Generic owner alerts (signups, errors, bug/feature submissions) | `appConfig.ownerTelegramChatId` |
| `sendAgentNotification()` | Agent workflow (progress, approvals, completions) | `AGENT_TELEGRAM_CHAT_ID` env var → fallback to appConfig |

## Files to Modify

- `src/server/template/telegram/index.ts` - Add sendAgentNotification() function
- `app.config.js` - Remove AGENT_TELEGRAM_CHAT_ID check if present
- `src/agents/shared/notifications.ts` - Use sendAgentNotification()
- `src/agents/lib/logging/cost-summary.ts` - Use sendAgentNotification()
- `src/pages/api/telegram-webhook.ts` - Use sendAgentNotification() for multi-phase PR notifications
- `docs/telegram-notifications.md` - Document the new function

## Notes

**Testing after implementation:**
1. Set AGENT_TELEGRAM_CHAT_ID to a forum topic ID (e.g., -1001234567890:16)
2. Trigger an agent notification
3. Verify it goes to the correct topic, not the generic owner chat
