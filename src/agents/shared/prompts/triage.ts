/**
 * Triage Agent Prompts
 *
 * Builds prompts for the triage agent that classifies workflow items
 * by domain and optionally suggests priority/size/complexity.
 */

import { SEED_DOMAINS } from '@/server/template/project-management/domains';

interface TriageItemContext {
    title: string;
    description?: string;
    issueBody?: string;
    type: string;
    hasPriority: boolean;
    hasSize: boolean;
    hasComplexity: boolean;
    existingDomains?: string[];
}

export function buildTriagePrompt(item: TriageItemContext): string {
    const seedList = SEED_DOMAINS.map(d => `- **${d.value}**: ${d.description}`).join('\n');

    const existing = item.existingDomains ?? [];
    const domainSection = existing.length > 0
        ? `## Existing Domains (prefer reusing these)\n\n${existing.map(d => `- ${d}`).join('\n')}\n\n## Seed Domain Suggestions\n\nIf none of the existing domains fit, consider these or create a new short lowercase label:\n\n${seedList}`
        : `## Domain Suggestions\n\nUse one of these if appropriate, or create a new short lowercase label:\n\n${seedList}`;

    const missingFields: string[] = [];
    if (!item.hasPriority) missingFields.push('priority (critical | high | medium | low)');
    if (!item.hasSize) missingFields.push('size (XS | S | M | L | XL)');
    if (!item.hasComplexity) missingFields.push('complexity (High | Medium | Low)');

    const missingFieldsInstruction = missingFields.length > 0
        ? `\n\nThe following fields are NOT yet set on this item. Please suggest values:\n${missingFields.map(f => `- ${f}`).join('\n')}`
        : '\n\nAll metadata fields (priority, size, complexity) are already set. Do NOT include them in your output.';

    const verificationInstruction = item.type === 'bug'
        ? `- **Verify the bug still exists**: Search the codebase for the relevant code. If the bug has already been fixed, set \`stillRelevant\` to false and explain in the triage summary.`
        : `- **Verify the feature is not yet implemented**: Search the codebase to check if this feature already exists. If it's already implemented, set \`stillRelevant\` to false and explain in the triage summary.`;

    return `You are a triage agent. Your job is to investigate, classify, and enrich workflow items.

${domainSection}

## Item

- **Type:** ${item.type}
- **Title:** ${item.title}
${item.description ? `- **Description:** ${item.description}` : ''}
${item.issueBody ? `\n### Issue Body\n\n${item.issueBody}` : ''}
${missingFieldsInstruction}

## Instructions

### 1. Investigate and Verify
${verificationInstruction}
- Look at relevant source files to understand the scope and impact.

### 2. Write a Triage Summary
Write a clear, informative triage summary that will be appended to the item's description. Include:
- **What you found**: Key files, components, or areas affected.
- **Verification result**: Whether the bug still exists or feature is not yet implemented.
- **Scope assessment**: How much of the codebase is affected and what changes would be needed.
- If the original description is vague, add concrete details that clarify the issue.

The triage summary should be useful for whoever works on this item next. Keep it concise but informative (3-8 sentences).

### 3. Classify
- Choose the single most appropriate domain. Strongly prefer reusing an existing domain.
- Only create a new domain if none of the existing ones fit. New domains should be short, lowercase, and descriptive.
- If metadata fields are missing, suggest values based on your investigation.

### 4. Set stillRelevant
- Set to \`true\` if the issue is still valid and needs work.
- Set to \`false\` if the bug is already fixed or the feature is already implemented.

Return your response as structured JSON.`;
}
