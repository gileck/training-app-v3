# Telegram Notifications

Server-side notification system that sends Telegram messages to users and administrators.

## Overview

The app sends Telegram bot notifications for two different purposes:

1. **User Notifications**: Personalized alerts sent to individual users via their Profile chat ID
2. **Owner/Admin Notifications**: System alerts sent to app owner(s) for deployments, GitHub activity, and agent workflows

This guide focuses on **owner notifications**, which can be split into 3 separate chats to reduce information overload.

## Notification Categories

Owner notifications are split into 3 categories by frequency and priority:

### Chat 1: Vercel Deployments (FYI - Catch Errors)
- Deployment started
- Deployment success
- Deployment failed
- Build errors

**Frequency:** Low (only on deployments)
**Priority:** Medium (good to catch errors, not urgent)

### Chat 2: GitHub Activity (FYI - Awareness)
- Issue comments
- PR comments
- PR reviews
- PR merged/closed
- New issues assigned

**Frequency:** Medium (depends on GitHub activity)
**Priority:** Low (informational, no action needed)

### Chat 3: Agent Workflow (Action Required - Important)
- Agent started/completed/failed
- PR created by agent
- PR approval needed
- Merge approval needed (with Telegram buttons)
- Rate limit hit
- Workflow stuck/stale
- Bug reports and feature requests

**Frequency:** High (active workflow)
**Priority:** High (requires admin action)

## Setup

> **⚠️ IMPORTANT: One Bot Per Project**
>
> If you have multiple projects based on this template, each needs its own Telegram bot. A bot can only have ONE webhook URL at a time, so sharing a bot across projects will break button callbacks.

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token you receive

### 2. Configure Environment

Add to `.env`:
```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### 3. Get Your Chat ID(s)

Run the setup script:
```bash
yarn telegram-setup
```

Then send any message to your bot. The script will display your chat ID and setup instructions.

**Two setup modes:**

#### Option A: Simple Mode (One Chat for All)
Use the same chat ID for all notification types. Good for low-volume projects or when you want everything in one place.

Add to `.env`:
```bash
LOCAL_TELEGRAM_CHAT_ID=123456789
```

#### Option B: Advanced Mode (Three Separate Chats)
Split notifications across 3 chats to reduce overload and prioritize important messages. You can create 3 separate chats or use Topics in a single Telegram group.

**To create separate chats:**
1. Create 3 private chats with your bot, or
2. Create 3 groups and add your bot, or
3. Create 1 group with Topics and add your bot to each topic

**Get each chat ID:**
Send a message from each chat to your bot, run `yarn telegram-setup` each time.

Add to `.env`:
```bash
# Chat 1: Vercel Deployments
VERCEL_TELEGRAM_CHAT_ID=123456789

# Chat 2: GitHub Activity
GITHUB_TELEGRAM_CHAT_ID=987654321

# Chat 3: Agent Workflow (most important!)
AGENT_TELEGRAM_CHAT_ID=555444333
```

### 4. Configure GitHub Actions Secrets

For GitHub workflows to send notifications, add secrets:

**GitHub → Settings → Secrets and variables → Actions**

Required for all modes:
```
TELEGRAM_BOT_TOKEN (your bot token)
```

**Simple mode:**
```
LOCAL_TELEGRAM_CHAT_ID=123456789  # Vercel deployments
TELEGRAM_CHAT_ID=123456789        # GitHub activity
```

**Advanced mode:**
```
VERCEL_TELEGRAM_CHAT_ID=123456789   # Vercel deployments
GITHUB_TELEGRAM_CHAT_ID=987654321   # GitHub activity
```

**Enable GitHub notifications:**
Add this variable (not secret):
```
TELEGRAM_NOTIFICATIONS_ENABLED=true
```

### 5. Configure Vercel Environment Variables

For runtime agent notifications, add to Vercel:

**Vercel → Settings → Environment Variables**

```
AGENT_TELEGRAM_CHAT_ID=555444333
```

Or use the Vercel CLI:
```bash
yarn vercel-cli env:push
```

This syncs your local `.env` to Vercel automatically.

### 6. (Optional) Add Chat ID to Profile for User Notifications

Users can receive personal notifications by adding their chat ID to their Profile:

1. Go to your Profile page in the app
2. Click "Edit"
3. Enter your Telegram Chat ID
4. Save

## Usage

### Send Notification to a User

```typescript
import { sendTelegramNotificationToUser } from '@/server/telegram';

