#!/usr/bin/env tsx
/**
 * Create (or find) an APPROVED user, using the project's real user code.
 *
 * Why this exists: the user document's shape, password hashing, and the
 * admin-approval flow all live in the app. Hand-rolling a raw
 * `users.insertOne({...})` (as the old inline init-project step did)
 * drifts the moment the schema changes — e.g. a child project that adds
 * required user fields, or the approval gate. This script reuses the
 * canonical `users.insertUser` + `SALT_ROUNDS` + `setUserApprovalStatus`
 * so the created user always matches what the app expects, and is
 * created **approved** so it can log in even with admin-approval enabled.
 *
 * Idempotent: if the username already exists, it's reused (and ensured
 * approved). Connects to whatever DB `MONGO_URI` + `appConfig.dbName`
 * point at — so run it with your local env for a dev user, or against
 * production env to bootstrap the owner account.
 *
 * Usage:
 *   yarn create-local-user
 *       → username "local_user_id", password "1234", marks the user
 *         approved, and writes LOCAL_USER_ID to .env (the dev-mode auth
 *         shortcut + local admin).
 *
 *   yarn create-user --username <name> --password <pw> [--email <e>] [--admin]
 *       → create/find an approved user. With --admin, prints the
 *         ADMIN_USER_ID to set so this user is the app admin.
 *
 * SECURITY: never paste someone else's real password into shell history
 * lightly — for the owner account, the developer should run this
 * themselves. `--local` uses the well-known dev password "1234".
 */

// MUST be first: connection.ts reads MONGO_URI at module-load time, so
// env has to be loaded before `@/server/database` is imported.
import '../../src/agents/shared/loadEnv';

import * as path from 'path';
import * as fs from 'fs';
import bcrypt from 'bcryptjs';
import { users } from '@/server/database';
import { closeDbConnection } from '@/server/database/connection';
import { SALT_ROUNDS } from '@/apis/template/auth/shared';

const LOCAL_USERNAME = 'local_user_id';
const LOCAL_PASSWORD = '1234';

interface Args {
    local: boolean;
    admin: boolean;
    username?: string;
    password?: string;
    email?: string;
}

function parseArgs(argv: string[]): Args {
    const out: Args = { local: false, admin: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const take = (): string | undefined => {
            const eq = arg.indexOf('=');
            if (eq !== -1) return arg.slice(eq + 1);
            return argv[++i];
        };
        if (arg === '--local') out.local = true;
        else if (arg === '--admin') out.admin = true;
        else if (arg.startsWith('--username')) out.username = take();
        else if (arg.startsWith('--password')) out.password = take();
        else if (arg.startsWith('--email')) out.email = take();
    }
    return out;
}

function usage(): never {
    console.error(
        [
            'Usage:',
            '  yarn create-local-user',
            '  yarn create-user --username <name> --password <pw> [--email <e>] [--admin]',
        ].join('\n')
    );
    process.exit(1);
}

/** Upsert LOCAL_USER_ID in .env (matches init-project's behaviour). */
function writeLocalUserId(id: string): void {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (/^LOCAL_USER_ID=.*/m.test(content)) {
        content = content.replace(/^LOCAL_USER_ID=.*/m, `LOCAL_USER_ID=${id}`);
    } else {
        content += (content && !content.endsWith('\n') ? '\n' : '') + `LOCAL_USER_ID=${id}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    console.log(`Wrote LOCAL_USER_ID=${id} to .env`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const username = args.local ? LOCAL_USERNAME : args.username;
    const password = args.local ? LOCAL_PASSWORD : args.password;
    if (!username || !password) usage();

    if (!process.env.MONGO_URI) {
        console.error(
            'MONGO_URI is not set. Add it to .env / .env.local (the project\'s own database), then re-run.'
        );
        process.exit(1);
    }

    // Idempotent: reuse an existing user with this username.
    let user = await users.findUserByUsername(username);
    const created = !user;
    if (!user) {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const now = new Date();
        user = await users.insertUser({
            username,
            password_hash: passwordHash,
            createdAt: now,
            updatedAt: now,
            ...(args.email ? { email: args.email } : {}),
        });
    }

    // Ensure approved so it can log in even with admin-approval enabled.
    if (user.approvalStatus !== 'approved') {
        user = (await users.setUserApprovalStatus(user._id, 'approved')) ?? user;
    }

    const id = user._id.toString();
    console.log(
        `${created ? 'Created' : 'Found'} user "${username}" — _id=${id} (approvalStatus=approved)`
    );

    if (args.local) writeLocalUserId(id);

    if (args.admin || args.local) {
        console.log(
            `\nTo make this user the app admin, set ADMIN_USER_ID=${id}` +
                (args.local
                    ? ' (locally the LOCAL_USER_ID shortcut already grants admin).'
                    : ' in .env.local and on Vercel (yarn vercel-cli env:push).')
        );
    }

    await closeDbConnection();
}

main().catch((err) => {
    console.error('create-user failed:', err instanceof Error ? err.message : err);
    process.exit(1);
});
