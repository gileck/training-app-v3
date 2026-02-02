/**
 * Clarification Utility Functions
 *
 * Handles token generation/validation and parsing of
 * clarification content from agent comments.
 */

import crypto from 'crypto';
import type { ParsedQuestion, ParsedOption, QuestionAnswer } from './types';

// ============================================================
// TOKEN GENERATION & VALIDATION
// ============================================================

/**
 * Generate a security token for a clarification URL.
 * Uses SHA256 hash of issue number + JWT_SECRET.
 *
 * @param issueNumber - The GitHub issue number
 * @returns 8-character hex token
 */
export function generateClarificationToken(issueNumber: number): string {
    const secret = process.env.JWT_SECRET || 'fallback-secret-for-local-dev';
    const data = `clarify-${issueNumber}-${secret}`;
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 8);
}

/**
 * Validate a clarification token.
 *
 * @param issueNumber - The GitHub issue number
 * @param token - Token to validate
 * @returns true if valid
 */
export function validateClarificationToken(issueNumber: number, token: string): boolean {
    const expected = generateClarificationToken(issueNumber);
    return token === expected;
}

// ============================================================
// CLARIFICATION PARSING
// ============================================================

/**
 * Parse clarification content from a GitHub comment into structured questions.
 *
 * Expected format (from agent prompts.ts):
 * ```
 * ## Context
 * [Describe what's ambiguous or unclear]
 *
 * ## Question
 * [Your specific question]
 *
 * ## Options
 *
 * ✅ Option 1: [Recommended option name]
 *    - [Benefit/reason 1]
 *    - [Benefit/reason 2]
 *
 * ⚠️ Option 2: [Non-recommended option name]
 *    - [Drawback/reason 1]
 *    - [Drawback/reason 2]
 *
 * ## Recommendation
 * I recommend Option 1 because [clear reasoning].
 * ```
 *
 * @param content - Raw clarification content
 * @returns Array of parsed questions (usually just one, but supports multiple)
 */
