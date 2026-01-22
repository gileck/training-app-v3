# Telegram Notifications

Server-side notification system that sends Telegram messages to users.

## Overview

The app can send Telegram bot notifications to users. Each user configures their own Telegram chat ID in their Profile, and notifications are sent per-user.

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
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### 3. Get Your Chat ID

Run the setup script:
```bash
yarn telegram-setup
```

Then send any message to your bot. The script will display your chat ID.

### 4. Add Chat ID to Profile

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
