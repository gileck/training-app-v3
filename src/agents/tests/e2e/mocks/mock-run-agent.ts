/**
 * Mock runAgent — returns canned structured output per workflow type.
 * Tracks all calls for test assertions.
 *
 * Supports per-call override queue via pushAgentResponse() for tests
 * that need the same workflow to return different outputs on successive calls.
 */

import type { AgentRunOptions, AgentRunResult, WorkflowName } from '@/agents/lib/types';

export const agentCalls: AgentRunOptions[] = [];

const CANNED_OUTPUTS: Record<string, unknown> = {
    'product-dev': {
        document: '# Product Development Document\n\nThis is the product development document for the feature.',
        comment: 'Overview: 1. Feature analyzed 2. Requirements documented',
    },
    'product-design': {
        design: '# Product Design\n\nThis is the product design for the feature.',
        comment: 'Overview: 1. UX flows designed 2. UI mockups created',
        needsClarification: false,
    },
    'tech-design': {
        design: '# Technical Design\n\nThis is the technical design for the feature.\n\n## Implementation Plan\n\n1. Create new module\n2. Add tests',
        comment: 'Plan: 1. Architecture defined 2. Implementation steps listed',
        needsClarification: false,
        phases: [
            { name: 'Phase 1', description: 'Core implementation', files: ['src/core.ts'], estimatedSize: 'S' },
        ],
    },
    'implementation': {
        prSummary: '## Changes\n\n- Added new feature module\n- Updated existing tests',
        comment: 'What I did: 1. Implemented the feature 2. Added tests',
    },
    'bug-investigation': {
        rootCauseFound: true,
        confidence: 'high',
        rootCauseAnalysis: 'The bug is caused by a null reference in the login handler.',
        fixOptions: [
            {
                id: 'opt1',
                title: 'Add null check to login handler',
                description: 'Add a simple null check before accessing user properties.',
                destination: 'implement',
                complexity: 'S',
                filesAffected: ['src/auth/login.ts'],
                isRecommended: true,
            },
        ],
        filesExamined: ['src/auth/login.ts', 'src/auth/types.ts'],
        summary: 'Null reference in login handler — simple fix available.',
        autoSubmit: true,
    },
    'pr-review': {
        decision: 'approved',
        summary: 'Code looks good. All changes are well-structured.',
        reviewText: '## Review\n\nAll changes look correct and follow project conventions.',
    },
};

// ============================================================
// Override queue — per-call variant responses
// ============================================================

const outputOverrides = new Map<string, unknown[]>();

/** Queue an override response for a workflow. First queued = first returned. */
export function pushAgentResponse(workflow: string, output: unknown): void {
    const queue = outputOverrides.get(workflow) || [];
    queue.push(output);
    outputOverrides.set(workflow, queue);
}

/** Clear all override queues. */
export function resetAgentOverrides(): void {
    outputOverrides.clear();
}

// ============================================================
// Exported canned variant outputs for tests
// ============================================================

/** Clarification response — agent needs admin clarification */
export const CLARIFICATION_OUTPUT = {
    needsClarification: true,
    clarification: {
        context: 'The feature request mentions dark mode but is ambiguous about scope.',
        question: 'Should dark mode apply to the entire app or just the main content area?',
        options: [
            { label: 'Full app', description: 'Apply dark mode to all UI including sidebar and modals', isRecommended: true },
            { label: 'Content only', description: 'Apply dark mode only to the main content area', isRecommended: false },
        ],
        recommendation: 'Full app dark mode provides a more consistent user experience.',
    },
    design: '',
    comment: '',
};

/** PR review with request_changes decision */
export const PR_REVIEW_REQUEST_CHANGES_OUTPUT = {
    decision: 'request_changes',
    summary: 'Missing error handling in the new module.',
    reviewText: '## Review\n\nPlease add error handling for edge cases.',
};

/** Product design with mock options (design selection decision) */
export const PRODUCT_DESIGN_MOCK_OPTIONS_OUTPUT = {
    design: '# Product Design\n\nSearch feature with two design approaches.',
    comment: 'Design options: 1. Card layout 2. List layout with filters',
    needsClarification: false,
    mockOptions: [
        {
            id: 'optA',
            title: 'Card Grid Layout',
            description: 'Clean card-based grid with search results displayed as cards. Optimized for visual browsing.',
            isRecommended: true,
        },
        {
            id: 'optB',
            title: 'List with Filters',
            description: 'Compact list view with a filter sidebar. Optimized for quick scanning and filtering.',
            isRecommended: false,
        },
    ],
};

/** Tech design with 3 phases (multi-phase feature) */
export const MULTI_PHASE_TECH_DESIGN_OUTPUT = {
    design: '# Technical Design\n\n## Implementation Phases\n\n### Phase 1: Database Layer (S)\nCreate schema and migrations.\n\n### Phase 2: API Layer (M)\nAdd REST endpoints.\n\n### Phase 3: UI Components (S)\nBuild frontend components.',
    comment: 'Plan: 3-phase implementation',
    needsClarification: false,
    phases: [
        { order: 1, name: 'Database Layer', description: 'Create schema and migrations', files: ['src/db/schema.ts'], estimatedSize: 'S' },
        { order: 2, name: 'API Layer', description: 'Add REST endpoints', files: ['src/api/routes.ts'], estimatedSize: 'M' },
        { order: 3, name: 'UI Components', description: 'Build frontend components', files: ['src/components/feature.tsx'], estimatedSize: 'S' },
    ],
};

// ============================================================
// Mock implementation
// ============================================================

export function mockRunAgent(options: AgentRunOptions): Promise<AgentRunResult> {
    agentCalls.push(options);

    const workflow = options.workflow as WorkflowName | undefined;

    // Check override queue first, then fall back to canned outputs
    const queue = workflow ? outputOverrides.get(workflow) : undefined;
    const structuredOutput = (queue?.length ? queue.shift() : undefined)
        ?? (workflow ? CANNED_OUTPUTS[workflow] : undefined);
    const content = structuredOutput ? JSON.stringify(structuredOutput) : 'Generated content';

    return Promise.resolve({
        success: true,
        content,
        filesExamined: [],
        usage: {
            inputTokens: 1000,
            outputTokens: 500,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
            totalCostUSD: 0.01,
        },
        durationSeconds: 5,
        structuredOutput,
    });
}

export function resetAgentCalls(): void {
    agentCalls.length = 0;
}
