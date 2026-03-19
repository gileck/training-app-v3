---
number: 12
title: Improve Telegram Messages
priority: Low
size: S
complexity: Low
status: Done
dateAdded: 2026-01-27
dateCompleted: 2026-01-25
completionCommit: fd4af46
---

# Task 12: Improve Telegram Messages

**Summary:** Too many messages cause information overload on Telegram. Need to consolidate and filter notifications.

## Files to Modify

- `src/server/template/telegram/index.ts` - Add filtering logic
- `src/server/template/telegram/types.ts` - Add NotificationLevel enum
- `src/agents/shared/config.ts` - Add notification preferences
- `src/agents/lib/logging/index.ts` - Tag notifications with severity
- --

## Notes

Requires Telegram topic/thread support or editing previous messages.

### Option D: Notification Preferences (Most Flexible)

User-configurable preferences:

```typescript
const notificationPrefs = {
  // Per-event toggles
  agentStarted: false,
  agentCompleted: true,
  agentFailed: true,
  prCreated: true,
  prMerged: true,
  reviewApproved: true,
  reviewRejected: true,
  rateLimitHit: true,

  // Batching
  batchNonCritical: true,
  batchIntervalMinutes: 30,

  // Quiet hours
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};
```
