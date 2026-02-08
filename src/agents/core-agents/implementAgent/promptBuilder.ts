import {
    getProjectManagementAdapter,
    buildImplementationPrompt,
    buildPRRevisionPrompt,
    buildImplementationClarificationPrompt,
    buildBugImplementationPrompt,
    type GitHubComment,
    type ImplementationPhase,
    type ProjectItem,
} from '../../shared';
import type { ProcessableItem } from './types';

interface PromptBuildResult {
    prompt: string;
    prReviewComments: Array<{ path?: string; line?: number; body: string; author: string }>;
}

/**
 * Build the appropriate prompt based on the processing mode (new/feedback/clarification).
 * Fetches PR comments for feedback mode.
 */
export async function buildPromptForMode(
    processable: ProcessableItem,
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    content: NonNullable<ProjectItem['content']>,
    issueNumber: number,
    issueComments: GitHubComment[],
    productDesign: string | null,
    techDesign: string | null,
    branchName: string,
    diagnostics: Awaited<ReturnType<typeof import('../../shared').getBugDiagnostics>> | null,
): Promise<PromptBuildResult> {
    const { mode } = processable;
    let prompt: string;
    let prReviewComments: Array<{ path?: string; line?: number; body: string; author: string }> = [];

    if (mode === 'new') {
        // Flow A: New implementation
        const branchExistsRemotely = await adapter.branchExists(branchName);
        if (branchExistsRemotely) {
            console.log(`  Branch ${branchName} already exists, will use it`);
        }

        if (diagnostics) {
            // Bug fix implementation
            prompt = buildBugImplementationPrompt(content, diagnostics, productDesign, techDesign, branchName, issueComments);
        } else {
            // Feature implementation
            prompt = buildImplementationPrompt(content, productDesign, techDesign, branchName, issueComments);
        }
    } else if (mode === 'feedback') {
        // Flow B: Address feedback
        if (!processable.prNumber) {
            throw new Error('No PR number available for feedback mode');
        }

        // Fetch PR review comments (inline code comments)
        const prReviewCommentsRaw = await adapter.getPRReviewComments(processable.prNumber);
        prReviewComments = prReviewCommentsRaw.map((c) => ({
            path: c.path,
            line: c.line,
            body: c.body,
            author: c.author,
        }));

        // Fetch PR conversation comments (general comments on the PR)
        const prConversationComments = await adapter.getPRComments(processable.prNumber);
        const prComments: GitHubComment[] = prConversationComments.map((c) => ({
            id: c.id,
            body: c.body,
            author: c.author,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        }));

        const totalFeedback = issueComments.length + prReviewComments.length + prComments.length;
        if (totalFeedback === 0) {
            throw new Error('No feedback comments found');
        }

        console.log(`  Found ${issueComments.length} issue comments, ${prComments.length} PR comments, ${prReviewComments.length} PR review comments`);

        // Combine issue comments and PR comments for the prompt
        const allComments = [...issueComments, ...prComments];
        prompt = buildPRRevisionPrompt(content, productDesign, techDesign, allComments, prReviewComments);
    } else {
        // Flow C: Continue after clarification
        const clarification = issueComments[issueComments.length - 1];

        if (!clarification) {
            throw new Error('No clarification comment found');
        }

        prompt = buildImplementationClarificationPrompt(
            { title: content.title, number: issueNumber, body: content.body },
            productDesign,
            techDesign,
            branchName,
            issueComments,
            clarification
        );
    }

    return { prompt, prReviewComments };
}

/**
 * Append multi-phase context instructions to a prompt.
 */
export function appendPhaseContext(
    prompt: string,
    currentPhase: number,
    totalPhases: number,
    currentPhaseDetails: ImplementationPhase,
): string {
    const phaseContext = `

## IMPORTANT: Multi-Phase Implementation

This is **Phase ${currentPhase} of ${totalPhases}**: ${currentPhaseDetails.name}

**Phase Description:** ${currentPhaseDetails.description}

**Files for this phase:**
${currentPhaseDetails.files.map(f => `- ${f}`).join('\n')}

**CRITICAL Instructions:**
1. ONLY implement what's described for Phase ${currentPhase}
2. Do NOT implement features from later phases
3. Each phase will be a separate PR that gets reviewed and merged
4. Make sure this phase is independently mergeable and testable
5. Future phases will build on top of this work

${currentPhase > 1 ? `\n**Note:** This builds on previous phases that have already been merged.` : ''}
`;
    return prompt + phaseContext;
}

/**
 * Append local testing instructions to a prompt after the dev server starts.
 */
export function appendLocalTestingContext(prompt: string, devServerUrl: string): string {
    const localTestContext = `

## LOCAL TESTING (Optional but Recommended)

A dev server is running at: **${devServerUrl}**

After implementing the feature and running \`yarn checks\`, try to verify your implementation using Playwright MCP tools if they are available:

1. **Navigate to the app**: Use \`mcp__playwright__browser_navigate\` to go to ${devServerUrl}
2. **Take a snapshot**: Use \`mcp__playwright__browser_snapshot\` to see the page structure
3. **Test the feature**: Interact with the feature you implemented
4. **Verify it works**: Confirm the expected behavior occurs
5. **Close browser**: Use \`mcp__playwright__browser_close\` when done

**Playwright MCP Tools (if available):**
- \`mcp__playwright__browser_navigate\` - Navigate to URLs
- \`mcp__playwright__browser_snapshot\` - Capture page DOM/accessibility tree
- \`mcp__playwright__browser_click\` - Click elements
- \`mcp__playwright__browser_type\` - Type text into inputs
- \`mcp__playwright__browser_close\` - Close browser

**IMPORTANT:**
- The dev server is already running - do NOT run \`yarn dev\`
- The browser runs in headless mode (no visible window)
- Focus on happy-path verification only
- **If MCP tools fail or are unavailable, proceed without local testing** - this is not a blocker
- If you can test and it passes, include test results in your PR summary
- If you cannot test (tools unavailable), mention that in PR summary
`;
    return prompt + localTestContext;
}
