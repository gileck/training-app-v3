# Telegram Claude Code Bot

A Telegram bot that provides a chat interface to Claude Code SDK, allowing you to interact with your codebase through Telegram.

## Features

- **Chat with Claude** - Send messages and get AI-powered responses about your codebase
- **File Access** - Claude can read, search, and explore files in your project
- **Yarn Scripts** - Run any `yarn` script defined in your package.json
- **Session Persistence** - Conversations persist across bot restarts
- **Inline Buttons** - Quick reply buttons for common actions
- **Structured Output** - Claude returns formatted responses with optional action buttons

## Setup

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 2. Get Your Chat ID

1. Start a chat with your bot or add it to a group
2. For groups with topics, note the thread ID from the URL

### 3. Configure Environment Variables

Add to your `.env` file:

```bash
CLAUDE_TELEGRAM_BOT_TOKEN=your_bot_token_here
LOCAL_TELEGRAM_CHAT_ID=your_chat_id_here
TELEGRAM_ADMIN_USER_ID=your_telegram_user_id
```

To get your user ID, message [@userinfobot](https://t.me/userinfobot) on Telegram.

For group topics, use the format: `chat_id:thread_id`
```bash
LOCAL_TELEGRAM_CHAT_ID=-1001234567890:42
```

### 4. Run the Bot

```bash
yarn telegram-bot
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/help` | Show help message and session status |
| `/clear` | Clear conversation history and start fresh |
| `/summary` | Summarize conversation and save context for later |
| `/list-commands` | Show all available yarn scripts |

## How It Works

1. **Message Reception** - Bot uses long polling to receive messages from Telegram
2. **Session Management** - Each chat has its own session with Claude, persisted to `.telegram-bot-sessions.json`
3. **Claude Processing** - Messages are sent to Claude Code SDK with access to:
   - `Read` - Read files
   - `Glob` - Find files by pattern
   - `Grep` - Search file contents
   - `WebFetch` - Fetch web content
   - `Bash` - Run allowed yarn scripts only
4. **Structured Response** - Claude returns JSON with text and optional buttons
5. **Message Delivery** - Response sent back to Telegram with inline keyboard if buttons provided

## Security

- **Restricted Chat** - Only responds to messages from the configured `LOCAL_TELEGRAM_CHAT_ID`
- **Admin User Only** - Only the `TELEGRAM_ADMIN_USER_ID` can interact with the bot
- **Limited Bash** - Only yarn scripts from package.json are allowed
- **No Write Access** - Claude has read-only file access by default
- **Silent Rejection** - Unauthorized attempts are logged internally without response

## File Structure

```
telegram-bot/
├── index.ts      # Main entry point & polling loop
├── types.ts      # TypeScript type definitions
├── config.ts     # Configuration & environment
├── sessions.ts   # Session persistence & callbacks
├── telegram.ts   # Telegram API functions
├── claude.ts     # Claude SDK integration
└── README.md     # This file
```

## Session Persistence

Sessions are saved to `.telegram-bot-sessions.json` in the project root:

```json
{
  "chat_id:thread_id": {
    "sessionId": "uuid-from-claude-sdk",
    "summary": "Previous conversation summary if any",
    "messageCount": 5
  }
}
```

## Inline Buttons

Claude automatically suggests buttons when asking questions or offering choices:

- Buttons appear in a 2-column grid
- Each button has an emoji prefix (e.g., "📁 View files")
- Clicking a button sends the callback text as a new message
- Callback data stored in memory (survives Telegram's 64-byte limit)

## Troubleshooting

### Bot doesn't receive messages
- Ensure `LOCAL_TELEGRAM_CHAT_ID` matches your chat
- For groups: disable privacy mode via BotFather (`/setprivacy` → Disable)
- Check for webhook conflicts: bot auto-deletes webhooks on startup

### Session not resuming
- Check `.telegram-bot-sessions.json` exists and has valid data
- Use `/clear` to start fresh if session is corrupted

### Markdown formatting issues
- Bot auto-converts `**bold**` to `*bold*` for Telegram
- Falls back to plain text if markdown parsing fails
