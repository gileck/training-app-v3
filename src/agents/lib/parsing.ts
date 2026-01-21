/**
 * Agent Output Parsing
 *
 * Library-agnostic functions for parsing agent output.
 * Works on text content returned by any agent library.
 */

// ============================================================
// OUTPUT PARSING
// ============================================================

/**
 * Extract markdown content from agent output
 *
 * Handles nested code blocks by properly matching opening and closing fence markers.
 */
export function extractMarkdown(text: string): string | null {
    if (!text) return null;

    try {
        // Try to find ```markdown ... ``` pattern with proper fence matching
        const markdownStart = text.indexOf('```markdown');
        if (markdownStart !== -1) {
            // Start after the opening fence and newline
            const contentStart = text.indexOf('\n', markdownStart) + 1;
            if (contentStart === 0) return null;

            // Find the matching closing fence by counting nested blocks
            let depth = 1; // We're inside the first markdown block
            let pos = contentStart;

            while (pos < text.length && depth > 0) {
                // Find next occurrence of ```
                const nextFence = text.indexOf('```', pos);
                if (nextFence === -1) break;

                // Check if it's at the start of a line (valid fence)
                const lineStart = text.lastIndexOf('\n', nextFence) + 1;
                const beforeFence = text.slice(lineStart, nextFence).trim();

                if (beforeFence === '') {
                    // It's a valid fence at line start
                    // Check if it's an opening or closing fence
                    const afterFence = text.slice(nextFence + 3, nextFence + 20);
                    if (/^[a-z]+/.test(afterFence)) {
                        // Opening fence (has language identifier)
                        depth++;
                    } else {
                        // Closing fence
                        depth--;
                        if (depth === 0) {
                            // Found the matching closing fence
                            return text.slice(contentStart, nextFence).trim();
                        }
                    }
                }

                pos = nextFence + 3;
            }

            // If we didn't find a closing fence, take everything after the opening
            return text.slice(contentStart).trim();
        }

        // Try plain ``` blocks (might not have markdown specifier)
        const plainCodeStart = text.indexOf('```');
        if (plainCodeStart !== -1) {
            const contentStart = text.indexOf('\n', plainCodeStart) + 1;
            if (contentStart === 0) return null;

            // Find the next ``` at line start
            let pos = contentStart;
            while (pos < text.length) {
                const nextFence = text.indexOf('```', pos);
                if (nextFence === -1) break;

                const lineStart = text.lastIndexOf('\n', nextFence) + 1;
                const beforeFence = text.slice(lineStart, nextFence).trim();

                if (beforeFence === '') {
                    const content = text.slice(contentStart, nextFence).trim();
                    // Check if it looks like a design document
                    if (content.includes('# ') && (content.includes('Overview') || content.includes('Design'))) {
                        return content;
                    }
                    break;
                }

                pos = nextFence + 3;
            }
        }

        // If no code block, check if the entire output is a design document
        if (text.includes('# ') && (text.includes('Overview') || text.includes('Design'))) {
            return text.trim();
        }

        return null;
    } catch (error) {
        console.error('  Markdown parse error:', error);
        return null;
    }
}

/**
 * Extract JSON from agent output
 */
export function extractJSON<T>(text: string): T | null {
    if (!text) return null;

    try {
        // Try to find JSON block in the text
        // Look for ```json ... ``` pattern first
        const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        let jsonStr = jsonBlockMatch?.[1];

        // If no code block, try to find raw JSON object
        if (!jsonStr) {
            const rawJsonMatch = text.match(/\{[\s\S]*\}/);
            jsonStr = rawJsonMatch?.[0];
        }

        if (!jsonStr) {
            return null;
        }

        return JSON.parse(jsonStr) as T;
    } catch (error) {
        console.error('  JSON parse error:', error);
        return null;
    }
}

/**
 * Extract review content from agent output
 */
