#!/usr/bin/env npx tsx
/**
 * Telegram Claude Code Bot POC
 *
 * A simple Telegram bot that forwards messages to Claude Code SDK
 * and sends responses back to the user.
 *
 * Usage:
 *   yarn telegram-bot
 */

import '../../src/agents/shared/loadEnv';
import { query, type SDKAssistantMessage, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

// ============================================================
// CONSTANTS
// ============================================================

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';
const PROJECT_ROOT = process.cwd();
const POLLING_INTERVAL = 1000; // 1 second
const MAX_MESSAGE_LENGTH = 4096; // Telegram message limit

// ============================================================
// TYPES
// ============================================================

interface TelegramUpdate {
    update_id: number;
    message?: {
        message_id: number;
        from: {
            id: number;
            first_name: string;
            username?: string;
        };
        chat: {
            id: number;
            type: string;
        };
        date: number;
        text?: string;
        message_thread_id?: number;
    };
}

interface TelegramResponse {
    ok: boolean;
    result: TelegramUpdate[];
}

// ============================================================
// TELEGRAM HELPERS
// ============================================================

function parseChatId(chatIdString: string): { chatId: string; threadId?: number } {
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

async function sendMessage(
    botToken: string,
    chatId: string,
    text: string,
    threadId?: number,
    replyToMessageId?: number
): Promise<void> {
    // Split long messages
    const chunks = splitMessage(text);

    for (const chunk of chunks) {
        const body: Record<string, unknown> = {
            chat_id: chatId,
            text: chunk,
            parse_mode: 'Markdown',
        };

        if (threadId) {
            body.message_thread_id = threadId;
        }

        if (replyToMessageId && chunks.indexOf(chunk) === 0) {
            body.reply_to_message_id = replyToMessageId;
        }

        try {
            const response = await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                // Retry without markdown if parsing fails
                body.parse_mode = undefined;
                await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }
}

function splitMessage(text: string): string[] {
    if (text.length <= MAX_MESSAGE_LENGTH) {
        return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= MAX_MESSAGE_LENGTH) {
            chunks.push(remaining);
            break;
        }

        // Find a good breaking point
        let breakPoint = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
        if (breakPoint === -1 || breakPoint < MAX_MESSAGE_LENGTH / 2) {
            breakPoint = remaining.lastIndexOf(' ', MAX_MESSAGE_LENGTH);
        }
        if (breakPoint === -1 || breakPoint < MAX_MESSAGE_LENGTH / 2) {
            breakPoint = MAX_MESSAGE_LENGTH;
        }

        chunks.push(remaining.slice(0, breakPoint));
        remaining = remaining.slice(breakPoint).trim();
    }

    return chunks;
}

async function sendTypingAction(botToken: string, chatId: string): Promise<void> {
    try {
        await fetch(`${TELEGRAM_API_URL}${botToken}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                action: 'typing'
            })
        });
    } catch {
        // Ignore typing action errors
    }
}

async function getUpdates(botToken: string, offset?: number): Promise<TelegramUpdate[]> {
    try {
        const params = new URLSearchParams({
            timeout: '30',
            allowed_updates: JSON.stringify(['message'])
        });

        if (offset !== undefined) {
            params.set('offset', String(offset));
        }

        const response = await fetch(`${TELEGRAM_API_URL}${botToken}/getUpdates?${params}`);
        const data = await response.json() as TelegramResponse;

        if (data.ok) {
            return data.result;
        }
    } catch (error) {
        console.error('Error getting updates:', error);
    }

    return [];
}

// ============================================================
// CLAUDE CODE SDK INTEGRATION
// ============================================================

async function processWithClaude(prompt: string): Promise<string> {
    const allowedTools = ['Read', 'Glob', 'Grep', 'WebFetch', 'Edit', 'Write', 'Bash'];
    let result = '';
    const toolCalls: string[] = [];

    console.log(`\n📝 Processing: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`);

    try {
        for await (const message of query({
            prompt,
            options: {
                allowedTools,
                cwd: PROJECT_ROOT,
                model: 'sonnet',
                maxTurns: 10,
                permissionMode: 'bypassPermissions',
                allowDangerouslySkipPermissions: true,
            },
        })) {
            // Handle assistant messages
            if (message.type === 'assistant') {
                const assistantMsg = message as SDKAssistantMessage;

                for (const block of assistantMsg.message.content) {
                    if (block.type === 'text') {
                        result = (block as { type: 'text'; text: string }).text;
                    }
                    if (block.type === 'tool_use') {
                        const toolUse = block as { type: 'tool_use'; name: string; input: Record<string, unknown> };
                        const target = toolUse.input?.file_path || toolUse.input?.pattern || toolUse.input?.command || '';
                        toolCalls.push(`${toolUse.name}${target ? `: ${String(target).slice(0, 50)}` : ''}`);
                        console.log(`  🔧 ${toolUse.name}`);
                    }
                }
            }

            // Handle final result
            if (message.type === 'result') {
                const resultMsg = message as SDKResultMessage;
                if (resultMsg.subtype === 'success' && resultMsg.result) {
                    result = resultMsg.result;
                }
            }
        }

        // Add tool summary if any were used
        if (toolCalls.length > 0) {
            const summary = `\n\n_Tools used: ${toolCalls.length}_`;
            result = result + summary;
        }

        console.log(`  ✅ Done (${result.length} chars)`);
        return result || 'No response generated.';

    } catch (error) {
        console.error('  ❌ Error:', error);
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
}

// ============================================================
// MAIN BOT LOOP
// ============================================================

async function main() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatIdString = process.env.LOCAL_TELEGRAM_CHAT_ID;

    if (!botToken) {
        console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
        process.exit(1);
    }

    if (!chatIdString) {
        console.error('❌ LOCAL_TELEGRAM_CHAT_ID not found in .env');
        process.exit(1);
    }

    const { chatId: allowedChatId, threadId: allowedThreadId } = parseChatId(chatIdString);

    console.log('🤖 Telegram Claude Code Bot starting...');
    console.log(`📍 Working directory: ${PROJECT_ROOT}`);
    console.log(`💬 Listening for chat ID: ${allowedChatId}${allowedThreadId ? ` (thread: ${allowedThreadId})` : ''}`);
    console.log('⏳ Waiting for messages...\n');

    let lastUpdateId: number | undefined;
    const processingMessages = new Set<number>();

    // Main polling loop
    while (true) {
        try {
            const updates = await getUpdates(botToken, lastUpdateId);

            for (const update of updates) {
                lastUpdateId = update.update_id + 1;

                const message = update.message;
                if (!message?.text) continue;

                // Check if message is from allowed chat
                const msgChatId = String(message.chat.id);
                if (msgChatId !== allowedChatId) {
                    console.log(`⚠️ Ignoring message from unauthorized chat: ${msgChatId}`);
                    continue;
                }

                // Check thread if configured
                if (allowedThreadId && message.message_thread_id !== allowedThreadId) {
                    continue;
                }

                // Skip if already processing
                if (processingMessages.has(message.message_id)) continue;
                processingMessages.add(message.message_id);

                const userText = message.text;
                const userName = message.from.first_name;

                console.log(`\n💬 Message from ${userName}: "${userText.slice(0, 50)}${userText.length > 50 ? '...' : ''}"`);

                // Handle special commands
                if (userText === '/start' || userText === '/help') {
                    await sendMessage(
                        botToken,
                        msgChatId,
                        '🤖 *Claude Code Bot*\n\nSend me any message and I\'ll process it with Claude Code SDK in the context of this project.\n\nI can read files, search code, make edits, and run commands.',
                        allowedThreadId,
                        message.message_id
                    );
                    processingMessages.delete(message.message_id);
                    continue;
                }

                // Send typing indicator
                await sendTypingAction(botToken, msgChatId);

                // Process with Claude
                const response = await processWithClaude(userText);

                // Send response
                await sendMessage(botToken, msgChatId, response, allowedThreadId, message.message_id);

                processingMessages.delete(message.message_id);
            }

        } catch (error) {
            console.error('Polling error:', error);
        }

        // Small delay between polls if no updates
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});

main().catch(console.error);
