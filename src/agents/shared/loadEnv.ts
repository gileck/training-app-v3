/**
 * Load environment variables from .env.local and .env files
 * Matches Next.js convention: .env.local takes priority over .env
 *
 * CRITICAL: Uses process.cwd() instead of __dirname to ensure
 * child projects load THEIR env files, not the template's.
 */
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Use current working directory, NOT script location (__dirname)
// This is critical for child projects that sync scripts from template
// If we used __dirname, child projects would load template's env files!
const rootDir = process.cwd();

// Load .env first (base config)
const envPath = resolve(rootDir, '.env');
if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// Load .env.local second (overrides .env - local secrets)
const envLocalPath = resolve(rootDir, '.env.local');
if (existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
}
