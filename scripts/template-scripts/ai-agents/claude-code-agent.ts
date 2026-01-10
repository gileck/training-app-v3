/**
 * Claude Code SDK Agent
 *
 * Uses Claude Code SDK for AI descriptions.
 * Requires Claude Code CLI to be authenticated (run `claude login`).
 * No API key needed - uses CLI authentication.
 * All methods fail gracefully - return null on any error.
 */

import { query, type SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

// ============================================================
// CONFIGURATION
// ============================================================
const MODEL = 'haiku';  // Fastest Claude model
const TIMEOUT_MS = 15000;
const MAX_TURNS = 1;  // Single turn for simple prompts
// ============================================================

/**
 * Check if Claude Code SDK is available
 * (CLI must be authenticated)
 */
export function isAgentAvailable(): boolean {
    // Claude Code SDK is always available if the package is installed
    // Authentication is checked at runtime
    return true;
}

/**
 * Ask Claude a question using Claude Code SDK.
 * Returns null on any error/timeout.
 */
export async function askAgent(prompt: string): Promise<string | null> {
    try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

        let result: string | null = null;

        for await (const message of query({
            prompt,
            options: {
                model: MODEL,
                maxTurns: MAX_TURNS,
                allowedTools: [],  // No tools needed for simple descriptions
                abortController,
            },
        })) {
            if (message.type === 'result') {
                const resultMsg = message as SDKResultMessage;
                if (resultMsg.subtype === 'success' && resultMsg.result) {
                    result = resultMsg.result.trim();
                }
            }
        }

        clearTimeout(timeoutId);
        return result;
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

/**
 * Conflict analysis result
 */
export interface ConflictAnalysis {
    templateChanges: string;
    projectChanges: string;
    difficulty: 'easy' | 'moderate' | 'hard';
    recommendation: 'take-template' | 'keep-project' | 'manual-merge';
    summary: string;
}

/**
 * Analyze a conflict between template and project changes.
 * Provides detailed analysis of what changed on both sides,
 * merge difficulty, and a recommendation.
 */
export async function analyzeConflict(
    filePath: string,
    templateDiff: string,
    projectDiff: string
): Promise<ConflictAnalysis | null> {
    if (!templateDiff.trim() && !projectDiff.trim()) return null;

    // Truncate diffs for the prompt
    const maxLen = 600;
    const truncateTemplateDiff = templateDiff.length > maxLen
        ? templateDiff.slice(0, maxLen) + '\n... (truncated)'
        : templateDiff;
    const truncateProjectDiff = projectDiff.length > maxLen
        ? projectDiff.slice(0, maxLen) + '\n... (truncated)'
        : projectDiff;

    const prompt = `Analyze this merge conflict for file: ${filePath}

TEMPLATE CHANGES (upstream updates):
\`\`\`diff
${truncateTemplateDiff || '(no changes)'}
\`\`\`

PROJECT CHANGES (local modifications):
\`\`\`diff
${truncateProjectDiff || '(no changes)'}
\`\`\`

Respond in this EXACT JSON format (no other text):
{
  "templateChanges": "<1 sentence: what the template changed>",
  "projectChanges": "<1 sentence: what the project changed>",
  "difficulty": "<easy|moderate|hard>",
  "recommendation": "<take-template|keep-project|manual-merge>",
  "summary": "<1-2 sentences: conflict nature and suggested approach>"
}

Difficulty guide:
- easy: Changes are in different parts of the file, or one side is clearly better
- moderate: Some overlap but changes can be combined with care
- hard: Deep conflicts in the same code sections, requires careful review

Recommendation guide:
- take-template: Template changes are improvements/fixes, project changes are minor
- keep-project: Project has important customizations, template changes are generic
- manual-merge: Both changes are important and should be combined`;

    try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 20000); // Longer timeout for analysis

        let result: string | null = null;

        for await (const message of query({
            prompt,
            options: {
                model: MODEL,
                maxTurns: MAX_TURNS,
                allowedTools: [],
                abortController,
            },
        })) {
            if (message.type === 'result') {
                const resultMsg = message as SDKResultMessage;
                if (resultMsg.subtype === 'success' && resultMsg.result) {
                    result = resultMsg.result.trim();
                }
            }
        }

        clearTimeout(timeoutId);

        if (!result) return null;

        // Parse JSON response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and return
        return {
            templateChanges: parsed.templateChanges || 'Unknown template changes',
            projectChanges: parsed.projectChanges || 'Unknown project changes',
            difficulty: ['easy', 'moderate', 'hard'].includes(parsed.difficulty)
                ? parsed.difficulty
                : 'moderate',
            recommendation: ['take-template', 'keep-project', 'manual-merge'].includes(parsed.recommendation)
                ? parsed.recommendation
                : 'manual-merge',
            summary: parsed.summary || 'Conflict requires review',
        };
    } catch {
        return null;
    }
}
