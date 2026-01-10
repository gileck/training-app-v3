#!/usr/bin/env node
/*
 Minimal interactive initializer for this template:
 1) Copy .env from ../app-template-ai/ (or parent directory) if not exists
 2) Prompt for project name (default: folder name)
 3) Update src/app.config.js: appName and dbName
 4) Create src/config/pwa.config.ts with PWA metadata
 5) Create a local user in MongoDB: username "local_user_id", password "1234"
 6) Write LOCAL_USER_ID in .env
 7) Initialize template tracking (run init-template.ts)
 8) Delete template example features (Todos, Chat, AIChat, Home)
*/

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// NOTE: dotenv is loaded AFTER ensureEnvFromParentOrEmpty() in main() to ensure .env exists first

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

// Default template values - used to detect if config has been customized
const TEMPLATE_DEFAULTS = {
    appName: 'App Template',
    dbName: 'app_template_db',
};

function getAppConfigValues() {
    const configPath = path.resolve(__dirname, '..', 'src', 'app.config.js');
    const content = fs.readFileSync(configPath, 'utf8');
    const appNameMatch = content.match(/appName:\s*['\"]([^'\"]*)['\"]/)
    const dbNameMatch = content.match(/dbName:\s*['\"]([^'\"]*)['\"]/)
    return {
        appName: appNameMatch ? appNameMatch[1] : null,
        dbName: dbNameMatch ? dbNameMatch[1] : null,
    };
}

function isAppConfigCustomized() {
    const values = getAppConfigValues();
    return values.appName && values.appName !== TEMPLATE_DEFAULTS.appName;
}

function updateAppConfig(projectName, dbName) {
    const configPath = path.resolve(__dirname, '..', 'src', 'app.config.js');
    const content = fs.readFileSync(configPath, 'utf8');

    // Replace appName: '...' and dbName: '...'
    let updated = content.replace(/appName:\s*['\"][^'\"]*['\"]/g, `appName: '${projectName}'`);
    updated = updated.replace(/dbName:\s*['\"][^'\"]*['\"]/g, `dbName: '${dbName}'`);

    if (updated !== content) {
        fs.writeFileSync(configPath, updated, 'utf8');
        console.log('[app.config.js] Updated.');
        return true;
    }
    console.log('[app.config.js] Already up to date.');
    return false;
}

async function createLocalUserAndWriteEnv() {
    // Check if LOCAL_USER_ID already set in .env
    if (process.env.LOCAL_USER_ID) {
        console.log('[Local User] Already configured (LOCAL_USER_ID exists in .env), skipping.');
        return process.env.LOCAL_USER_ID;
    }

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
        let isNew = false;
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
            isNew = true;
        }

        await writeEnvLocalUserId(userId.toString());
        console.log(`[Local User] ${isNew ? 'Created new user' : 'Found existing user'}, LOCAL_USER_ID=${userId}`);
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
    if (fs.existsSync(cwdEnvPath)) {
        console.log('[.env] Already exists, skipping.');
        return;
    }

    // Try to copy from ../app-template-ai/.env (the template directory)
    const templateEnvPath = path.resolve(process.cwd(), '..', 'app-template-ai', '.env');
    if (fs.existsSync(templateEnvPath)) {
        fs.copyFileSync(templateEnvPath, cwdEnvPath);
        console.log('[.env] Copied from ../app-template-ai/');
        return;
    }

    // Fallback: try parent directory
    const parentEnvPath = path.resolve(process.cwd(), '..', '.env');
    if (fs.existsSync(parentEnvPath)) {
        fs.copyFileSync(parentEnvPath, cwdEnvPath);
        console.log('[.env] Copied from parent directory.');
    } else {
        fs.writeFileSync(cwdEnvPath, '', 'utf8');
        console.log('[.env] Created empty file.');
    }
}

function createPwaConfig(projectName, description, themeColor) {
    const configDir = path.resolve(__dirname, '..', 'src', 'config');
    const configPath = path.join(configDir, 'pwa.config.ts');

    // Check if already exists
    if (fs.existsSync(configPath)) {
        console.log('[pwa.config.ts] Already exists, skipping.');
        return false;
    }

    // Ensure config directory exists
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    const content = `/**
 * PWA Configuration - Project-specific values
 *
 * This file contains project-specific PWA metadata.
 * Edit these values for your project.
 * The _document.tsx file imports from here and should not need modification.
 */

export const pwaConfig = {
  // App identity
  applicationName: "${projectName}",
  appleWebAppTitle: "${projectName}",
  description: "${description}",

  // Theme
  themeColor: "${themeColor}",

  // Icons - paths relative to /public
  icons: {
    appleTouchIcon: "/icons/apple-touch-icon.png",
    appleTouchIcon152: "/icons/icon-152x152.png",
    appleTouchIcon167: "/icons/icon-167x167.png",
    appleTouchIcon180: "/icons/icon-180x180.png",
    favicon32: "/favicon-32x32.png",
    splashScreen: "/icons/icon-512x512.png",
  },
};
`;

    fs.writeFileSync(configPath, content, 'utf8');
    console.log('[pwa.config.ts] Created.');
    return true;
}

function createManifest(projectName, description, themeColor) {
    const manifestPath = path.resolve(__dirname, '..', 'public', 'manifest.json');

    // Check if manifest exists and has been customized (name != template default)
    if (fs.existsSync(manifestPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            // If name is not the template default, consider it already customized
            if (existing.name && existing.name !== 'App Template') {
                console.log('[manifest.json] Already customized, skipping.');
                return false;
            }
        } catch {
            // If we can't parse it, we'll overwrite it
        }
    }

    const manifest = {
        name: projectName,
        short_name: projectName,
        description: description,
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: themeColor,
        orientation: "portrait",
        icons: [
            { src: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-167x167.png", sizes: "167x167", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png", purpose: "any maskable" },
            { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ],
        splash_pages: null
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log('[manifest.json] Created.');
    return true;
}

function getGitRemoteUrl() {
    try {
        return execSync('git remote get-url origin', { encoding: 'utf8', stdio: 'pipe' }).trim();
    } catch {
        return null;
    }
}

function runInitTemplate() {
    // Check if .template-sync.json already exists
    const configPath = path.resolve(process.cwd(), '.template-sync.json');
    if (fs.existsSync(configPath)) {
        console.log('[Template Tracking] Already initialized, skipping.');
        return true;
    }

    // Get template repo URL from git remote origin
    const remoteUrl = getGitRemoteUrl();
    if (!remoteUrl) {
        console.log('[Template Tracking] No git remote origin found, skipping.');
        return false;
    }

    console.log('[Template Tracking] Initializing...');
    try {
        const initTemplateScript = path.resolve(__dirname, 'template-scripts', 'init-template.ts');
        execSync(`npx tsx "${initTemplateScript}" "${remoteUrl}"`, {
            encoding: 'utf8',
            stdio: 'inherit',
            cwd: process.cwd(),
        });
        return true;
    } catch (err) {
        console.log('[Template Tracking] Warning: Failed to initialize:', err.message || err);
        return false;
    }
}

// Template example features to delete after cloning
const TEMPLATE_EXAMPLE_FEATURES = [
    // Todos example feature
    'src/apis/todos',
    'src/client/routes/Todos',
    'src/client/routes/SingleTodo',
    'src/client/features/todos',
    'src/server/database/collections/todos',
    // Chat example feature
    'src/apis/chat',
    'src/client/routes/Chat',
    'src/client/routes/AIChat',
    'src/client/features/chat',
    // Home page example
    'src/client/routes/Home',
];

function deleteTemplateExampleFeatures() {
    let deletedCount = 0;
    const toDelete = [];

    for (const relativePath of TEMPLATE_EXAMPLE_FEATURES) {
        const fullPath = path.resolve(process.cwd(), relativePath);
        if (fs.existsSync(fullPath)) {
            toDelete.push({ relativePath, fullPath });
        }
    }

    if (toDelete.length === 0) {
        console.log('[Example Features] Already removed, skipping.');
        return;
    }

    console.log('[Example Features] Removing template examples...');
    for (const { relativePath, fullPath } of toDelete) {
        try {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`  Deleted: ${relativePath}`);
            deletedCount++;
        } catch (err) {
            console.log(`  Warning: Failed to delete ${relativePath}: ${err.message || err}`);
        }
    }
    console.log(`[Example Features] Removed ${deletedCount} item(s).`);
}

async function main() {
    console.log('=== Project Initialization ===\n');

    // Step 1: Ensure .env exists (copy from parent if needed)
    ensureEnvFromParentOrEmpty();

    // Now load dotenv so MONGO_URI is available for DB operations
    require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

    // Step 2-4: Project config, PWA config, manifest
    // Skip interactive prompts if already customized
    if (isAppConfigCustomized()) {
        const values = getAppConfigValues();
        console.log(`[app.config.js] Already customized (appName: "${values.appName}"), skipping prompts.`);
        // Still try to create PWA config and manifest if missing (use existing values)
        createPwaConfig(values.appName, 'A custom SPA application with PWA capabilities', '#000000');
        createManifest(values.appName, 'A custom SPA application with PWA capabilities', '#000000');
    } else {
        const defaultName = getDefaultProjectName();
        const projectName = await prompt('Project Name', defaultName);
        const dbName = toDbName(projectName);

        updateAppConfig(projectName, dbName);

        // PWA configuration
        const pwaDescription = await prompt('App Description', 'A custom SPA application with PWA capabilities');
        const pwaThemeColor = await prompt('Theme Color (hex)', '#000000');

        createPwaConfig(projectName, pwaDescription, pwaThemeColor);
        createManifest(projectName, pwaDescription, pwaThemeColor);
    }

    // Step 5-6: Create local user and write LOCAL_USER_ID to .env
    await createLocalUserAndWriteEnv();

    // Step 7: Initialize template tracking
    runInitTemplate();

    // Step 8: Delete template example features (Todos, Chat, AIChat, Home)
    deleteTemplateExampleFeatures();

    console.log('\n=== Initialization complete ===');
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});


