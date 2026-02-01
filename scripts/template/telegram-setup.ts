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

import '../../src/agents/shared/loadEnv';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

interface TelegramUpdate {
    update_id: number;
    message?: {
        message_id: number;
        message_thread_id?: number;  // Topic thread ID (for supergroups with topics)
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
            is_forum?: boolean;  // True if supergroup has topics enabled
        };
        text?: string;
        is_topic_message?: boolean;  // True if sent in a topic
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
    const data = await response.json() as GetUpdatesResponse & { description?: string; error_code?: number };

    if (!data.ok) {
        // Common issue: webhook is set, which prevents getUpdates from working
        if (data.description?.includes('webhook')) {
            console.error('');
            console.error('⚠️  A webhook is currently set on this bot.');
            console.error('   getUpdates cannot be used while a webhook is active.');
            console.error('');
            console.error('To temporarily disable the webhook, run:');
            console.error('   yarn telegram-webhook delete');
            console.error('');
            console.error('After getting your chat IDs, re-set the webhook:');
            console.error('   yarn telegram-webhook set <your-app-url>');
            console.error('');
        }
        throw new Error(`Failed to get updates from Telegram: ${data.description || 'Unknown error'}`);
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

async function sendMessage(botToken: string, chatId: number, text: string, threadId?: number): Promise<void> {
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (threadId) {
        body.message_thread_id = threadId;
    }
    await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
    console.log('This script helps you configure Telegram notifications.');
    console.log('');
    console.log('You can configure notifications in two ways:');
    console.log('  1. Simple mode: Use ONE chat for all notifications');
    console.log('  2. Advanced mode: Use 3 SEPARATE chats for different notification types');
    console.log('');
    console.log('Advanced mode (3 chats) helps reduce information overload by splitting:');
    console.log('  • Chat 1: Vercel deployments (FYI - catch errors)');
    console.log('  • Chat 2: GitHub activity (FYI - awareness)');
    console.log('  • Chat 3: Agent workflow (action required - important!)');
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
                    const threadId = update.message.message_thread_id;
                    const isTopicMessage = update.message.is_topic_message || threadId !== undefined;
                    const isForum = update.message.chat.is_forum;
                    const chatName = update.message.chat.title ||
                                    update.message.chat.first_name ||
                                    update.message.chat.username ||
                                    'Unknown';
                    const senderName = update.message.from.first_name;

                    // Combined format for topics: chatId:threadId
                    const combinedId = threadId ? `${chatId}:${threadId}` : String(chatId);

                    // Track collected topics
                    const topicName = update.message.text?.slice(0, 30) || `Topic ${threadId || 'General'}`;

                    console.log('');
                    console.log('='.repeat(60));
                    console.log(`📩 Message from "${senderName}" in "${chatName}"`);
                    if (isTopicMessage && threadId) {
                        console.log(`📌 Topic Thread ID: ${threadId}`);
                    }
                    console.log('');
                    console.log(`   ➜ Combined ID: ${combinedId}`);
                    console.log('='.repeat(60));

                    // Send confirmation with topic info if applicable
                    const confirmationMsg = threadId
                        ? `✅ Combined ID: ${combinedId}`
                        : `✅ Chat ID: ${chatId}`;

                    await sendMessage(
                        botToken,
                        chatId,
                        confirmationMsg,
                        threadId
                    );

                    // For forums with topics, keep listening
                    if (isForum) {
                        console.log('');
                        console.log('💡 Topics detected - keep sending messages from other topics.');
                        console.log('   Press Ctrl+C when done collecting all topic IDs.');
                        console.log('');
                        console.log('   Example .env configuration:');
                        console.log(`   VERCEL_TELEGRAM_CHAT_ID=${combinedId}`);
                        console.log(`   GITHUB_TELEGRAM_CHAT_ID=${chatId}:<other-thread-id>`);
                        console.log(`   AGENT_TELEGRAM_CHAT_ID=${chatId}:<other-thread-id>`);
                        console.log('');
                        console.log('Waiting for more messages...');
                    } else {
                        // Not a forum, show full instructions and exit
                        console.log('');
                        console.log('SETUP INSTRUCTIONS');
                        console.log('==================');
                        console.log('');
                        console.log('Add to your .env file:');
                        console.log('');
                        console.log(`  LOCAL_TELEGRAM_CHAT_ID=${combinedId}`);
                        console.log('');
                        console.log('GitHub Actions secrets:');
                        console.log(`  TELEGRAM_BOT_TOKEN=<your-token>`);
                        console.log(`  LOCAL_TELEGRAM_CHAT_ID=${combinedId}`);
                        console.log('');
                        console.log('Done!');
                        process.exit(0);
                    }
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
