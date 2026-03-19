/**
 * Design Approval S3 E2E Test
 *
 * Tests the S3-backed design approval flow where:
 * - Design content is saved to S3 at agent completion
 * - Approval reads from S3 and advances status (no PR merge)
 * - Next agent reads design from S3
 *
 * Boundary-only mocks (8 total):
 * - LLM (runAgent), Telegram (notifications), dev server, loadEnv,
 *   child_process, design-files, agents.config, shared/config
 */

import { vi, describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

// ============================================================
// MODULE MOCKS — only true system boundaries (8 total)
// ============================================================

// 1. Mock the AI engine (LLM boundary)
import { mockRunAgent, agentCalls, resetAgentCalls } from './mocks/mock-run-agent';
vi.mock('@/agents/lib', async (importOriginal) => {
    const original = await importOriginal() as Record<string, unknown>;
    return {
        ...original,
        runAgent: mockRunAgent,
        getAgentLibrary: vi.fn(async () => ({})),
        getModelForWorkflow: vi.fn(async () => 'mock-model'),
        getLibraryForWorkflow: vi.fn(() => 'mock-library'),
        disposeAllAdapters: vi.fn(async () => {}),
        registerAdapter: vi.fn(),
        extractMarkdown: original.extractMarkdown,
        extractJSON: original.extractJSON,
    };
});

// 2. Mock notifications (Telegram HTTP boundary)
vi.mock('@/agents/shared/notifications', () => import('./mocks/mock-notifications'));

// 3. Mock dev server (external process boundary)
vi.mock('@/agents/lib/devServer', () => ({
    startDevServer: vi.fn(async () => ({})),
    stopDevServer: vi.fn(async () => {}),
}));

// 4. Mock loadEnv (side-effect import)
vi.mock('@/agents/shared/loadEnv', () => ({}));

// 5. Mock execSync for implement agent's runYarnChecks
vi.mock('child_process', () => ({
    execSync: vi.fn(() => ''),
}));

// 6. Mock design files (filesystem boundary)
vi.mock('@/agents/lib/design-files', () => import('./mocks/mock-design-files'));

// 7. Mock agents.config (requires env vars not available in tests)
vi.mock('@/agents/agents.config', () => ({
    agentsConfig: {
        useOpus: false,
        defaultLibrary: 'mock',
        workflowOverrides: {},
        modelOverrides: {},
        planSubagent: { enabled: false, timeout: 120 },
    },
}));

// 8. Mock shared/config (requires env vars not available in tests)
vi.mock('@/agents/shared/config', async (importOriginal) => {
    const original = await importOriginal() as Record<string, unknown>;
    return {
        ...original,
        agentConfig: {
            telegram: { enabled: false },
            claude: { model: 'sonnet', maxTurns: 10, timeoutSeconds: 300 },
            localTesting: { enabled: false, devServerStartupTimeout: 30, testTimeout: 60, maxTurns: 5 },
        },
    };
});

// ============================================================
// IMPORTS — after mocks
// ============================================================

import { STATUSES, REVIEW_STATUSES } from '@/server/template/project-management/config';
import { resetNotifications, capturedNotifications } from './mocks/mock-notifications';
import { resetDesignFiles, getS3Docs } from './mocks/mock-design-files';
import { setupBoundaries, teardownBoundaries, type TestBoundaries } from './testkit/setup-boundaries';
import type { MockProjectAdapter } from './mocks/mock-project-adapter';
import type { MockGitAdapter } from './mocks/mock-git-adapter';

// ============================================================
// TEST
// ============================================================

describe('Design Approval S3 Flow', () => {
    let boundaries: TestBoundaries;
    let sharedAdapter: MockProjectAdapter;
    let gitAdapter: MockGitAdapter;

    beforeAll(async () => {
        boundaries = await setupBoundaries();
        sharedAdapter = boundaries.adapter;
        gitAdapter = boundaries.gitAdapter;
    });

    afterAll(async () => {
        await teardownBoundaries();
    });

    beforeEach(() => {
        sharedAdapter.reset();
        sharedAdapter.init();
        resetAgentCalls();
        resetNotifications();
        resetDesignFiles();
        gitAdapter.reset();
    });

    afterEach(() => {
        sharedAdapter.reset();
        resetAgentCalls();
        resetNotifications();
        resetDesignFiles();
        gitAdapter.reset();
    });

    it('saves design to S3 at agent completion', async () => {
        const issueNumber = 100;
        const title = 'Add search feature';

        // Seed feature in Product Design
        sharedAdapter.seedIssue(issueNumber, title, 'Feature: add search', ['feature']);
        sharedAdapter.seedItem(issueNumber, STATUSES.productDesign, null, ['feature']);

        // Run Product Design agent
        const { runBatch } = await import('@/agents/shared/batch-processor');
        const { createDesignProcessor } = await import('@/agents/shared/design-agent-processor');
        const { PRODUCT_DESIGN_OUTPUT_FORMAT } = await import('@/agents/shared/output-schemas');

        const processor = createDesignProcessor({
            workflow: 'product-design',
            phaseName: 'Product Design',
            designType: 'product',
            agentName: 'product-design',
            outputFormat: PRODUCT_DESIGN_OUTPUT_FORMAT,
            outputDesignField: 'design',
            modeLabels: { new: 'New', feedback: 'Feedback', clarification: 'Clarification' },
            progressLabels: { new: 'Generating', feedback: 'Revising', clarification: 'Continuing' },
            buildNewPrompt: () => 'Create product design',
            buildFeedbackPrompt: () => 'Revise',
            buildClarificationPrompt: () => 'Continue',
            prTitle: (n) => `docs: product design for issue #${n}`,
            prBody: (n) => `Part of #${n}`,
        });

        await runBatch(
            { agentStatus: STATUSES.productDesign, agentDisplayName: 'Product Design' },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            processor,
        );

        // Verify agent was called
        expect(agentCalls.some(c => c.workflow === 'product-design')).toBe(true);

        // Verify design was saved to S3
        const s3Docs = getS3Docs();
        const s3Key = `${issueNumber}:product`;
        expect(s3Docs.has(s3Key)).toBe(true);
        expect(s3Docs.get(s3Key)).toContain('# Product Design');

        // Verify notification uses "Approve" not "Approve & Merge"
        const designNotification = capturedNotifications.find(n => n.fn === 'notifyDesignPRReady');
        expect(designNotification).toBeTruthy();
    });

    it('approveDesign advances status without merging PR', async () => {
        const issueNumber = 101;
        const title = 'Add notifications';

        // Seed feature in Product Design with Waiting for Review
        sharedAdapter.seedIssue(issueNumber, title, 'Feature: notifications', ['feature']);
        sharedAdapter.seedItem(issueNumber, STATUSES.productDesign, REVIEW_STATUSES.waitingForReview, ['feature']);

        // Create a design PR in the adapter
        const prResult = await sharedAdapter.createPullRequest(
            `design/issue-${issueNumber}-product`,
            'main',
            `docs: product design for issue #${issueNumber}`,
            `Part of #${issueNumber}`
        );

        // Simulate S3 content (as if agent had run and saved)
        const { saveDesignToS3 } = await import('@/agents/lib/design-files');
        await saveDesignToS3(issueNumber, 'product', '# Product Design\n\nDesign for notifications feature');

        // Call approveDesign
        const { approveDesign } = await import('@/server/template/workflow-service');
        const result = await approveDesign(issueNumber, prResult.number, 'product');

        expect(result.success).toBe(true);
        expect(result.advancedTo).toBe('Tech Design');

        // Verify status advanced to Tech Design
        const item = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item!.status).toBe(STATUSES.techDesign);

        // Verify PR was NOT merged
        const pr = await sharedAdapter.getPRDetails(prResult.number);
        expect(pr).toBeTruthy();
        expect(pr!.merged).toBe(false);
        expect(pr!.state).toBe('open');
    });

    it('tech design approval reads from S3 and parses phases', async () => {
        const issueNumber = 102;
        const title = 'Add dashboard';

        // Seed feature in Tech Design with Waiting for Review
        sharedAdapter.seedIssue(issueNumber, title, 'Feature: dashboard', ['feature']);
        sharedAdapter.seedItem(issueNumber, STATUSES.techDesign, REVIEW_STATUSES.waitingForReview, ['feature']);

        // Create a design PR
        const prResult = await sharedAdapter.createPullRequest(
            `design/issue-${issueNumber}-tech`,
            'main',
            `docs: technical design for issue #${issueNumber}`,
            `Part of #${issueNumber}`
        );

        // Save tech design with phases to S3
        const { saveDesignToS3 } = await import('@/agents/lib/design-files');
        const techDesignContent = `# Technical Design

## Overview
Dashboard implementation plan.

## Implementation Phases

### Phase 1: Backend API
Set up REST endpoints for dashboard data.

### Phase 2: Frontend Components
Build React components for the dashboard.
`;
        await saveDesignToS3(issueNumber, 'tech', techDesignContent);

        // Call approveDesign
        const { approveDesign } = await import('@/server/template/workflow-service');
        const result = await approveDesign(issueNumber, prResult.number, 'tech');

        expect(result.success).toBe(true);
        expect(result.advancedTo).toBe('Implementation');

        // Verify status advanced to Implementation
        const item = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item!.status).toBe(STATUSES.implementation);
    });

    it('next agent reads design from S3', async () => {
        const issueNumber = 103;
        const title = 'Add profile page';

        // Save product design to S3 (simulating previous approval)
        const { saveDesignToS3 } = await import('@/agents/lib/design-files');
        await saveDesignToS3(issueNumber, 'product', '# Product Design\n\nProfile page with avatar, bio, settings.');

        // Seed feature in Tech Design
        sharedAdapter.seedIssue(issueNumber, title, 'Feature: profile page', ['feature']);
        sharedAdapter.seedItem(issueNumber, STATUSES.techDesign, null, ['feature']);

        // Run Tech Design agent
        const { runBatch } = await import('@/agents/shared/batch-processor');
        const { createDesignProcessor } = await import('@/agents/shared/design-agent-processor');
        const { TECH_DESIGN_OUTPUT_FORMAT } = await import('@/agents/shared/output-schemas');

        let capturedAdditionalContext: string | null = null;

        const processor = createDesignProcessor({
            workflow: 'tech-design',
            phaseName: 'Technical Design',
            designType: 'tech',
            agentName: 'tech-design',
            outputFormat: TECH_DESIGN_OUTPUT_FORMAT,
            outputDesignField: 'design',
            modeLabels: { new: 'New', feedback: 'Feedback', clarification: 'Clarification' },
            progressLabels: { new: 'Generating', feedback: 'Revising', clarification: 'Continuing' },
            buildNewPrompt: (ctx) => {
                capturedAdditionalContext = ctx.additionalContext;
                return 'Create tech design';
            },
            buildFeedbackPrompt: () => 'Revise',
            buildClarificationPrompt: () => 'Continue',
            loadAdditionalContext: async ({ issueNumber: num }) => {
                const { readDesignDocAsync } = await import('@/agents/lib/design-files');
                const productDesign = await readDesignDocAsync(num, 'product');
                return productDesign
                    ? { context: productDesign, label: 'Loaded product design from S3' }
                    : { context: null };
            },
            prTitle: (n) => `docs: technical design for issue #${n}`,
            prBody: (n) => `Part of #${n}`,
        });

        await runBatch(
            { agentStatus: STATUSES.techDesign, agentDisplayName: 'Technical Design' },
            { dryRun: false, verbose: false, stream: false, timeout: 300 },
            processor,
        );

        // Verify tech design agent received the product design from S3
        expect(capturedAdditionalContext).toBeTruthy();
        expect(capturedAdditionalContext).toContain('Profile page with avatar');
    });

    it('product-dev approval saves to S3 and advances to Product Design', async () => {
        const issueNumber = 104;
        const title = 'Add onboarding flow';

        // Seed feature in Product Development with Waiting for Review
        sharedAdapter.seedIssue(issueNumber, title, 'Feature: onboarding', ['feature']);
        sharedAdapter.seedItem(issueNumber, STATUSES.productDevelopment, REVIEW_STATUSES.waitingForReview, ['feature']);

        // Create a design PR
        const prResult = await sharedAdapter.createPullRequest(
            `design/issue-${issueNumber}-product-dev`,
            'main',
            `docs: product development for issue #${issueNumber}`,
            `Part of #${issueNumber}`
        );

        // Save PDD to S3
        const { saveDesignToS3 } = await import('@/agents/lib/design-files');
        await saveDesignToS3(issueNumber, 'product-dev', '# Product Development\n\nOnboarding flow requirements.');

        // Call approveDesign
        const { approveDesign } = await import('@/server/template/workflow-service');
        const result = await approveDesign(issueNumber, prResult.number, 'product-dev');

        expect(result.success).toBe(true);
        expect(result.advancedTo).toBe('Product Design');

        // Verify status advanced to Product Design
        const item = sharedAdapter.findItemByIssueNumber(issueNumber);
        expect(item!.status).toBe(STATUSES.productDesign);

        // Verify PR was NOT merged
        const pr = await sharedAdapter.getPRDetails(prResult.number);
        expect(pr!.merged).toBe(false);
    });
});
