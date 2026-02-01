#!/usr/bin/env tsx
/**
 * Telegram Webhook Setup Script
 *
 * Registers or removes the webhook URL for receiving Telegram button callbacks.
 *
 * Usage:
 *   yarn telegram-webhook set <url>     # Set webhook URL
 *   yarn telegram-webhook remove        # Remove webhook
 *   yarn telegram-webhook info          # Show current webhook info
 *
 * Example:
 *   yarn telegram-webhook set https://your-app.vercel.app/api/telegram-webhook
 *
 * Prerequisites:
 *   - TELEGRAM_BOT_TOKEN must be set in .env
 */

import '../../src/agents/shared/loadEnv';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

interface WebhookInfo {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
}

interface TelegramResponse<T> {
    ok: boolean;
    result: T;
    description?: string;
}

async function getWebhookInfo(botToken: string): Promise<WebhookInfo> {
    const response = await fetch(`${TELEGRAM_API_URL}${botToken}/getWebhookInfo`);
    const data = (await response.json()) as TelegramResponse<WebhookInfo>;

    if (!data.ok) {
        throw new Error(data.description || 'Failed to get webhook info');
    }

    return data.result;
}

async function setWebhook(botToken: string, url: string): Promise<boolean> {
    const response = await fetch(`${TELEGRAM_API_URL}${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url,
            allowed_updates: ['callback_query'], // Only listen for button clicks
        }),
    });

    const data = (await response.json()) as TelegramResponse<boolean>;

    if (!data.ok) {
        throw new Error(data.description || 'Failed to set webhook');
    }

    return data.result;
}

async function deleteWebhook(botToken: string): Promise<boolean> {
    const response = await fetch(`${TELEGRAM_API_URL}${botToken}/deleteWebhook`, {
        method: 'POST',
    });

    const data = (await response.json()) as TelegramResponse<boolean>;

    if (!data.ok) {
        throw new Error(data.description || 'Failed to delete webhook');
    }

    return data.result;
}

function printUsage() {
    console.log('Usage:');
    console.log('  yarn telegram-webhook set <url>   Set webhook URL');
    console.log('  yarn telegram-webhook remove      Remove webhook');
    console.log('  yarn telegram-webhook info        Show current webhook info');
    console.log('');
    console.log('Example:');
    console.log('  yarn telegram-webhook set https://your-app.vercel.app/api/telegram-webhook');
}

async function main() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
        console.error('Error: TELEGRAM_BOT_TOKEN not found in .env');
        process.exit(1);
    }

    const command = process.argv[2];

    if (!command) {
        printUsage();
        process.exit(1);
    }

    try {
        switch (command) {
            case 'set': {
                const url = process.argv[3];
                if (!url) {
                    console.error('Error: URL is required');
                    console.log('');
                    printUsage();
                    process.exit(1);
                }

                if (!url.startsWith('https://')) {
                    console.error('Error: Webhook URL must use HTTPS');
                    process.exit(1);
                }

                console.log(`Setting webhook URL: ${url}`);
                await setWebhook(botToken, url);
                console.log('Webhook set successfully!');
                console.log('');
                console.log('Your Telegram bot will now send button callbacks to this URL.');
                break;
            }

            case 'remove':
            case 'delete': {
                console.log('Removing webhook...');
                await deleteWebhook(botToken);
                console.log('Webhook removed successfully!');
                break;
            }

            case 'info':
            case 'status': {
                const info = await getWebhookInfo(botToken);
                console.log('Telegram Webhook Info');
                console.log('=====================');
                console.log(`URL: ${info.url || '(not set)'}`);
                console.log(`Pending updates: ${info.pending_update_count}`);
                if (info.last_error_date) {
                    const errorDate = new Date(info.last_error_date * 1000);
                    console.log(`Last error: ${errorDate.toISOString()}`);
                    console.log(`Error message: ${info.last_error_message}`);
                }
                break;
            }

            default:
                console.error(`Unknown command: ${command}`);
                console.log('');
                printUsage();
                process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
