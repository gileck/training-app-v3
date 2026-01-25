/**
 * Commit Message Generator
 *
 * Utilities for generating, formatting, and parsing commit messages for PRs.
 * Used by PR Review Agent when approving PRs to store commit message for later merge.
 */

import { COMMIT_MESSAGE_MARKER } from '@/server/project-management/config';
import type { ProjectItemContent } from '@/server/project-management/types';

// ============================================================
// TYPES
// ============================================================

export interface PRInfo {
    title: string;
    body: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    commits: number;
}

export interface CommitMessageResult {
    title: string;
    body: string;
}

export interface PhaseInfo {
    current: number;
    total: number;
}

// ============================================================
// COMMIT MESSAGE GENERATION
// ============================================================

/**
 * Generate commit message from PR info (deterministic, no AI)
 * Called by PR Reviewer when approving
 */
export function generateCommitMessage(
    prInfo: PRInfo,
    issueContent: ProjectItemContent | null,
    phaseInfo?: PhaseInfo
): CommitMessageResult {
    // Use PR title as commit title
    const title = prInfo.title;

    // Build commit body from PR info
    const body = buildCommitBody(prInfo, issueContent, phaseInfo);

    return { title, body };
}

/**
 * Build commit message body from PR info
 *
 * Format:
 * - What: Brief summary of changes
 * - Why: Problem being solved (from issue body if available)
 * - Stats: Change statistics
 * - Phase info (if multi-phase)
 * - Issue reference (Closes/Part of)
 */
function buildCommitBody(
    prInfo: PRInfo,
    content: ProjectItemContent | null,
    phaseInfo?: PhaseInfo
): string {
    const lines: string[] = [];

    // Extract "What" - summary from PR body
    const whatSummary = extractWhatSummary(prInfo.body);
    if (whatSummary) {
        lines.push(whatSummary);
        lines.push('');
    }

    // Extract "Why" - rationale from issue body
    const whyRationale = extractWhyRationale(content?.body);
    if (whyRationale) {
        lines.push(`Why: ${whyRationale}`);
        lines.push('');
    }

    // Add change stats (compact format)
    const statsLine = buildStatsLine(prInfo, phaseInfo);
    lines.push(statsLine);

    // Add issue reference (always "Part of" - never "Closes" since PRs may be phases)
    if (content?.number) {
        lines.push('');
        lines.push(`Part of #${content.number}`);
    }

    return lines.join('\n');
}

/**
 * Extract "What" summary from PR body
 * Looks for content before separators or specific sections
 */
function extractWhatSummary(prBody: string): string {
    if (!prBody) return '';

    // Split at common separators
    const bodyParts = prBody.split(/---|\n## Test [Pp]lan|\n## Changes/);
    let summary = bodyParts[0].trim();

    // Remove common headers
    summary = summary.replace(/^## Summary\s*/i, '');
    summary = summary.replace(/^## What\s*/i, '');
    summary = summary.trim();

    // Convert to bullet points if not already
    const lines = summary.split('\n').filter(line => line.trim());

    // Take first 4 meaningful lines
    const meaningfulLines = lines
        .slice(0, 4)
        .map(line => {
            // Ensure bullet point format
            const trimmed = line.trim();
            if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
                return trimmed;
            }
            // Skip headers and empty lines
            if (trimmed.startsWith('#') || !trimmed) return '';
            return `- ${trimmed}`;
        })
        .filter(line => line);

    return meaningfulLines.join('\n');
}

/**
 * Extract "Why" rationale from issue body
 * Looks for problem statement, motivation, or first paragraph
 */
function extractWhyRationale(issueBody: string | null | undefined): string {
    if (!issueBody) return '';

    // Try to find explicit "Why" or "Problem" section
    const whyMatch = issueBody.match(/## (?:Why|Problem|Motivation|Background)\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (whyMatch) {
        const whyContent = whyMatch[1].trim().split('\n')[0].trim();
        if (whyContent && whyContent.length > 10) {
            return truncateText(whyContent, 100);
        }
    }

    // Try to extract from summary section
    const summaryMatch = issueBody.match(/## Summary\s*\n([\s\S]*?)(?=\n##|$)/i);
    if (summaryMatch) {
        const firstLine = summaryMatch[1].trim().split('\n')[0].trim();
        if (firstLine && firstLine.length > 10) {
            return truncateText(firstLine, 100);
        }
    }

    // Fall back to first non-empty, non-header line
    const lines = issueBody.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('|') && trimmed.length > 10) {
            return truncateText(trimmed, 100);
        }
    }

    return '';
}

/**
 * Build compact stats line
 */
function buildStatsLine(prInfo: PRInfo, phaseInfo?: PhaseInfo): string {
    const parts: string[] = [];

    parts.push(`+${prInfo.additions}/-${prInfo.deletions}`);
    parts.push(`${prInfo.changedFiles} files`);

    if (phaseInfo && phaseInfo.total > 1) {
        parts.push(`Phase ${phaseInfo.current}/${phaseInfo.total}`);
    }

    return parts.join(' | ');
}

/**
 * Truncate text to max length, adding ellipsis if needed
 */
function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3).trim() + '...';
}

// ============================================================
// PR COMMENT FORMATTING
// ============================================================

/**
 * Format commit message as a PR comment with marker
 */
export function formatCommitMessageComment(title: string, body: string): string {
    return `${COMMIT_MESSAGE_MARKER}
## Commit Message

This commit message will be used when merging this PR:

**Title:**
\`\`\`
${title}
\`\`\`

**Body:**
\`\`\`
${body}
\`\`\`

---
*Generated by PR Review Agent. Admin will use this when merging.*`;
}

/**
 * Parse commit message from PR comment
 */
export function parseCommitMessageComment(commentBody: string): CommitMessageResult | null {
    if (!commentBody.includes(COMMIT_MESSAGE_MARKER)) return null;

    // Extract title between first ``` pair after "Title:"
    const titleMatch = commentBody.match(/\*\*Title:\*\*\s*```\s*([\s\S]*?)```/);
    const bodyMatch = commentBody.match(/\*\*Body:\*\*\s*```\s*([\s\S]*?)```/);

    if (!titleMatch || !bodyMatch) return null;

    return {
        title: titleMatch[1].trim(),
        body: bodyMatch[1].trim(),
    };
}
