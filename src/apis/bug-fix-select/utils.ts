/**
 * Bug Fix Select Utilities
 *
 * Utilities for parsing investigation comments and validating tokens.
 */

import crypto from 'crypto';
import type { ParsedFixOption, ParsedInvestigation } from './types';
import { GitHubProjectsAdapter } from '@/server/project-management/adapters/github';
import { STATUSES, REVIEW_STATUSES } from '@/server/project-management/config';

// ============================================================
// TOKEN UTILITIES
// ============================================================

// Reuse the same token generation as clarification
// (uses the same secret and algorithm)

/**
 * Generate a security token for a bug fix selection page.
 * Uses HMAC-SHA256 with a secret key, returns first 8 chars.
 */
export function generateBugFixToken(issueNumber: number): string {
    const secret = process.env.CLARIFICATION_SECRET || 'default-secret-change-me';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`bug-fix:${issueNumber}`);
    return hmac.digest('hex').substring(0, 8);
}

/**
 * Validate a bug fix selection token.
 */
export function validateBugFixToken(issueNumber: number, token: string): boolean {
    const expected = generateBugFixToken(issueNumber);
    return token === expected;
}

// ============================================================
// ITEM VERIFICATION
// ============================================================

/**
 * Find a project item by issue number and verify it's in
 * Bug Investigation status with Waiting for Review.
 */
export async function findBugInvestigationItem(
    adapter: GitHubProjectsAdapter,
    issueNumber: number
): Promise<{ valid: boolean; error?: string; itemId?: string }> {
    const items = await adapter.listItems({});
    const item = items.find(
        (i) => i.content?.type === 'Issue' && i.content?.number === issueNumber
    );

    if (!item) {
        return { valid: false, error: `Issue #${issueNumber} not found in project` };
    }

    if (item.status !== STATUSES.bugInvestigation) {
        return {
            valid: false,
            error: `Issue is not in Bug Investigation phase (current: ${item.status})`,
        };
    }

    if (item.reviewStatus !== REVIEW_STATUSES.waitingForReview) {
        return {
            valid: false,
            error: `Issue is not waiting for review (current: ${item.reviewStatus || 'empty'})`,
        };
    }

    return { valid: true, itemId: item.id };
}

// ============================================================
// INVESTIGATION COMMENT PARSING
// ============================================================

const INVESTIGATION_MARKER = '<!-- BUG_INVESTIGATION_V1 -->';

/**
 * Check if a comment is a bug investigation comment.
 */
export function isInvestigationComment(body: string): boolean {
    return body.includes(INVESTIGATION_MARKER);
}

/**
 * Extract investigation content from a comment body.
 * Removes the marker and agent prefix.
 */
export function extractInvestigationContent(body: string): string {
    // Remove marker
    let content = body.replace(INVESTIGATION_MARKER, '').trim();

    // Remove agent prefix if present (e.g., "🔍 **[Bug Investigator Agent]**\n\n")
    content = content.replace(/^[🔍🐛]\s*\*\*\[.*?Agent\]\*\*\s*\n+/, '');

    return content;
}

/**
 * Parse fix options from investigation content.
 */
