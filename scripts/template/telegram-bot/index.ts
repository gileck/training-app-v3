#!/usr/bin/env npx tsx
/**
 * Telegram Claude Code Bot
 *
 * A Telegram bot that forwards messages to Claude Code SDK
 * and sends responses back to the user with inline button support.
 *
 * Usage:
 *   yarn telegram-bot
 *
 * Environment variables:
 *   CLAUDE_TELEGRAM_BOT_TOKEN - Telegram bot token (or TELEGRAM_BOT_TOKEN)
 *   LOCAL_TELEGRAM_CHAT_ID - Chat ID to listen to (supports thread: chatId:threadId)
 */

import '../../../src/agents/shared/loadEnv';
import { getConfig, parseChatId, PROJECT_ROOT, ALLOWED_BASH_COMMANDS, BOT_CONFIG } from './config';
import { loadSessions, getOrCreateSession, clearSession, getCallback } from './sessions';
import { sendMessage, deleteMessage, answerCallbackQuery, deleteWebhook, getUpdates } from './telegram';
import { processWithClaude, summarizeConversation } from './claude';

// ============================================================
// MESSAGE VERIFICATION
// ============================================================

interface VerifyParams {
    chatId: string | null;
    threadId?: number;
    userId: number;
    username?: string;
    allowedChatId: string;
    allowedThreadId?: number;
    adminUserId: string;
}

function verifyMessage(params: VerifyParams): boolean {
    const { chatId, threadId, userId, username, allowedChatId, allowedThreadId, adminUserId } = params;

    if (chatId !== allowedChatId) {
        console.log(`⚠️ Unauthorized: wrong chat ${chatId} (user: ${username || userId})`);
        return false;
    }

    if (allowedThreadId && threadId !== allowedThreadId) {
        console.log(`⚠️ Unauthorized: wrong thread ${threadId} (user: ${username || userId})`);
        return false;
    }

    if (String(userId) !== adminUserId) {
        console.log(`⚠️ Unauthorized: wrong user ${userId} (${username || 'no-username'})`);
        return false;
    }

    return true;
}

// ============================================================
// MAIN BOT LOOP
// ============================================================