// Send to a specific user (looks up their chat ID from database)
await sendTelegramNotificationToUser(userId, 'Your message here');

// With formatting options
await sendTelegramNotificationToUser(userId, '<b>Bold</b> message', {
    parseMode: 'HTML'
});
```

### Send to a Specific Chat ID

```typescript
import { sendTelegramNotification } from '@/server/telegram';

// Send directly to a chat ID
await sendTelegramNotification('123456789', 'Your message here');
```

## API Reference

### `sendTelegramNotificationToUser(userId, message, options?)`

Sends a notification to a user by looking up their `telegramChatId` from the database.

**Parameters:**
- `userId: string` - The user's ID
- `message: string` - Message text to send
- `options?: SendMessageOptions` - Optional formatting options

**Returns:** `Promise<SendMessageResult>`
- `{ success: true }` - Message sent successfully
- `{ success: false, error: string }` - Failed (user has no chat ID, bot token missing, etc.)

### `sendTelegramNotification(chatId, message, options?)`

Sends a notification directly to a specific chat ID.

**Parameters:**
- `chatId: string` - Telegram chat ID
- `message: string` - Message text to send
- `options?: SendMessageOptions` - Optional formatting options

### SendMessageOptions

```typescript
interface SendMessageOptions {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disableNotification?: boolean;
}
```

## Database Schema

The `telegramChatId` is stored on the User document:

```typescript
interface User {
    // ... other fields
    telegramChatId?: string;
}
```

## Files

| File | Description |
|------|-------------|
| `src/server/telegram/index.ts` | Notification service |
| `scripts/telegram-setup.ts` | CLI script to get chat ID |
| `src/client/routes/Profile/` | UI for setting chat ID |

## Error Handling

The notification functions fail silently - they return `{ success: false }` but don't throw errors. This prevents notification failures from breaking the main application flow.

```typescript
const result = await sendTelegramNotificationToUser(userId, message);
if (!result.success) {
    console.log('Notification not sent:', result.error);
}
```

## Backward Compatibility

The 3-chat system is **fully backward compatible**:

- If new chat ID env vars are not set, falls back to existing ones
- Existing setups continue working without changes
- You can migrate gradually (set one chat ID at a time)

**Fallback hierarchy:**

| Notification Type | Primary Env Var | Fallback |
|-------------------|-----------------|----------|
| Vercel Deployments | `VERCEL_TELEGRAM_CHAT_ID` | `LOCAL_TELEGRAM_CHAT_ID` |
| GitHub Activity | `GITHUB_TELEGRAM_CHAT_ID` | `TELEGRAM_CHAT_ID` |
| Agent Workflow | `AGENT_TELEGRAM_CHAT_ID` | `ownerTelegramChatId` in app.config.js |

## Troubleshooting

### Not receiving notifications?

1. **Check bot token:** Verify `TELEGRAM_BOT_TOKEN` is set in `.env`
2. **Check chat ID:** Run `yarn telegram-setup` and verify your chat ID is correct
3. **Check GitHub secrets:** For GitHub workflows, verify secrets are set in repository settings
4. **Check Vercel env vars:** For agent notifications, verify `AGENT_TELEGRAM_CHAT_ID` is set in Vercel
5. **Enable GitHub notifications:** Set `TELEGRAM_NOTIFICATIONS_ENABLED=true` in GitHub variables

### Receiving too many notifications?

Use Advanced Mode (3 chats) to split notifications by priority:
- Mute Chat 2 (GitHub activity) if you don't need FYI updates
- Keep Chat 3 (Agent workflow) unmuted for important actions
- Check Chat 1 (Vercel) occasionally for deployment issues

### Want to test notifications?

Send a test message:
```bash
# Using Node.js
node -e "
const fetch = require('node-fetch');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.AGENT_TELEGRAM_CHAT_ID;
fetch(\`https://api.telegram.org/bot\${BOT_TOKEN}/sendMessage\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: CHAT_ID, text: 'Test message' })
});
"
```
