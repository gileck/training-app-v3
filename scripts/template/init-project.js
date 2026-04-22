#!/usr/bin/env node
/*
 Minimal interactive initializer for this template:
  1) Copy .env (and .env.local) from ../app-template-ai/ if not present
  2) Prompt for project name (default: folder name)
  3) Update src/app.config.js: appName and dbName
  4) Create src/config/pwa.config.ts with PWA metadata
  5) Create a local user in MongoDB: username "local_user_id", password "1234"
  6) Write LOCAL_USER_ID in .env
  7) Initialize template tracking (run init-template.ts)
  8) Delete template example features (Todos, Chat, AIChat, Home)
  9) Install git hooks + mark yarn.lock skip-worktree (yarn setup-hooks)
 10) Prompt for `vercel link`, then optionally push .env/.env.local to
     Vercel (filtered: LOCAL_* keys excluded, user confirms the key list)
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
    const configPath = path.resolve(__dirname, '..', '..', 'src', 'app.config.js');
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
    const configPath = path.resolve(__dirname, '..', '..', 'src', 'app.config.js');
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
        throw new Error(
            'MONGO_URI is not set. Add it to .env or .env.local in the project root, then re-run `yarn init-project`.'
        );
    }

    const bcrypt = require('bcryptjs');

    // SALT_ROUNDS from src/apis/auth/server.ts is 10; duplicate here to avoid TS import complexity
    const SALT_ROUNDS = 10;

    const client = new mongodb.MongoClient(mongoUri);
    try {
        await client.connect();

        // Read dbName from app.config.js without executing arbitrary code: parse by regexp
        const configPath = path.resolve(__dirname, '..', '..', 'src', 'app.config.js');
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

function copyEnvFileIfMissing(fileName) {
    const cwdPath = path.resolve(process.cwd(), fileName);
    if (fs.existsSync(cwdPath)) {
        console.log(`[${fileName}] Already exists, skipping.`);
        return;
    }

    // Try to copy from ../app-template-ai/<fileName> (the template directory)
    const templatePath = path.resolve(process.cwd(), '..', 'app-template-ai', fileName);
    if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, cwdPath);
        console.log(`[${fileName}] Copied from ../app-template-ai/`);
        return;
    }

    // Fallback: try parent directory
    const parentPath = path.resolve(process.cwd(), '..', fileName);
    if (fs.existsSync(parentPath)) {
        fs.copyFileSync(parentPath, cwdPath);
        console.log(`[${fileName}] Copied from parent directory.`);
        return;
    }

    // Only create an empty .env when no source is found. Never fabricate a .env.local.
    if (fileName === '.env') {
        fs.writeFileSync(cwdPath, '', 'utf8');
        console.log(`[${fileName}] Created empty file.`);
    } else {
        console.log(`[${fileName}] No source found, skipping.`);
    }
}

function ensureEnvFromParentOrEmpty() {
    copyEnvFileIfMissing('.env');
    copyEnvFileIfMissing('.env.local');
}

function createPwaConfig(projectName, description, themeColor) {
    const configDir = path.resolve(__dirname, '..', '..', 'src', 'config');
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
    const manifestPath = path.resolve(__dirname, '..', '..', 'public', 'manifest.json');

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

// Canonical template repo URL (kept in sync with scripts/template/init-template.ts).
// Used only as a self-recognition signal when init-project is accidentally run
// inside the template repo itself.
const TEMPLATE_REPO_URL = 'git@github.com:gileck/app-template-ai.git';

function isTemplateRepoItself() {
    try {
        const origin = execSync('git remote get-url origin', {
            encoding: 'utf8',
            stdio: 'pipe',
        }).trim();
        return origin === TEMPLATE_REPO_URL;
    } catch {
        return false;
    }
}

function runInitTemplate() {
    // Check if .template-sync.json already exists and is populated.
    // An empty `templateRepo` means the config was bootstrapped but never initialized
    // (e.g. copied from the template repo itself, which keeps it empty).
    const configPath = path.resolve(process.cwd(), '.template-sync.json');
    if (fs.existsSync(configPath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (existing.templateRepo) {
                console.log('[Template Tracking] Already initialized, skipping.');
                return true;
            }
            // Safety: if we ARE the template repo (git origin matches the canonical
            // template URL), keep templateRepo empty — sync-template relies on that
            // signal to refuse running against itself.
            if (isTemplateRepoItself()) {
                console.log('[Template Tracking] Detected template repo itself, leaving empty templateRepo alone.');
                return true;
            }
            console.log('[Template Tracking] Existing config has empty templateRepo, reinitializing...');
            fs.rmSync(configPath, { force: true });
        } catch {
            console.log('[Template Tracking] Existing config unreadable, reinitializing...');
            fs.rmSync(configPath, { force: true });
        }
    }

    // Invoke init-template without a URL — it defaults to the canonical template
    // (git@github.com:gileck/app-template-ai.git) and sets templateLocalPath to
    // ../app-template-ai, matching every other child project.
    console.log('[Template Tracking] Initializing...');
    try {
        const initTemplateScript = path.resolve(__dirname, 'init-template.ts');
        execSync(`npx tsx "${initTemplateScript}"`, {
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

function runSetupHooks() {
    // Idempotent: installs pre-commit hook (auto-resets yarn.lock to HEAD) and
    // marks yarn.lock as skip-worktree so local installs against a private
    // registry (e.g. npm.dev.wixpress.com) never contaminate commits — which
    // would otherwise break Vercel builds that can only reach public npm.
    const hooksScript = path.resolve(__dirname, 'hooks', 'setup-hooks.sh');
    if (!fs.existsSync(hooksScript)) {
        console.log('[setup-hooks] Script not found, skipping.');
        return;
    }
    console.log('[setup-hooks] Installing git hooks and yarn.lock protection...');
    try {
        execSync(`bash "${hooksScript}"`, {
            encoding: 'utf8',
            stdio: 'inherit',
            cwd: process.cwd(),
        });
    } catch (err) {
        console.log('[setup-hooks] Warning: Failed:', err.message || err);
    }
}

async function main() {
    console.log('=== Project Initialization ===\n');

    // Step 1: Ensure .env exists (copy from parent if needed)
    ensureEnvFromParentOrEmpty();

    // Now load dotenv so MONGO_URI is available for DB operations.
    // Follow Next.js precedence: .env.local overrides .env. Load .env.local first so
    // its values take priority (dotenv does not overwrite existing env vars by default).
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envLocalPath)) {
        require('dotenv').config({ path: envLocalPath });
    }
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

    // Step 9: Install git hooks + protect yarn.lock from wixpress URL contamination
    runSetupHooks();

    console.log('\n=== Initialization complete ===');

    // Step 10: Prompt for Vercel linking, then optionally push env vars.
    const linked = await promptVercelLink();
    if (linked) {
        await promptVercelEnvPush();
    }
}

async function promptVercelLink() {
    const vercelConfigPath = path.resolve(process.cwd(), '.vercel', 'project.json');

    // Check if already linked
    if (fs.existsSync(vercelConfigPath)) {
        console.log('\n✅ Vercel project already linked');
        try {
            const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
            console.log(`   Project: ${config.projectName || config.projectId}`);
        } catch {
            // Ignore parse errors
        }
        return true;
    }

    console.log('\n⚠️  IMPORTANT: Link to Vercel Project');
    console.log('═'.repeat(50));
    console.log('');
    console.log('Why this is critical:');
    console.log('  • Prevents accidentally pushing env vars to wrong project');
    console.log('  • Ensures vercel-cli commands target correct project');
    console.log('  • Required for production deployment');
    console.log('');
    console.log('Without this, you might accidentally overwrite');
    console.log('another project\'s environment variables!');
    console.log('');

    const answer = await prompt('Link to Vercel now? (recommended)', 'y');

    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer === '') {
        console.log('\nRunning: vercel link');
        console.log('Follow the prompts to select your project...\n');
        try {
            execSync('vercel link', { stdio: 'inherit', cwd: process.cwd() });
            console.log('\n✅ Vercel project linked successfully!');
            return fs.existsSync(vercelConfigPath);
        } catch (err) {
            console.log('\n⚠️  Vercel link failed or was cancelled.');
            console.log('You can run it later with: vercel link');
            return false;
        }
    } else {
        console.log('\n📋 Skipped. Run later with: vercel link');
        console.log('   ⚠️  Remember to link before using vercel-cli commands!');
        return false;
    }
}

// Keys that are local-dev-only and should never be pushed to Vercel.
// Everything matching LOCAL_* is excluded; add explicit names here for edge
// cases that don't follow the LOCAL_ prefix convention.
const VERCEL_ENV_EXCLUDE_EXACT = new Set([
    'IGNORE_LOCAL_USER_ID',
]);

function isLocalOnlyEnvKey(key) {
    if (key.startsWith('LOCAL_')) return true;
    return VERCEL_ENV_EXCLUDE_EXACT.has(key);
}

function parseDotenvFile(filePath) {
    const out = {};
    if (!fs.existsSync(filePath)) return out;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (key) out[key] = value;
    }
    return out;
}

async function promptVercelEnvPush() {
    // Merge .env (template defaults) and .env.local (secrets); .env.local wins,
    // matching Next.js precedence. Then drop LOCAL_* keys so laptop-specific
    // values never reach preview/production.
    const envBase = parseDotenvFile(path.resolve(process.cwd(), '.env'));
    const envLocal = parseDotenvFile(path.resolve(process.cwd(), '.env.local'));
    const merged = { ...envBase, ...envLocal };

    const pushable = Object.entries(merged)
        .filter(([key, value]) => !isLocalOnlyEnvKey(key) && value.length > 0)
        .map(([key]) => key)
        .sort();
    const excluded = Object.keys(merged).filter((k) => isLocalOnlyEnvKey(k)).sort();

    console.log('\n📤 Vercel Environment Variables');
    console.log('═'.repeat(50));

    if (pushable.length === 0) {
        console.log('\nNo env vars to push (empty or only LOCAL_* keys).');
        console.log('Run later with: yarn vercel-cli env:push');
        return;
    }

    console.log(`\nThese ${pushable.length} variable(s) will be pushed to Vercel (preview + production):\n`);
    for (const key of pushable) console.log(`  • ${key}`);

    if (excluded.length > 0) {
        console.log(`\nSkipped (${excluded.length}, local-only): ${excluded.join(', ')}`);
    }

    console.log('\n⚠️  Review the list above — values won\'t be shown but keys will go to Vercel.');
    console.log('   Anything pointing to a dev-only resource (e.g. local MongoDB) should be removed from .env.local first.');

    const answer = await prompt('\nPush these to Vercel now?', 'N');
    const confirmed = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    if (!confirmed) {
        console.log('\n📋 Skipped. Run later with: yarn vercel-cli env:push');
        return;
    }

    // Write the filtered set to a tempfile so vercel-cli env:push only sees the
    // keys the user confirmed. Using os.tmpdir to avoid committing anything.
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), `init-project-env-${process.pid}.env`);
    const tmpContent = pushable.map((k) => `${k}=${merged[k]}`).join('\n') + '\n';
    fs.writeFileSync(tmpFile, tmpContent, { encoding: 'utf8', mode: 0o600 });

    try {
        console.log('\nRunning: yarn vercel-cli env:push --target preview,production --overwrite\n');
        execSync(
            `yarn vercel-cli env:push --file "${tmpFile}" --target preview,production --overwrite`,
            { stdio: 'inherit', cwd: process.cwd() }
        );
        console.log('\n✅ Env vars pushed to Vercel.');
    } catch (err) {
        console.log('\n⚠️  Env push failed:', err.message || err);
        console.log('   You can retry with: yarn vercel-cli env:push');
    } finally {
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});


