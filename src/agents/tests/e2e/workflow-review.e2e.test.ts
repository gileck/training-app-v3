/**
 * Workflow Review Agent E2E Test
 *
 * Tests the workflow review pipeline: picks up Done items, analyzes logs via LLM,
 * stores review data, appends log section, creates improvement issues, sends notifications.
 *
 * Boundary-only mocks (9 total):
 * - LLM (runAgent), Telegram (notifications), dev server, loadEnv,
 *   child_process, design-files, agents.config, shared/config, fs
 *
 * Real code: workflow-items DB (in-memory MongoDB), output parsing,
 * review formatting, notification calls
 */

import { vi, describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

// ============================================================
// MODULE MOCKS — only true system boundaries (9 total)
// ============================================================

// 1. Mock the AI engine (LLM boundary)
import { mockRunAgent, agentCalls, resetAgentCalls, pushAgentResponse, resetAgentOverrides } from './mocks/mock-run-agent';
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

// 5. Mock child_process — spawnSync used by workflowReviewAgent for `yarn agent-workflow create`
const mockSpawnSync = vi.fn(() => ({
    status: 0,
    stdout: 'Created workflow item',
    stderr: '',
    pid: 12345,
    output: ['', 'Created workflow item', ''],
    signal: null,
}));
vi.mock('child_process', () => ({
    execSync: vi.fn(() => ''),
    spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
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

// 9. Mock fs — workflowReviewAgent reads/writes log files directly
let mockLogFileContent = '';
let mockLogFileExists = false;
const appendedContent: string[] = [];

vi.mock('fs', async (importOriginal) => {
    const original = await importOriginal() as Record<string, unknown>;
    return {
        ...original,
        existsSync: (filePath: string) => {
            if (typeof filePath === 'string' && filePath.includes('agent-logs/issue-')) {
                return mockLogFileExists;
            }
            // Delegate to original for other paths
            return (original.existsSync as (p: string) => boolean)(filePath);
        },
        statSync: (filePath: string) => {
            if (typeof filePath === 'string' && filePath.includes('agent-logs/issue-')) {
                return { size: Buffer.byteLength(mockLogFileContent, 'utf-8') };
            }
            return (original.statSync as (p: string) => unknown)(filePath);
        },
        openSync: (filePath: string) => {
            if (typeof filePath === 'string' && filePath.includes('agent-logs/issue-')) {
                return 999; // fake fd
            }
            return (original.openSync as (...a: unknown[]) => number)(filePath);
        },
        readSync: (fd: number, buffer: Buffer, offset: number, length: number) => {
            if (fd === 999) {
                const content = Buffer.from(mockLogFileContent, 'utf-8');
                const bytesToRead = Math.min(length, content.length);
                const start = Math.max(0, content.length - bytesToRead);
                content.copy(buffer, offset, start, start + bytesToRead);
                return bytesToRead;
            }
            return (original.readSync as (...a: unknown[]) => number)(fd, buffer, offset, length);
        },
        closeSync: (fd: number) => {
            if (fd === 999) return;
            return (original.closeSync as (fd: number) => void)(fd);
        },
        appendFileSync: (filePath: string, data: string) => {
            if (typeof filePath === 'string' && filePath.includes('agent-logs/issue-')) {
                appendedContent.push(data);
                mockLogFileContent += data;
                return;
            }
            return (original.appendFileSync as (...a: unknown[]) => void)(filePath, data);
        },
    };
});

// ============================================================
// IMPORTS — after mocks
// ============================================================

import { capturedNotifications, resetNotifications } from './mocks/mock-notifications';
import { resetDesignFiles } from './mocks/mock-design-files';
import { setupBoundaries, teardownBoundaries, type TestBoundaries } from './testkit/setup-boundaries';
import { createWorkflowItem, findAllWorkflowItems } from '@/server/database/collections/template/workflow-items/workflow-items';
import type { WorkflowReviewOutput } from '@/agents/shared/output-schemas';

// ============================================================
// HELPERS
// ============================================================

function createMockWorkflowReviewOutput(issueNumber: number): WorkflowReviewOutput {
    return {
        findings: [
            {
                type: 'improvement',
                severity: 'medium',
                priority: 'medium',
                size: 'S',
                complexity: 'Low',
                title: 'Redundant file reads in implementation phase',
                description: 'The implementation agent reads src/core.ts three times within a single phase. This wastes tokens and increases cost.',
                category: 'efficiency',
                relatedIssue: issueNumber,
                affectedFiles: ['src/agents/core-agents/implementAgent/index.ts'],
            },
            {
                type: 'bug',
                severity: 'high',
                priority: 'high',
                size: 'M',
                complexity: 'Medium',
                title: 'Missing error handling in PR review agent',
                description: 'The PR review agent does not handle the case where the PR has been closed between scheduling and execution.',
                category: 'error',
                relatedIssue: issueNumber,
                affectedFiles: ['src/agents/core-agents/prReviewAgent/index.ts'],
            },
        ],
        executiveSummary: {
            status: 'completed',
            totalCost: '$1.25',
            duration: '15m 30s',
            overallAssessment: 'Workflow completed successfully with minor efficiency issues.',
        },
        systemicImprovements: [
            {
                type: 'doc_update',
                targetFile: 'docs/template/github-agents-workflow/running-agents.md',
                recommendation: 'Add documentation about file read deduplication across phases.',
            },
        ],
    };
}

// ============================================================
// TEST
// ============================================================

describe('Workflow Review Agent', () => {
    let boundaries: TestBoundaries;

    beforeAll(async () => {
        boundaries = await setupBoundaries();
    });

    afterAll(async () => {
        await teardownBoundaries();
    });

    beforeEach(() => {
        boundaries.adapter.reset();
        boundaries.adapter.init();
        boundaries.gitAdapter.reset();
        resetAgentCalls();
        resetAgentOverrides();
        resetNotifications();
        resetDesignFiles();
        mockSpawnSync.mockClear();

        // Reset fs mock state
        mockLogFileContent = '';
        mockLogFileExists = false;
        appendedContent.length = 0;
    });

    afterEach(() => {
        boundaries.adapter.reset();
        boundaries.gitAdapter.reset();
        resetAgentCalls();
        resetAgentOverrides();
        resetNotifications();
        resetDesignFiles();
        mockSpawnSync.mockClear();
        mockLogFileContent = '';
        mockLogFileExists = false;
        appendedContent.length = 0;
    });

    it('reviews a Done workflow item: updates DB, appends log, creates findings, sends notification', async () => {
        const issueNumber = 500;
        const title = 'Add search feature';

        // 1. Create a workflow item in Done status (via real MongoDB)
        const now = new Date();
        await createWorkflowItem({
            type: 'feature',
            title,
            description: 'Implement a search feature for the app',
            status: 'Done',
            githubIssueNumber: issueNumber,
            githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
            githubIssueTitle: title,
            labels: ['feature'],
            reviewed: false,
            createdAt: now,
            updatedAt: now,
        });

        // 2. Set up mock log file
        mockLogFileExists = true;
        mockLogFileContent = [
            `# Agent Log: Issue #${issueNumber}`,
            '',
            '## [LOG:PHASE_START] Product Design',
            'Started product design phase...',
            '## [LOG:PHASE_END] Product Design',
            '',
            '## [LOG:PHASE_START] Implementation',
            'Started implementation phase...',
            '## [LOG:PHASE_END] Implementation',
            '',
            '[LOG:TOKENS] Total: 5000 input, 2000 output, $1.25',
        ].join('\n');

        // 3. Push workflow-review agent response
        const reviewOutput = createMockWorkflowReviewOutput(issueNumber);
        pushAgentResponse('workflow-review', reviewOutput);

        // 4. Run the workflow review agent
        const { processItem } = await import('@/agents/core-agents/workflowReviewAgent');

        // Fetch the item from DB
        const doneItems = await findAllWorkflowItems({ status: 'Done' });
        const itemToReview = doneItems.find(
            item => item.githubIssueNumber === issueNumber && item.reviewed !== true
        );
        expect(itemToReview).toBeTruthy();

        const result = await processItem(itemToReview!, {
            dryRun: false,
            verbose: false,
            stream: false,
            timeout: 300,
        });

        // 5. Assert: processItem succeeded
        expect(result.success).toBe(true);
        expect(result.findingsCount).toBe(2);

        // 6. Assert: runAgent was called with workflow 'workflow-review'
        expect(agentCalls.some(c => c.workflow === 'workflow-review')).toBe(true);
        const reviewCall = agentCalls.find(c => c.workflow === 'workflow-review');
        expect(reviewCall).toBeTruthy();
        expect(reviewCall!.allowedTools).toEqual(['Read', 'Grep', 'Glob']);

        // 7. Assert: reviewed field set to true and reviewSummary stored in DB
        const updatedItems = await findAllWorkflowItems({ status: 'Done' });
        const reviewedItem = updatedItems.find(item => item.githubIssueNumber === issueNumber);
        expect(reviewedItem).toBeTruthy();
        expect(reviewedItem!.reviewed).toBe(true);
        expect(reviewedItem!.reviewSummary).toBe(
            'Workflow completed successfully with minor efficiency issues.'
        );

        // 8. Assert: [LOG:REVIEW] section appended to log file
        expect(appendedContent.length).toBe(1);
        const appendedSection = appendedContent[0];
        expect(appendedSection).toContain('[LOG:REVIEW]');
        expect(appendedSection).toContain('Executive Summary');
        expect(appendedSection).toContain('Workflow completed successfully');
        expect(appendedSection).toContain('Findings (2)');
        expect(appendedSection).toContain('Redundant file reads');
        expect(appendedSection).toContain('Missing error handling');
        expect(appendedSection).toContain('Systemic Improvements');

        // 9. Assert: yarn agent-workflow create called for each finding
        expect(mockSpawnSync).toHaveBeenCalledTimes(2);

        // Verify first finding's create call
        const firstCall = mockSpawnSync.mock.calls[0];
        expect(firstCall[0]).toBe('yarn');
        const firstArgs = firstCall[1] as string[];
        expect(firstArgs).toContain('agent-workflow');
        expect(firstArgs).toContain('create');
        expect(firstArgs).toContain('--type');
        expect(firstArgs).toContain('feature'); // 'improvement' type maps to 'feature'
        expect(firstArgs).toContain('--title');
        expect(firstArgs).toContain('Redundant file reads in implementation phase');
        expect(firstArgs).toContain('--priority');
        expect(firstArgs).toContain('medium');
        expect(firstArgs).toContain('--size');
        expect(firstArgs).toContain('S');
        expect(firstArgs).toContain('--complexity');
        expect(firstArgs).toContain('Low');
        expect(firstArgs).toContain('--created-by');
        expect(firstArgs).toContain('workflow-review');

        // Verify second finding's create call
        const secondCall = mockSpawnSync.mock.calls[1];
        const secondArgs = secondCall[1] as string[];
        expect(secondArgs).toContain('--type');
        expect(secondArgs).toContain('bug'); // 'bug' type stays as 'bug'
        expect(secondArgs).toContain('Missing error handling in PR review agent');
        expect(secondArgs).toContain('--priority');
        expect(secondArgs).toContain('high');

        // 10. Assert: Telegram notification sent
        const reviewNotification = capturedNotifications.find(
            n => n.fn === 'notifyWorkflowReviewComplete'
        );
        expect(reviewNotification).toBeTruthy();
        expect(reviewNotification!.args[0]).toBe(title);
        expect(reviewNotification!.args[1]).toBe(issueNumber);
        expect(reviewNotification!.args[2]).toBe(
            'Workflow completed successfully with minor efficiency issues.'
        );
        expect(reviewNotification!.args[3]).toBe(2); // findingsCount
    });

    it('skips items without log files', async () => {
        const issueNumber = 501;
        const title = 'Feature without log file';

        // Create Done item in DB
        const now = new Date();
        await createWorkflowItem({
            type: 'feature',
            title,
            description: 'A feature that has no log file',
            status: 'Done',
            githubIssueNumber: issueNumber,
            githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
            githubIssueTitle: title,
            labels: ['feature'],
            reviewed: false,
            createdAt: now,
            updatedAt: now,
        });

        // Log file does NOT exist
        mockLogFileExists = false;

        const { processItem } = await import('@/agents/core-agents/workflowReviewAgent');

        const doneItems = await findAllWorkflowItems({ status: 'Done' });
        const itemToReview = doneItems.find(
            item => item.githubIssueNumber === issueNumber
        );
        expect(itemToReview).toBeTruthy();

        const result = await processItem(itemToReview!, {
            dryRun: false,
            verbose: false,
            stream: false,
            timeout: 300,
        });

        // Should return failure (skipped) with no findings
        expect(result.success).toBe(false);
        expect(result.findingsCount).toBe(0);

        // No agent calls
        expect(agentCalls.length).toBe(0);

        // No notifications
        expect(capturedNotifications.length).toBe(0);
    });

    it('skips items with existing [LOG:REVIEW] marker and marks as reviewed in DB', async () => {
        const issueNumber = 502;
        const title = 'Already reviewed feature';

        // Create Done item in DB
        const now = new Date();
        await createWorkflowItem({
            type: 'feature',
            title,
            description: 'A feature already reviewed',
            status: 'Done',
            githubIssueNumber: issueNumber,
            githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
            githubIssueTitle: title,
            labels: ['feature'],
            reviewed: false,
            createdAt: now,
            updatedAt: now,
        });

        // Log file exists and already has review marker
        mockLogFileExists = true;
        mockLogFileContent = [
            `# Agent Log: Issue #${issueNumber}`,
            '',
            '## [LOG:REVIEW] Issue Review',
            'Already reviewed content here...',
        ].join('\n');

        const { processItem } = await import('@/agents/core-agents/workflowReviewAgent');

        const doneItems = await findAllWorkflowItems({ status: 'Done' });
        const itemToReview = doneItems.find(
            item => item.githubIssueNumber === issueNumber
        );
        expect(itemToReview).toBeTruthy();

        const result = await processItem(itemToReview!, {
            dryRun: false,
            verbose: false,
            stream: false,
            timeout: 300,
        });

        // Should succeed (marker found, marked as reviewed)
        expect(result.success).toBe(true);
        expect(result.findingsCount).toBe(0);

        // No agent calls — skipped
        expect(agentCalls.length).toBe(0);

        // DB should be updated
        const updatedItems = await findAllWorkflowItems({ status: 'Done' });
        const reviewedItem = updatedItems.find(
            item => item.githubIssueNumber === issueNumber
        );
        expect(reviewedItem!.reviewed).toBe(true);
        expect(reviewedItem!.reviewSummary).toBe('Previously reviewed (marker found in log)');
    });

    it('handles zero findings gracefully', async () => {
        const issueNumber = 503;
        const title = 'Clean workflow run';

        const now = new Date();
        await createWorkflowItem({
            type: 'bug',
            title,
            description: 'A bug fix that went smoothly',
            status: 'Done',
            githubIssueNumber: issueNumber,
            githubIssueUrl: `https://github.com/test/repo/issues/${issueNumber}`,
            githubIssueTitle: title,
            labels: ['bug'],
            reviewed: false,
            createdAt: now,
            updatedAt: now,
        });

        mockLogFileExists = true;
        mockLogFileContent = `# Agent Log: Issue #${issueNumber}\n\nClean run with no issues.\n`;

        // Push a review output with no findings
        pushAgentResponse('workflow-review', {
            findings: [],
            executiveSummary: {
                status: 'completed',
                totalCost: '$0.50',
                duration: '5m',
                overallAssessment: 'Clean execution with no issues found.',
            },
            systemicImprovements: [],
        } satisfies WorkflowReviewOutput);

        const { processItem } = await import('@/agents/core-agents/workflowReviewAgent');

        const doneItems = await findAllWorkflowItems({ status: 'Done' });
        const itemToReview = doneItems.find(
            item => item.githubIssueNumber === issueNumber
        );

        const result = await processItem(itemToReview!, {
            dryRun: false,
            verbose: false,
            stream: false,
            timeout: 300,
        });

        expect(result.success).toBe(true);
        expect(result.findingsCount).toBe(0);

        // No spawnSync calls — no findings to create
        expect(mockSpawnSync).not.toHaveBeenCalled();

        // DB should still be updated
        const updatedItems = await findAllWorkflowItems({ status: 'Done' });
        const reviewedItem = updatedItems.find(
            item => item.githubIssueNumber === issueNumber
        );
        expect(reviewedItem!.reviewed).toBe(true);

        // Notification still sent
        const reviewNotification = capturedNotifications.find(
            n => n.fn === 'notifyWorkflowReviewComplete'
        );
        expect(reviewNotification).toBeTruthy();

        // Log section still appended
        expect(appendedContent.length).toBe(1);
        expect(appendedContent[0]).toContain('[LOG:REVIEW]');
        expect(appendedContent[0]).toContain('Findings (0)');
    });
});
