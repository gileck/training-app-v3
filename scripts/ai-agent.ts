/**
 * AI Agent for sync-template script
 * 
 * Uses Gemini 2.5 Flash directly for fast code change descriptions (~1s).
 * All methods fail gracefully - return null on any error.
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// CONFIGURATION
// ============================================================
const MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 10000;
// ============================================================

// Cached client
let genAI: GoogleGenAI | null = null;

/**
 * Get or create the Gemini client
 */
function getClient(): GoogleGenAI | null {
    if (genAI) return genAI;

    // Get API key (env var or .env file)
    let apiKey = process.env.GEMINI_API_KEY?.replace(/^["']|["']$/g, '').trim();

    if (!apiKey) {
        try {
            const envPath = path.join(process.cwd(), '.env');
            const content = fs.readFileSync(envPath, 'utf-8');
            const match = content.match(/GEMINI_API_KEY=["']?([^"'\n]+)["']?/);
            apiKey = match?.[1]?.trim();
        } catch { /* ignore */ }
    }

    if (!apiKey) return null;

    try {
        genAI = new GoogleGenAI({ apiKey });
        return genAI;
    } catch {
        return null;
    }
}

/**
 * Check if Gemini API is available
 */
export function isAgentAvailable(): boolean {
    return getClient() !== null;
}

/**
 * Ask Gemini a question. Returns null on any error/timeout.
 */
export async function askAgent(prompt: string): Promise<string | null> {
    const client = getClient();
    if (!client) return null;

    try {
        const timeout = new Promise<null>(r => setTimeout(() => r(null), TIMEOUT_MS));

        const request = client.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: { maxOutputTokens: 500, temperature: 0.3 }
        }).then(r => r.text?.trim() || null);

        return await Promise.race([request, timeout]);
    } catch {
        return null;
    }
}

/**
 * Generate a short description of code changes.
 */
export async function describeChanges(diff: string, _context?: string): Promise<string | null> {
    if (!diff.trim()) return null;

    // Truncate long diffs
    const maxLen = 800;
    const truncated = diff.length > maxLen ? diff.slice(0, maxLen) + '\n...' : diff;

    const prompt = `Describe this code change in ONE short sentence (max 12 words). Be specific.

${truncated}`;

    return askAgent(prompt);
}

/**
 * Describe both sides of a conflict (parallel).
 */
export async function describeConflict(
    templateDiff: string,
    localDiff: string
): Promise<{ template: string | null; local: string | null }> {
    const [template, local] = await Promise.all([
        describeChanges(templateDiff),
        describeChanges(localDiff),
    ]);
    return { template, local };
}