async function main() {
    const { botToken, chatIdString, adminUserId } = getConfig();
    const { chatId: allowedChatId, threadId: allowedThreadId } = parseChatId(chatIdString);

    console.log('🤖 Telegram Claude Code Bot starting...');
    console.log(`📍 Working directory: ${PROJECT_ROOT}`);
    console.log(`💬 Listening for chat ID: ${allowedChatId}${allowedThreadId ? ` (thread: ${allowedThreadId})` : ''}`);
    console.log(`👤 Admin user ID: ${adminUserId}`);
    console.log(`🔧 Allowed bash commands: ${ALLOWED_BASH_COMMANDS.length} yarn scripts`);

    // Load persisted sessions
    loadSessions();

    // Delete any existing webhook to enable polling
    await deleteWebhook(botToken);

    console.log('⏳ Waiting for messages...\n');

    // Check for existing session
    const chatKey = allowedThreadId ? `${allowedChatId}:${allowedThreadId}` : allowedChatId;
    const existingSession = getOrCreateSession(chatKey);
    const sessionInfo = existingSession.sessionId
        ? `\n🔄 Resuming session: \`${existingSession.sessionId.slice(0, 8)}...\` (${existingSession.messageCount} messages)`
        : '\n🆕 Starting fresh session';

    // Send startup message
    await sendMessage(
        botToken,
        allowedChatId,
        `🤖 *Hey, I'm online!*\n\nClaude Code Bot is ready.\n📍 Project: \`${PROJECT_ROOT.split('/').pop()}\`${sessionInfo}\n\n*Commands:*\n/clear - Start fresh\n/summary - Save context\n/list-commands - Show commands`,
        allowedThreadId
    );

    let lastUpdateId: number | undefined;
    const processingMessages = new Set<number>();
    let pollCount = 0;

    // Main polling loop
    while (true) {
        pollCount++;
        if (pollCount % 30 === 1) {
            console.log(`⏳ Polling... (waiting for messages)`);
        }

        try {
            const updates = await getUpdates(botToken, lastUpdateId);

            for (const update of updates) {
                lastUpdateId = update.update_id + 1;

                // Handle callback query (button clicks)
                if (update.callback_query) {
                    const cb = update.callback_query;
                    const cbChatId = cb.message?.chat?.id ? String(cb.message.chat.id) : null;
                    const cbThreadId = cb.message?.message_thread_id;

                    if (!cbChatId || !verifyMessage({
                        chatId: cbChatId,
                        threadId: cbThreadId,
                        userId: cb.from.id,
                        username: cb.from.username || cb.from.first_name,
                        allowedChatId,
                        allowedThreadId,
                        adminUserId,
                    })) {
                        continue;
                    }

                    await answerCallbackQuery(botToken, cb.id);

                    if (cb.data) {
                        const callbackText = getCallback(cb.data) || cb.data;
                        const chatKey = allowedThreadId ? `${cbChatId}:${allowedThreadId}` : cbChatId as string;
                        const userName = cb.from.first_name;

                        console.log(`\n${'='.repeat(60)}`);
                        console.log(`📥 BUTTON CLICK from ${userName}:`);
                        console.log(`   "${callbackText}"`);
                        console.log('='.repeat(60));

                        const thinkingMsgId = await sendMessage(
                            botToken,
                            cbChatId,
                            '🤔 _Claude is thinking..._',
                            allowedThreadId
                        );

                        const response = await processWithClaude(callbackText, chatKey);

                        if (thinkingMsgId) {
                            await deleteMessage(botToken, cbChatId, thinkingMsgId);
                        }

                        console.log(`\n${'─'.repeat(60)}`);
                        console.log(`📤 RESPONSE:`);
                        console.log(`   "${response.text.slice(0, 200)}${response.text.length > 200 ? '...' : ''}"`);
                        if (response.buttons?.length) {
                            console.log(`   Buttons: ${response.buttons.map(b => b.label).join(', ')}`);
                        }
                        console.log('─'.repeat(60));

                        await sendMessage(botToken, cbChatId, response.text, allowedThreadId, undefined, response.buttons);
                    }
                    continue;
                }

                const message = update.message;
                if (!message?.text) continue;

                const msgChatId = String(message.chat.id);
                if (!verifyMessage({
                    chatId: msgChatId,
                    threadId: message.message_thread_id,
                    userId: message.from.id,
                    username: message.from.username || message.from.first_name,
                    allowedChatId,
                    allowedThreadId,
                    adminUserId,
                })) {
                    continue;
                }

                if (processingMessages.has(message.message_id)) continue;
                processingMessages.add(message.message_id);

                const userText = message.text;
                const userName = message.from.first_name;

                console.log(`\n${'='.repeat(60)}`);
                console.log(`📥 INCOMING from ${userName} (@${message.from.username || 'no-username'}):`);
                console.log(`   "${userText}"`);
                console.log('='.repeat(60));

                const chatKey = allowedThreadId ? `${msgChatId}:${allowedThreadId}` : msgChatId;
                const session = getOrCreateSession(chatKey);

                // Handle special commands
                if (userText === '/start' || userText === '/help') {
                    await sendMessage(
                        botToken,
                        msgChatId,
                        `🤖 *Claude Code Bot*\n\nSend me any message and I'll process it with Claude Code SDK in the context of this project.\n\n*Commands:*\n/clear - Start fresh conversation\n/summary - Summarize & save context\n/list-commands - Show allowed commands\n/help - Show this message\n\n*Session:* ${session.sessionId ? `Active (${session.messageCount} messages)` : 'New'}`,
                        allowedThreadId,
                        message.message_id
                    );
                    processingMessages.delete(message.message_id);
                    continue;
                }

                if (userText === '/clear') {
                    clearSession(chatKey);
                    await sendMessage(
                        botToken,
                        msgChatId,
                        '🗑️ Conversation cleared. Starting fresh!',
                        allowedThreadId,
                        message.message_id
                    );
                    processingMessages.delete(message.message_id);
                    continue;
                }

                if (userText === '/list-commands' || userText === '/commands') {
                    const yarnScripts = ALLOWED_BASH_COMMANDS.map(cmd => `\`${cmd}\``).join('\n');
                    await sendMessage(
                        botToken,
                        msgChatId,
                        `📋 *Available Commands*\n\n*Bot Commands:*\n/clear - Start fresh conversation\n/summary - Summarize & save context\n/list-commands - Show this list\n/help - Show help\n\n*Allowed Yarn Scripts (${ALLOWED_BASH_COMMANDS.length}):*\n${yarnScripts}`,
                        allowedThreadId,
                        message.message_id
                    );
                    processingMessages.delete(message.message_id);
                    continue;
                }

                if (userText === '/summary') {
                    const thinkingMsgId = await sendMessage(
                        botToken,
                        msgChatId,
                        '📝 _Creating summary..._',
                        allowedThreadId,
                        message.message_id
                    );

                    const summaryResult = await summarizeConversation(chatKey);

                    if (thinkingMsgId) {
                        await deleteMessage(botToken, msgChatId, thinkingMsgId);
                    }

                    await sendMessage(botToken, msgChatId, summaryResult, allowedThreadId, message.message_id);
                    processingMessages.delete(message.message_id);
                    continue;
                }

                // Process with Claude
                const thinkingMsgId = await sendMessage(
                    botToken,
                    msgChatId,
                    '🤔 _Claude is thinking..._',
                    allowedThreadId,
                    message.message_id
                );

                const response = await processWithClaude(userText, chatKey);

                if (thinkingMsgId) {
                    await deleteMessage(botToken, msgChatId, thinkingMsgId);
                }

                console.log(`\n${'─'.repeat(60)}`);
                console.log(`📤 RESPONSE:`);
                console.log(`   "${response.text.slice(0, 200)}${response.text.length > 200 ? '...' : ''}"`);
                if (response.buttons?.length) {
                    console.log(`   Buttons: ${response.buttons.map(b => b.label).join(', ')}`);
                }
                console.log(`   (${response.text.length} chars total)`);
                console.log('─'.repeat(60));

                await sendMessage(botToken, msgChatId, response.text, allowedThreadId, message.message_id, response.buttons);

                processingMessages.delete(message.message_id);
            }

        } catch (error) {
            console.error('Polling error:', error);
        }

        await new Promise(resolve => setTimeout(resolve, BOT_CONFIG.pollingInterval));
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});

main().catch(console.error);
