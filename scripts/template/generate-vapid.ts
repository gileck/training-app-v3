#!/usr/bin/env tsx
/**
 * VAPID Key Generator
 *
 * Generates a VAPID key pair for Web Push and prints the values to paste into
 * your `.env` file (or `vercel env add`).
 *
 * Usage:
 *   yarn generate-vapid
 *   yarn generate-vapid --subject mailto:you@example.com
 */

import webpush from 'web-push';

function parseArgs(argv: string[]): { subject?: string } {
    const out: { subject?: string } = {};
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--subject' || arg === '-s') {
            out.subject = argv[i + 1];
            i += 1;
        }
    }
    return out;
}

function main(): void {
    const { subject } = parseArgs(process.argv.slice(2));
    const keys = webpush.generateVAPIDKeys();
    const effectiveSubject = subject ?? 'mailto:admin@example.com';

    console.log('');
    console.log('Generated a new VAPID key pair.');
    console.log('Add these to .env (and your hosting provider env vars):');
    console.log('');
    console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
    console.log(`VAPID_SUBJECT=${effectiveSubject}`);
    console.log('');
    console.log('Notes:');
    console.log('  - NEXT_PUBLIC_VAPID_PUBLIC_KEY is safe to expose to clients.');
    console.log('  - VAPID_PRIVATE_KEY must stay secret. Never commit it.');
    console.log('  - VAPID_SUBJECT must be a mailto: or https:// URL.');
    console.log('');
}

main();
