/**
 * Configuration for Telegram Claude Bot
 */

import * as fs from 'fs';

// ============================================================
// CONSTANTS
// ============================================================

export const PROJECT_ROOT = process.cwd();

// ============================================================
// BOT CONFIGURATION
// ============================================================

export const BOT_CONFIG = {
    // Telegram settings
    telegramApiUrl: 'https://api.telegram.org/bot',
    pollingInterval: 1000,          // Polling interval in ms
    maxMessageLength: 4096,         // Telegram message character limit
    maxCallbackStorage: 100,        // Max stored callback data entries

    // Claude settings
    model: 'sonnet' as const,       // Claude model: 'sonnet' | 'opus' | 'haiku'
    maxTurns: 50,                   // Max conversation turns per request
    allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch', 'Bash'] as string[],

    // Button settings
    maxButtons: 4,                  // Max buttons per response
    buttonsPerRow: 2,               // Buttons per row in keyboard
};

// ============================================================
// SYSTEM PROMPT
// ============================================================

export function getSystemPrompt(allowedCommands: string[], previousSummary?: string | null): string {
    const allowedCommandsList = allowedCommands.map(c => `  - ${c}`).join('\n');

    return `You are helping with a codebase via Telegram. You have read-only access to files.

IMPORTANT - TELEGRAM CONVERSATION STYLE:
- Keep responses SHORT and conversational (max 2-3 paragraphs)
- Users expect chat-like messages, not documentation dumps
- Give a concise informative answer, then offer buttons to dive deeper
- Prefer multiple short exchanges over one long response
- Use bullet points for lists, keep them brief
- If a topic is complex, summarize the key point and offer "📚 More details" button

For Bash commands, you may ONLY run these specific commands:
${allowedCommandsList}

Do NOT run any other bash commands. If asked to run something not on the list, explain that it's not allowed.

IMPORTANT: Provide quick reply buttons for follow-up options and deep dives.
Your response will be parsed as JSON with this structure:
{
  "text": "Your response text here",
  "buttons": [
    {"label": "Short label", "callback": "Full text to send when clicked"},
    {"label": "Another option", "callback": "Another response text"}
  ]
}

Button guidelines:
- Labels should be short (1-4 words) with an emoji prefix (e.g., "📁 View files", "🔍 Search", "▶️ Run")
- Callback is what gets sent as the user's next message
- Always offer buttons for deeper exploration (e.g., "📚 More details", "🔍 Show example", "📂 Related files")
- Maximum ${BOT_CONFIG.maxButtons} buttons
- If no buttons needed, omit the buttons field or set to empty array

${previousSummary ? `Previous conversation summary:\n${previousSummary}\n\n` : ''}`;
}

// ============================================================
// STRUCTURED OUTPUT SCHEMA
// ============================================================

export const OUTPUT_SCHEMA = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            text: { type: 'string' },
            buttons: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        label: { type: 'string' },
                        callback: { type: 'string' }
                    },
                    required: ['label', 'callback'],
                    additionalProperties: false
                }
            }
        },
        required: ['text'],
        additionalProperties: false
    }
};

// ============================================================
// ALLOWED BASH COMMANDS
// ============================================================

function getAllowedBashCommands(): string[] {
    try {
        const packageJsonPath = `${PROJECT_ROOT}/package.json`;
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const scripts = Object.keys(packageJson.scripts || {});
        return scripts.map(script => `yarn ${script}`);
    } catch (error) {
        console.error('Failed to read package.json scripts:', error);
        return ['yarn checks', 'yarn build', 'yarn test'];
    }
}

export const ALLOWED_BASH_COMMANDS = getAllowedBashCommands();

// ============================================================
// ENVIRONMENT
// ============================================================

export function getConfig() {
    const botToken = process.env.CLAUDE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    const chatIdString = process.env.LOCAL_TELEGRAM_CHAT_ID;
    const adminUserId = process.env.TELEGRAM_ADMIN_USER_ID;

    if (!botToken) {
        console.error('❌ CLAUDE_TELEGRAM_BOT_TOKEN not found in .env');
        process.exit(1);
    }

    if (!chatIdString) {
        console.error('❌ LOCAL_TELEGRAM_CHAT_ID not found in .env');
        process.exit(1);
    }

    if (!adminUserId) {
        console.error('❌ TELEGRAM_ADMIN_USER_ID not found in .env');
        process.exit(1);
    }

    return { botToken, chatIdString, adminUserId };
}

export function parseChatId(chatIdString: string): { chatId: string; threadId?: number } {
    const lastColonIndex = chatIdString.lastIndexOf(':');

    if (lastColonIndex <= 0) {
        return { chatId: chatIdString };
    }

    const potentialThreadId = chatIdString.slice(lastColonIndex + 1);

    if (/^\d+$/.test(potentialThreadId)) {
        return {
            chatId: chatIdString.slice(0, lastColonIndex),
            threadId: parseInt(potentialThreadId, 10)
        };
    }

    return { chatId: chatIdString };
}
