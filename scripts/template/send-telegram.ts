#!/usr/bin/env npx ts-node
/**
 * Send Telegram Message Script
 *
 * Sends a message to the LOCAL_TELEGRAM_CHAT_ID.
 *
 * Usage:
 *   yarn send-telegram "Your message here"
 */

import '../src/agents/shared/loadEnv';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

/**
 * Parse a chat ID string that may include a topic thread ID.
 * Format: "chatId" or "chatId:threadId"
 */
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

async function main() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatIdString = process.env.LOCAL_TELEGRAM_CHAT_ID;
    const message = process.argv.slice(2).join(' ');

    if (!botToken) {
        console.error('Error: TELEGRAM_BOT_TOKEN not found in .env');
        process.exit(1);
    }

    if (!chatIdString) {
        console.error('Error: LOCAL_TELEGRAM_CHAT_ID not found in .env');
        process.exit(1);
    }

    if (!message) {
        console.error('Usage: yarn send-telegram "Your message here"');
        process.exit(1);
    }

    const { chatId, threadId } = parseChatId(chatIdString);

    try {
        const body: Record<string, unknown> = {
            chat_id: chatId,
            text: message
        };

        if (threadId) {
            body.message_thread_id = threadId;
        }

        const response = await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Failed to send message:', error);
            process.exit(1);
        }

        console.log('Message sent successfully');
    } catch (error) {
        console.error('Error sending message:', error);
        process.exit(1);
    }
}

main();
