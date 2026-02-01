---
title: Send Message to User (Claude Code Only)
description: CLI tool for Claude Code to send Telegram messages to developer. Use this for long-running task notifications.
summary: Run `yarn send-telegram "message"` to notify developer. Requires `LOCAL_TELEGRAM_CHAT_ID` in `.env`.
priority: 4
---

# Send Telegram Message (Claude Code CLI)

This is a CLI tool for Claude Code to send Telegram notifications to the developer during long-running tasks.

## Usage

```bash
yarn send-telegram "Your message here"
```

## Requirements

- `LOCAL_TELEGRAM_CHAT_ID` must be set in `.env`
- `TELEGRAM_BOT_TOKEN` must be configured

## When to Use

- Notify developer when a long-running task completes
- Send status updates during multi-step operations
- Alert on errors that need attention
