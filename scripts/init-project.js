#!/usr/bin/env node
/*
 Minimal interactive initializer for this template:
 1) Prompt for project name (default: folder name)
 2) Update src/app.config.js: appName and dbName
 3) Create a local user in MongoDB: username "local_user_id", password "1234"
 4) Write LOCAL_USER_ID in .env
*/

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const readline = require('readline');
const crypto = require('crypto');

async function prompt(question, defaultValue) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const q = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
    const answer = await new Promise((resolve) => rl.question(q, (ans) => resolve(ans)));
    rl.close();
    return (answer && answer.trim()) || defaultValue || '';
}

function getDefaultProjectName() {
    return path.basename(process.cwd());
}

function toDbName(projectName) {
    const slug = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return `${slug}_db`;
}

function updateAppConfig(projectName, dbName) {
    const configPath = path.resolve(__dirname, '..', 'src', 'app.config.js');
    const content = fs.readFileSync(configPath, 'utf8');

    // Replace appName: '...' and dbName: '...'
    let updated = content.replace(/appName:\s*['\"][^'\"]*['\"]/g, `appName: '${projectName}'`);
    updated = updated.replace(/dbName:\s*['\"][^'\"]*['\"]/g, `dbName: '${dbName}'`);

    if (updated !== content) {
        fs.writeFileSync(configPath, updated, 'utf8');
        return true;
    }
    return false;
}

async function createLocalUserAndWriteEnv() {
    // Dynamically import ESM TypeScript via ts-node/register is overkill; use direct JS requires from compiled runtime.
    // The server DB utilities are TypeScript with path alias. We'll reimplement a minimal insert using mongodb driver here to avoid TS runtime.
    const mongodb = require('mongodb');

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('MONGO_URI is not set. Please set it before running the initializer.');
    }

    const bcrypt = require('bcryptjs');

    // SALT_ROUNDS from src/apis/auth/server.ts is 10; duplicate here to avoid TS import complexity
    const SALT_ROUNDS = 10;

    const client = new mongodb.MongoClient(mongoUri);
    try {
        await client.connect();

        // Read dbName from app.config.js without executing arbitrary code: parse by regexp
        const configPath = path.resolve(__dirname, '..', 'src', 'app.config.js');
        const cfg = fs.readFileSync(configPath, 'utf8');
        const dbMatch = cfg.match(/dbName:\s*['\"]([^'\"]+)['\"]/);
        if (!dbMatch) throw new Error('Failed to read dbName from app.config.js');
        const dbName = dbMatch[1];

        const db = client.db(dbName);
        const users = db.collection('users');

        const passwordHash = await bcrypt.hash('1234', SALT_ROUNDS);
        const now = new Date();

        // Ensure username unique; if exists, reuse its _id.
        const existing = await users.findOne({ username: 'local_user_id' });
        let userId;
        if (existing) {
            userId = existing._id;
        } else {
            const result = await users.insertOne({
                username: 'local_user_id',
                password_hash: passwordHash,
                createdAt: now,
                updatedAt: now,
            });
            if (!result.insertedId) throw new Error('Failed to insert local user');
            userId = result.insertedId;
        }

        await writeEnvLocalUserId(userId.toString());
        return userId.toString();
    } finally {
        await client.close().catch(() => { });
    }
}

async function writeEnvLocalUserId(id) {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        if (/^LOCAL_USER_ID=.*/m.test(envContent)) {
            envContent = envContent.replace(/^LOCAL_USER_ID=.*/m, `LOCAL_USER_ID=${id}`);
        } else {
            envContent += (envContent.endsWith('\n') ? '' : '\n') + `LOCAL_USER_ID=${id}\n`;
        }
    } else {
        envContent = `LOCAL_USER_ID=${id}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
}

function ensureEnvFromParentOrEmpty() {
    const cwdEnvPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(cwdEnvPath)) return;
    const parentEnvPath = path.resolve(process.cwd(), '..', '.env');
    if (fs.existsSync(parentEnvPath)) {
        fs.copyFileSync(parentEnvPath, cwdEnvPath);
        console.log('Copied .env from parent directory.');
    } else {
        fs.writeFileSync(cwdEnvPath, '', 'utf8');
        console.log('Created empty .env file.');
    }
}

async function main() {
    ensureEnvFromParentOrEmpty();

    const defaultName = getDefaultProjectName();
    const projectName = await prompt('Project Name', defaultName);
    const dbName = toDbName(projectName);

    const changed = updateAppConfig(projectName, dbName);
    console.log(changed ? 'Updated src/app.config.js' : 'src/app.config.js already up to date');


    const userId = await createLocalUserAndWriteEnv();
    console.log(`LOCAL_USER_ID set to ${userId} in .env`);

    console.log('Initialization complete.');
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});