export function parseClarificationContent(content: string): ParsedQuestion[] {
    const questions: ParsedQuestion[] = [];

    // Split by "## Context" to handle potential multiple questions
    // (though typically there's just one per clarification request)
    const contextSections = content.split(/(?=## Context)/);

    for (const section of contextSections) {
        if (!section.trim()) continue;

        const question = parseSingleQuestion(section);
        if (question) {
            questions.push(question);
        }
    }

    return questions;
}

/**
 * Parse a single question section.
 */
function parseSingleQuestion(section: string): ParsedQuestion | null {
    // Extract Context
    const contextMatch = section.match(/## Context\s*([\s\S]*?)(?=## Question|$)/);
    const context = contextMatch ? contextMatch[1].trim() : '';

    // Extract Question
    const questionMatch = section.match(/## Question\s*([\s\S]*?)(?=## Options|$)/);
    const question = questionMatch ? questionMatch[1].trim() : '';

    // Extract Options section
    const optionsMatch = section.match(/## Options\s*([\s\S]*?)(?=## Recommendation|$)/);
    const optionsSection = optionsMatch ? optionsMatch[1].trim() : '';
    const options = parseOptions(optionsSection);

    // Extract Recommendation
    const recommendationMatch = section.match(/## Recommendation\s*([\s\S]*?)(?=## How to Respond|$)/);
    const recommendation = recommendationMatch ? recommendationMatch[1].trim() : '';

    // Must have at least a question and options
    if (!question || options.length === 0) {
        return null;
    }

    return {
        context,
        question,
        options,
        recommendation,
    };
}

/**
 * Parse options from the options section.
 *
 * Expected format:
 * ✅ Option 1: Label here
 *    - Bullet 1
 *    - Bullet 2
 *
 * ⚠️ Option 2: Another label
 *    - Bullet 1
 *
 * Also handles bold markers: ✅ **Option 1: Label here**
 */
function parseOptions(optionsSection: string): ParsedOption[] {
    const options: ParsedOption[] = [];

    // Split by emoji markers (✅ or ⚠️ at start of line)
    // Use alternation instead of character class for proper Unicode handling
    const optionBlocks = optionsSection.split(/(?=^(?:✅|⚠️))/m);

    for (const block of optionBlocks) {
        if (!block.trim()) continue;

        // Match the option header: emoji + optional bold + "Option N:" + label + optional bold
        // Supports both: "✅ Option 1: Label" and "✅ **Option 1: Label**"
        const headerMatch = block.match(/^(✅|⚠️)\s*\*{0,2}\s*Option\s*\d+:\s*(.+?)(?:\*{0,2})(?:\n|$)/);
        if (!headerMatch) continue;

        const emoji = headerMatch[1];
        // Remove any trailing bold markers from label
        const label = headerMatch[2].trim().replace(/\*+$/, '').trim();
        const isRecommended = emoji === '✅';

        // Extract bullets (lines starting with "- " or "   - ")
        const bullets: string[] = [];
        const bulletMatches = block.matchAll(/^\s*-\s+(.+)$/gm);
        for (const match of bulletMatches) {
            bullets.push(match[1].trim());
        }

        options.push({
            emoji,
            label,
            bullets,
            isRecommended,
        });
    }

    return options;
}

// ============================================================
// ANSWER FORMATTING
// ============================================================

/**
 * Format answers for posting as a GitHub comment.
 *
 * The format is designed to be easily understood by AI agents when they
 * continue work after receiving clarification.
 *
 * @param answers - Array of question answers
 * @param questions - Original parsed questions (for context)
 * @returns Formatted markdown comment
 */
export function formatAnswerForGitHub(
    answers: QuestionAnswer[],
    questions: ParsedQuestion[]
): string {
    const lines: string[] = [
        '## ✅ Clarification Provided',
        '',
    ];

    for (const answer of answers) {
        const question = questions[answer.questionIndex];
        if (!question) continue;

        // Add the question for context
        lines.push(`**Question:** ${question.question}`);
        lines.push('');

        // Add the selected answer
        if (answer.selectedOption === 'Other' && answer.customText) {
            lines.push(`**Answer:** Custom response: ${answer.customText}`);
        } else {
            // Include the full option label (e.g., "Email only")
            lines.push(`**Answer:** ${answer.selectedOption}`);
        }

        // Add additional notes if provided
        if (answer.additionalNotes?.trim()) {
            lines.push('');
            lines.push(`**Additional notes:** ${answer.additionalNotes.trim()}`);
        }

        lines.push('');
    }

    lines.push('---');
    lines.push('_Clarification provided via interactive UI. Continue with the selected option(s)._');

    return lines.join('\n');
}

// ============================================================
// COMMENT DETECTION
// ============================================================

/**
 * Check if a comment is a clarification request from an agent.
 *
 * @param body - Comment body
 * @returns true if this is a clarification comment
 */
export function isClarificationComment(body: string): boolean {
    return body.includes('## 🤔 Agent Needs Clarification') ||
           body.includes('🤔 Agent Needs Clarification');
}

/**
 * Extract the clarification content from a comment body.
 * Removes the header, footer, and "How to Respond" sections added by handleClarificationRequest.
 *
 * @param body - Full comment body
 * @returns Just the clarification content (Context, Question, Options, Recommendation)
 */
export function extractClarificationFromComment(body: string): string {
    // Remove agent prefix if present
    // Handles formats like: "🏗️ **[Tech Design Agent]**" or "[🎨 Product Design Agent]"
    let content = body.replace(/^[^\[]*\*{0,2}\[[^\]]+\]\*{0,2}\s*/m, '');

    // Remove the "## 🤔 Agent Needs Clarification" header
    content = content.replace(/## 🤔 Agent Needs Clarification\s*/g, '');

    // Remove ALL "## How to Respond" sections (may appear after each question)
    // Match from "## How to Respond" until the next "## Context" or end of string
    // Using [\s\S] instead of . with 's' flag for ES5 compatibility
    content = content.replace(/## How to Respond[\s\S]*?(?=## Context|---|$)/g, '');

    // Remove the footer
    // Using [\s\S] instead of . with 's' flag for ES5 compatibility
    content = content.replace(/---\s*_Please respond with your answer[\s\S]*$/, '');

    return content.trim();
}
