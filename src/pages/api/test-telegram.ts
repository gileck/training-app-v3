/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Test Telegram Notification Endpoint
 *
 * Simple endpoint to test if Telegram notifications work in production.
 *
 * Usage:
 *   GET /api/test-telegram
 *
 * Returns:
 *   - success: true if notification was sent
 *   - error: error message if failed
 *   - config: configuration details (for debugging)
 *
 * This is a direct API route for testing purposes only.
 * It doesn't use the centralized API architecture to keep it simple for debugging.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { sendNotificationToOwner } from '@/server/telegram';
import { appConfig } from '@/app.config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const testMessage = `🧪 Test Telegram Notification

This is a test message from your app to verify Telegram integration is working.

Environment: ${process.env.NODE_ENV || 'unknown'}
Timestamp: ${new Date().toISOString()}`;

        const result = await sendNotificationToOwner(testMessage, {
            inlineKeyboard: [[
                { text: '✅ Test Button', callback_data: 'test_button_clicked' }
            ]]
        });

        const config = {
            botTokenSet: !!process.env.TELEGRAM_BOT_TOKEN,
            ownerChatId: appConfig.ownerTelegramChatId,
            nodeEnv: process.env.NODE_ENV,
            vercelEnv: process.env.VERCEL_ENV,
            vercelUrl: process.env.VERCEL_URL
        };

        return res.status(200).json({
            success: result.success,
            error: result.error,
            config,
            message: result.success
                ? 'Test notification sent! Check your Telegram.'
                : 'Failed to send notification. Check error details.'
        });
    } catch (error) {
        console.error('Test telegram error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}