export function parseFixOptions(content: string): ParsedFixOption[] {
    const options: ParsedFixOption[] = [];

    // Look for fix option sections
    // Pattern: "#### opt1: Title" or "#### opt1: Title ⭐ **Recommended**"
    const optionRegex = /####\s+(opt\d+):\s+(.+?)(\s+⭐\s+\*\*Recommended\*\*)?\s*\n([\s\S]*?)(?=####\s+opt\d+:|###\s+|$)/g;

    let match;
    while ((match = optionRegex.exec(content)) !== null) {
        const id = match[1];
        const title = match[2].trim();
        const isRecommended = !!match[3];
        const optionContent = match[4].trim();

        // Parse option details
        const complexityMatch = optionContent.match(/\*\*Complexity:\*\*\s*(\w+)/);
        const destinationMatch = optionContent.match(/\*\*Destination:\*\*\s*(Direct Implementation|Technical Design)/);
        const filesMatch = optionContent.match(/\*\*Files Affected:\*\*\s*([^\n]+)/);
        const tradeoffsMatch = optionContent.match(/\*\*Trade-offs:\*\*\s*([^\n]+)/);

        // Extract description (everything not in the parsed fields)
        const description = optionContent
            .replace(/- \*\*Complexity:\*\*[^\n]+\n?/g, '')
            .replace(/- \*\*Destination:\*\*[^\n]+\n?/g, '')
            .replace(/- \*\*Files Affected:\*\*[^\n]+\n?/g, '')
            .replace(/\*\*Trade-offs:\*\*[^\n]+\n?/g, '')
            .trim();

        // Parse files affected
        let filesAffected: string[] = [];
        if (filesMatch) {
            const filesStr = filesMatch[1].trim();
            if (filesStr !== 'TBD' && filesStr !== '') {
                filesAffected = filesStr.split(',').map(f => f.trim().replace(/`/g, ''));
            }
        }

        // Map destination string to type
        let destination: 'implement' | 'tech-design' = 'tech-design';
        if (destinationMatch) {
            destination = destinationMatch[1] === 'Direct Implementation' ? 'implement' : 'tech-design';
        }

        options.push({
            id,
            title,
            description,
            destination,
            complexity: (complexityMatch?.[1] as 'S' | 'M' | 'L' | 'XL') || 'M',
            filesAffected,
            tradeoffs: tradeoffsMatch?.[1],
            isRecommended,
        });
    }

    return options;
}

/**
 * Parse root cause analysis from investigation content.
 */
export function parseRootCauseAnalysis(content: string): {
    rootCauseFound: boolean;
    confidence: 'low' | 'medium' | 'high';
    analysis: string;
} {
    // Parse root cause found
    const rootCauseMatch = content.match(/\*\*Root Cause Found:\*\*\s*(Yes|No)/);
    const rootCauseFound = rootCauseMatch?.[1] === 'Yes';

    // Parse confidence
    const confidenceMatch = content.match(/\*\*Confidence:\*\*\s*[🟢🟡🔴]\s*(\w+)/);
    let confidence: 'low' | 'medium' | 'high' = 'medium';
    if (confidenceMatch) {
        const confStr = confidenceMatch[1].toLowerCase();
        if (confStr === 'high' || confStr === 'low' || confStr === 'medium') {
            confidence = confStr;
        }
    }

    // Extract root cause analysis section
    const analysisMatch = content.match(/### Root Cause Analysis\s*\n([\s\S]*?)(?=### |$)/);
    const analysis = analysisMatch?.[1]?.trim() || '';

    return { rootCauseFound, confidence, analysis };
}

/**
 * Parse a full investigation from a comment body.
 */
export function parseInvestigation(
    body: string,
    issueNumber: number,
    issueTitle: string
): ParsedInvestigation | null {
    if (!isInvestigationComment(body)) {
        return null;
    }

    const content = extractInvestigationContent(body);
    const { rootCauseFound, confidence, analysis } = parseRootCauseAnalysis(content);
    const fixOptions = parseFixOptions(content);

    if (fixOptions.length === 0) {
        return null;
    }

    return {
        issueNumber,
        issueTitle,
        rootCauseFound,
        confidence,
        rootCauseAnalysis: analysis,
        fixOptions,
    };
}

/**
 * Format fix selection decision as a GitHub comment.
 */
export function formatFixDecisionComment(
    selection: {
        selectedOptionId: string;
        customSolution?: string;
        customDestination?: 'implement' | 'tech-design';
        notes?: string;
    },
    fixOptions: ParsedFixOption[],
    routedTo: 'implement' | 'tech-design'
): string {
    const destinationLabel = routedTo === 'implement' ? 'Implementation' : 'Technical Design';

    let comment = `## 🔧 Fix Approach Selected

`;

    if (selection.selectedOptionId === 'custom') {
        comment += `**Selected:** Custom Solution
**Routed to:** ${destinationLabel}

**Custom Solution:**
${selection.customSolution}
`;
    } else {
        const selectedOption = fixOptions.find(o => o.id === selection.selectedOptionId);
        if (selectedOption) {
            comment += `**Selected:** ${selectedOption.id}: ${selectedOption.title}
**Complexity:** ${selectedOption.complexity}
**Routed to:** ${destinationLabel}
`;
        }
    }

    if (selection.notes) {
        comment += `
**Additional Notes:**
${selection.notes}
`;
    }

    comment += `
---
_The bug will now proceed to the ${destinationLabel} phase._`;

    return comment;
}
