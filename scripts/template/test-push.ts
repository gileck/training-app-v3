#!/usr/bin/env tsx
/**
 * Send a test web push to a user directly (no HTTP layer).
 *
 * Usage:
 *   yarn test-push                          # uses ADMIN_USER_ID
 *   yarn test-push <userId>                 # explicit user
 *   yarn test-push <userId> "Title" "Body"  # custom payload
 *   yarn test-push <userId> "Title" "Body" /some/path   # custom url
 *
 * Loads MONGO_URI + VAPID keys from .env / .env.local, so whichever DB your
 * local env points at is the one that'll be targeted. To push to production
 * devices, point MONGO_URI at the production database.
 */

import '../../src/agents/shared/loadEnv';

import { sendPushToUser, isPushConfigured } from '../../src/server/template/push';
import { closeDbConnection } from '../../src/server/database';

async function main(): Promise<void> {
    const [, , userIdArg, titleArg, bodyArg, urlArg] = process.argv;

    const userId = userIdArg || process.env.ADMIN_USER_ID || process.env.LOCAL_USER_ID;
    if (!userId) {
        console.error(
            'No userId. Pass as arg or set ADMIN_USER_ID / LOCAL_USER_ID in env.'
        );
        process.exit(1);
    }

    if (!isPushConfigured()) {
        console.error(
            'Push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in .env.local.'
        );
        process.exit(1);
    }

    const payload = {
        title: titleArg ?? 'Test from script',
        body:
            bodyArg ??
            `Sent at ${new Date().toLocaleTimeString()}. If you see this on a locked iPhone, push is working.`,
        url: urlArg ?? '/',
        tag: 'script-test',
    };

    console.log(`\nSending push to user ${userId}...`);
    console.log(`  title: ${payload.title}`);
    console.log(`  body:  ${payload.body}`);
    console.log(`  url:   ${payload.url}`);

    const results = await sendPushToUser(userId, payload);

    if (results.length === 0) {
        console.log('\nNo subscriptions found for this user. Enable push in Settings first.');
    } else {
        console.log(`\nResults (${results.length} device${results.length > 1 ? 's' : ''}):`);
        for (const r of results) {
            const status = r.success ? '✓ sent' : r.removed ? '✗ pruned (stale)' : '✗ failed';
            const suffix = r.success ? '' : ` — ${r.statusCode ?? '?'} ${r.error ?? ''}`;
            console.log(`  ${status}  ${r.endpoint.slice(0, 60)}...${suffix}`);
        }
        const sent = results.filter((r) => r.success).length;
        console.log(`\n${sent}/${results.length} delivered.`);
    }

    await closeDbConnection();
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