export function extractReview(text: string): string | null {
    if (!text) return null;

    try {
        // Look for ```review ... ``` pattern
        const reviewBlockMatch = text.match(/```review\s*([\s\S]*?)\s*```/);
        if (reviewBlockMatch?.[1]) {
            return reviewBlockMatch[1].trim();
        }

        // If no code block, return the entire text if it looks like a review
        if (text.includes('## Review Decision') || text.includes('DECISION:')) {
            return text.trim();
        }

        return null;
    } catch (error) {
        console.error('  Review parse error:', error);
        return null;
    }
}

/**
 * Parse review decision from review content
 */
export function parseReviewDecision(reviewContent: string): 'approved' | 'request_changes' | null {
    if (!reviewContent) return null;

    const decisionMatch = reviewContent.match(/DECISION:\s*(APPROVED|REQUEST_CHANGES)/i);
    if (decisionMatch) {
        return decisionMatch[1].toUpperCase() === 'APPROVED' ? 'approved' : 'request_changes';
    }

    return null;
}

// ============================================================
// DESIGN DOCUMENT HELPERS
// ============================================================

/**
 * Design section markers
 */
export const DESIGN_MARKERS = {
    productStart: '<!-- AUTO-GENERATED: PRODUCT DESIGN -->',
    productEnd: '<!-- END PRODUCT DESIGN -->',
    techStart: '<!-- AUTO-GENERATED: TECHNICAL DESIGN -->',
    techEnd: '<!-- END TECHNICAL DESIGN -->',
};

/**
 * Extract the original description from issue body (before any design sections)
 */
export function extractOriginalDescription(issueBody: string): string {
    // Find the first design marker
    const markers = [DESIGN_MARKERS.productStart, DESIGN_MARKERS.techStart, '---\n\n## Product Design', '---\n\n## Technical Design'];

    let endIndex = issueBody.length;
    for (const marker of markers) {
        const idx = issueBody.indexOf(marker);
        if (idx !== -1 && idx < endIndex) {
            endIndex = idx;
        }
    }

    return issueBody.slice(0, endIndex).trim();
}

/**
 * Extract product design from issue body
 */
export function extractProductDesign(issueBody: string): string | null {
    const startIdx = issueBody.indexOf(DESIGN_MARKERS.productStart);
    const endIdx = issueBody.indexOf(DESIGN_MARKERS.productEnd);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        return issueBody.slice(startIdx + DESIGN_MARKERS.productStart.length, endIdx).trim();
    }

    // Try alternate format
    const altStart = issueBody.indexOf('## Product Design\n');
    if (altStart !== -1) {
        const altEnd = issueBody.indexOf('## Technical Design', altStart);
        if (altEnd !== -1) {
            return issueBody.slice(altStart, altEnd).trim();
        }
        return issueBody.slice(altStart).trim();
    }

    return null;
}

/**
 * Extract technical design from issue body
 */
export function extractTechDesign(issueBody: string): string | null {
    const startIdx = issueBody.indexOf(DESIGN_MARKERS.techStart);
    const endIdx = issueBody.indexOf(DESIGN_MARKERS.techEnd);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        return issueBody.slice(startIdx + DESIGN_MARKERS.techStart.length, endIdx).trim();
    }

    // Try alternate format
    const altStart = issueBody.indexOf('## Technical Design\n');
    if (altStart !== -1) {
        return issueBody.slice(altStart).trim();
    }

    return null;
}

/**
 * Build updated issue body with new design content
 */
export function buildUpdatedIssueBody(
    originalDescription: string,
    productDesign: string | null,
    techDesign: string | null
): string {
    const parts: string[] = [originalDescription];

    if (productDesign) {
        const timestamp = new Date().toISOString();
        parts.push(`
---

## Product Design

${DESIGN_MARKERS.productStart}
<!-- Generated: ${timestamp} -->

${productDesign}

${DESIGN_MARKERS.productEnd}`);
    }

    if (techDesign) {
        const timestamp = new Date().toISOString();
        parts.push(`
---

## Technical Design

${DESIGN_MARKERS.techStart}
<!-- Generated: ${timestamp} -->

${techDesign}

${DESIGN_MARKERS.techEnd}`);
    }

    return parts.join('\n');
}
