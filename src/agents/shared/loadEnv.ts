/**
 * Load environment variables from .env.local and .env files
 * Matches Next.js convention: .env.local takes priority over .env
 */
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

const rootDir = resolve(__dirname, '../../../');

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
