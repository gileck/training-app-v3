#!/usr/bin/env npx ts-node
/**
 * Telegram Bot Setup Script
 *
 * Listens for messages to your Telegram bot and displays the chat ID.
 * Users can then copy this chat ID and add it to their Profile in the app.
 *
 * Usage:
 *   yarn telegram-setup
 *
 * Prerequisites:
 *   - TELEGRAM_BOT_TOKEN must be set in .env
 */

import 'dotenv/config';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

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
            title?: string;
            first_name?: string;
            username?: string;
        };
        text?: string;
    };
}

interface GetUpdatesResponse {
    ok: boolean;
    result: TelegramUpdate[];
}

async function getUpdates(botToken: string, offset?: number, timeout = 30): Promise<TelegramUpdate[]> {
    const url = new URL(`${TELEGRAM_API_URL}${botToken}/getUpdates`);
    url.searchParams.set('timeout', String(timeout));
    if (offset !== undefined) {
        url.searchParams.set('offset', String(offset));
    }

    const response = await fetch(url.toString());
    const data = await response.json() as GetUpdatesResponse;

    if (!data.ok) {
        throw new Error('Failed to get updates from Telegram');
    }

    return data.result;
}

async function getLatestUpdateId(botToken: string): Promise<number | undefined> {
    // Fetch existing updates without long polling to get latest update_id
    const updates = await getUpdates(botToken, undefined, 0);
    if (updates.length > 0) {
        // Return offset to skip all existing messages
        return updates[updates.length - 1].update_id + 1;
    }
    return undefined;
}

async function sendMessage(botToken: string, chatId: number, text: string): Promise<void> {
    await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
    });
}

async function main() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
        console.error('Error: TELEGRAM_BOT_TOKEN not found in .env');
        console.error('Please add TELEGRAM_BOT_TOKEN=your_token_here to your .env file');
        process.exit(1);
    }

    console.log('Telegram Bot Setup');
    console.log('==================');
    console.log('');
    console.log('Waiting for a message to your bot...');
    console.log('Send any message to your Telegram bot to get your chat ID.');
    console.log('');
    console.log('Press Ctrl+C to cancel.');
    console.log('');

    // Skip any existing messages - only listen for new ones
    let lastUpdateId = await getLatestUpdateId(botToken);

    while (true) {
        try {
            const updates = await getUpdates(botToken, lastUpdateId);

            for (const update of updates) {
                lastUpdateId = update.update_id + 1;

                if (update.message) {
                    const chatId = update.message.chat.id;
                    const chatName = update.message.chat.title ||
                                    update.message.chat.first_name ||
                                    update.message.chat.username ||
                                    'Unknown';
                    const senderName = update.message.from.first_name;

                    console.log(`Received message from "${senderName}" in chat "${chatName}"`);
                    console.log('');
                    console.log('='.repeat(40));
                    console.log(`Your Chat ID: ${chatId}`);
                    console.log('='.repeat(40));
                    console.log('');
                    console.log('Copy this Chat ID and add it to your Profile in the app.');

                    // Send confirmation
                    await sendMessage(
                        botToken,
                        chatId,
                        `Your Chat ID is: ${chatId}\n\nAdd this to your Profile in the app to receive notifications.`
                    );
                    console.log('');
                    console.log('Done!');

                    process.exit(0);
                }
            }
        } catch (error) {
            console.error('Error polling for updates:', error);
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

main();
