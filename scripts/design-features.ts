#!/usr/bin/env tsx
/**
 * Feature Design CLI Script
 *
 * Automatically generates Product Design and Technical Design documents
 * for feature requests using Claude Code SDK.
 *
 * Prerequisites:
 *   - Claude Code CLI installed and authenticated (run `claude login`)
 *
 * Usage:
 *   yarn design-features                    # Process all pending design tasks
 *   yarn design-features --phase product    # Only product design phase
 *   yarn design-features --phase tech       # Only technical design phase
 *   yarn design-features --id <id>          # Process specific feature request
 *   yarn design-features --limit 5          # Limit to 5 requests
 *   yarn design-features --timeout 300      # Set timeout to 5 minutes (default: 600s)
 *   yarn design-features --dry-run          # Don't save results
 *   yarn design-features --stream           # Stream Claude's full thinking in real-time
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { query, type SDKAssistantMessage, type SDKResultMessage, type SDKToolProgressMessage } from '@anthropic-ai/claude-agent-sdk';
import type { FeatureRequestDocument, DesignPhaseType } from '../src/server/database/collections/feature-requests/types';

// ============================================================
// CONFIGURATION
// ============================================================
const MODEL = 'sonnet';
const MAX_TURNS = 100;
const DEFAULT_TIMEOUT_SECONDS = 600; // 10 minutes
const PROJECT_ROOT = process.cwd();

// ============================================================
// TYPES
// ============================================================
interface DesignOutput {
    content: string;
    userStories?: string[];
    keyDecisions?: string[];
}

interface CLIOptions {
    id?: string;
    phase?: 'product' | 'tech';
    limit?: number;
    timeout: number;
    dryRun: boolean;
    verbose: boolean;
    stream: boolean;
}

// ============================================================
// DATABASE CONNECTION
// ============================================================

// Load environment variables
function loadEnv(): void {
    const envPath = path.join(PROJECT_ROOT, '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const match = line.match(/^([^=]+)=["']?(.+?)["']?$/);
            if (match && !process.env[match[1]]) {
                process.env[match[1]] = match[2];
            }
        }
    }

    const envLocalPath = path.join(PROJECT_ROOT, '.env.local');
    if (fs.existsSync(envLocalPath)) {
        const content = fs.readFileSync(envLocalPath, 'utf-8');
        for (const line of content.split('\n')) {
            const match = line.match(/^([^=]+)=["']?(.+?)["']?$/);
            if (match) {
                process.env[match[1]] = match[2];
            }
        }
    }
}

// Dynamic import for database (ESM compatibility)
async function getDatabase() {
    const { featureRequests, closeDbConnection } = await import('../src/server/database');
    return { featureRequests, closeDbConnection };
}

// Dynamic import for telegram
async function getTelegram() {
    const { sendNotificationToOwner } = await import('../src/server/telegram');
    return { sendNotificationToOwner };
}

// ============================================================
// PROMPT BUILDING
// ============================================================

function buildProductDesignPrompt(request: FeatureRequestDocument): string {
    const previousFeedback = request.productDesign?.adminComments
        ? `\n## Previous Feedback from Admin\n\nThe admin rejected the previous design with these comments:\n\n"${request.productDesign.adminComments}"\n\nPlease address this feedback in your revised design.\n`
        : '';

    const iteration = request.productDesign?.iterations || 0;
    const iterationNote = iteration > 0
        ? `\n**Note:** This is iteration ${iteration + 1}. Address the admin's feedback and improve upon the previous design.\n`
        : '';

    return `You are creating a Product Design document for a feature request. Your task is to:
1. Understand the feature from the user's description
2. Explore the codebase to understand existing patterns and architecture
3. Create a comprehensive Product Design document

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Feature Request Details

**Title:** ${request.title}
**Description:** ${request.description}
**Related Page/Area:** ${request.page || 'Not specified'}
**Requested By:** User ID ${request.requestedBy}
**Created At:** ${request.createdAt.toISOString()}
${iterationNote}${previousFeedback}

## Your Task

Create a Product Design document that covers:

1. **Overview** - Brief summary of what this feature does and why it's needed
2. **User Stories** - Who uses this and what they want to achieve
   - Format: "As a [user type], I want to [action] so that [benefit]"
3. **UI/UX Design** - How the feature will look and behave
   - Describe the interface elements
   - User flow and interactions
   - Consider mobile/responsive needs
4. **Edge Cases** - What happens when things go wrong?
   - Empty states
   - Error handling
   - Loading states
   - Permission/auth considerations
5. **Success Criteria** - How do we know this feature is complete?
   - Measurable outcomes
   - Acceptance criteria

## Research Strategy

Before writing the design, explore the codebase:
1. Read \`src/client/routes/index.ts\` to understand the routing structure
2. If a page is mentioned, find and read that component
3. Look at similar existing features for patterns
4. Check relevant types in \`src/apis/\` if the feature needs API work

## Output Format

Your final output MUST be a complete Product Design document in markdown format, wrapped in a \`\`\`markdown code block.

The document should be professional, clear, and actionable. Admin will review this before proceeding to Technical Design.

Example structure:

\`\`\`markdown
# Product Design: [Feature Title]

## Overview
[1-2 paragraph summary]

## User Stories

### Primary User
- As a user, I want to...

### Admin (if applicable)
- As an admin, I want to...

## UI/UX Design

### Layout
[Description of the interface]

### User Flow
1. User navigates to...
2. User clicks...
3. System shows...

### Mobile Considerations
[Responsive design notes]

## Edge Cases

### Empty State
[What to show when there's no data]

### Error Handling
[How to handle failures]

### Loading States
[What to show while loading]

## Success Criteria
- [ ] User can...
- [ ] System handles...
- [ ] Feature integrates with...
\`\`\`

Now explore the codebase and create the Product Design document.`;
}

function buildTechDesignPrompt(request: FeatureRequestDocument): string {
    const productDesign = request.productDesign?.content || 'No product design available';

    const previousFeedback = request.techDesign?.adminComments
        ? `\n## Previous Feedback from Admin\n\nThe admin rejected the previous design with these comments:\n\n"${request.techDesign.adminComments}"\n\nPlease address this feedback in your revised design.\n`
        : '';

    const iteration = request.techDesign?.iterations || 0;
    const iterationNote = iteration > 0
        ? `\n**Note:** This is iteration ${iteration + 1}. Address the admin's feedback and improve upon the previous design.\n`
        : '';

    return `You are creating a Technical Design document for a feature request. The Product Design has been approved, and now you need to define the technical implementation.

IMPORTANT: You are in READ-ONLY mode. Do NOT make any changes to files. Only use Read, Glob, Grep, and WebFetch tools.

## Feature Request Details

**Title:** ${request.title}
**Description:** ${request.description}
**Related Page/Area:** ${request.page || 'Not specified'}
${iterationNote}${previousFeedback}

## Approved Product Design

${productDesign}

## Your Task

Create a Technical Design document that covers:

1. **Architecture Overview** - High-level approach
2. **Files to Create/Modify** - Specific files and what changes
3. **Data Model** - Database schema changes (if any)
4. **API Changes** - New endpoints or modifications
5. **State Management** - Client-side state considerations
6. **Migration/Compatibility** - Any migration needs
7. **Testing Strategy** - How to test this feature

## Research Strategy

Explore the codebase thoroughly:
1. Read existing similar features to understand patterns
2. Check \`src/apis/\` for API patterns
3. Check \`src/server/database/collections/\` for database patterns
4. Look at \`src/client/routes/\` for component patterns
5. Review hooks and stores patterns

## Output Format

Your final output MUST be a complete Technical Design document in markdown format, wrapped in a \`\`\`markdown code block.

Example structure:

\`\`\`markdown
# Technical Design: [Feature Title]

## Architecture Overview
[High-level approach and key decisions]

## Files to Create

### New Files
| File | Purpose |
|------|---------|
| \`src/apis/feature-name/...\` | API layer |
| \`src/client/routes/FeatureName/...\` | UI components |

### Files to Modify
| File | Changes |
|------|---------|
| \`src/client/routes/index.ts\` | Add new route |
| \`src/client/components/NavLinks.tsx\` | Add nav item |

## Data Model

### New Collection (if applicable)
\`\`\`typescript
interface FeatureDocument {
  _id: ObjectId;
  // fields...
}
\`\`\`

## API Endpoints

### Create Feature
- **Endpoint:** \`feature-name/create\`
- **Method:** POST
- **Auth:** Required
- **Request:** \`{ title: string, ... }\`
- **Response:** \`{ feature: Feature }\`

## State Management

### Server State (React Query)
- Query key: \`['features']\`
- Mutations with optimistic updates

### Client State (Zustand)
[If applicable]

## Implementation Order
1. Database layer
2. API layer
3. Client hooks
4. UI components
5. Navigation updates

## Testing Strategy
- Unit tests for...
- Integration tests for...
\`\`\`

Now explore the codebase and create the Technical Design document.`;
}

// ============================================================
// PROGRESS INDICATOR
// ============================================================

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ============================================================
// CLAUDE CODE SDK EXECUTION
// ============================================================

interface UsageStats {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    totalCostUSD: number;
}

async function runDesignGeneration(
    prompt: string,
    options: { verbose: boolean; stream: boolean; timeout: number }
): Promise<{ result: string; filesExamined: string[]; usage: UsageStats | null }> {
    const startTime = Date.now();
    let lastResult = '';
    let toolCallCount = 0;
    const filesExamined: string[] = [];
    let usage: UsageStats | null = null;

    let spinnerInterval: NodeJS.Timeout | null = null;
    let spinnerFrame = 0;

    // Set up timeout abort controller
    const abortController = new AbortController();
    const timeoutMs = options.timeout * 1000;
    const timeoutId = setTimeout(() => {
        abortController.abort();
    }, timeoutMs);

    if (!options.stream) {
        spinnerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
            const timeoutInfo = options.timeout > 0 ? `/${options.timeout}s` : '';
            process.stdout.write(`\r  ${frame} Generating design... (${elapsed}s${timeoutInfo}, ${toolCallCount} tools)\x1b[K`);
            spinnerFrame++;
        }, 100);
    }

    try {
        for await (const message of query({
            prompt,
            options: {
                allowedTools: ['Read', 'Glob', 'Grep', 'WebFetch'],
                cwd: PROJECT_ROOT,
                model: MODEL,
                maxTurns: MAX_TURNS,
                permissionMode: 'bypassPermissions',
                allowDangerouslySkipPermissions: true,
                abortController,
            },
        })) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);

            // Handle assistant messages
            if (message.type === 'assistant') {
                const assistantMsg = message as SDKAssistantMessage;
                // Extract text content from the message
                const textParts: string[] = [];
                for (const block of assistantMsg.message.content) {
                    if (block.type === 'text') {
                        textParts.push((block as { type: 'text'; text: string }).text);
                    }
                }
                const textContent = textParts.join('\n');

                if (textContent && options.stream) {
                    const lines = textContent.split('\n').filter((l: string) => l.trim());
                    for (const line of lines) {
                        console.log(`    \x1b[90m${line}\x1b[0m`);
                    }
                }

                // Track tool uses within assistant message
                for (const block of assistantMsg.message.content) {
                    if (block.type === 'tool_use') {
                        toolCallCount++;
                        const toolUse = block as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
                        const toolName = toolUse.name;
                        const toolInput = toolUse.input;

                        if (toolName === 'Read' && toolInput?.file_path) {
                            const filePath = String(toolInput.file_path).replace(PROJECT_ROOT + '/', '');
                            if (!filesExamined.includes(filePath)) {
                                filesExamined.push(filePath);
                            }
                        }

                        if (options.stream) {
                            let target = '';
                            if (toolInput) {
                                if (toolInput.file_path) {
                                    target = ` → ${String(toolInput.file_path).split('/').slice(-2).join('/')}`;
                                } else if (toolInput.pattern) {
                                    target = ` → "${toolInput.pattern}"`;
                                }
                            }
                            console.log(`  \x1b[36m[${elapsed}s] Tool: ${toolName}${target}\x1b[0m`);
                        }
                    }
                }

                // Keep track of last text content
                if (textContent) {
                    lastResult = textContent;
                }
            }

            // Handle tool progress (shows when tool is running)
            if (message.type === 'tool_progress') {
                const progressMsg = message as SDKToolProgressMessage;
                if (options.stream && options.verbose) {
                    console.log(`  \x1b[33m[${elapsed}s] Running ${progressMsg.tool_name}...\x1b[0m`);
                }
            }

            // Handle final result
            if (message.type === 'result') {
                const resultMsg = message as SDKResultMessage;
                if (resultMsg.subtype === 'success' && resultMsg.result) {
                    lastResult = resultMsg.result;
                }
                // Extract usage stats
                if (resultMsg.usage) {
                    usage = {
                        inputTokens: resultMsg.usage.input_tokens ?? 0,
                        outputTokens: resultMsg.usage.output_tokens ?? 0,
                        cacheReadInputTokens: resultMsg.usage.cache_read_input_tokens ?? 0,
                        cacheCreationInputTokens: resultMsg.usage.cache_creation_input_tokens ?? 0,
                        totalCostUSD: resultMsg.total_cost_usd ?? 0,
                    };
                }
            }
        }

        clearTimeout(timeoutId);
        if (spinnerInterval) clearInterval(spinnerInterval);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        // Format usage info for display
        let usageInfo = '';
        if (usage) {
            const totalTokens = usage.inputTokens + usage.outputTokens;
            usageInfo = `, ${totalTokens.toLocaleString()} tokens, $${usage.totalCostUSD.toFixed(4)}`;
        }
        console.log(`\r  \x1b[32m✓ Design generation complete (${elapsed}s, ${toolCallCount} tool calls${usageInfo})\x1b[0m\x1b[K`);

        return { result: lastResult, filesExamined, usage };
    } catch (error) {
        clearTimeout(timeoutId);
        if (spinnerInterval) clearInterval(spinnerInterval);

        // Check if it was a timeout
        if (abortController.signal.aborted) {
            console.log(`\r  \x1b[31m✗ Timeout after ${options.timeout}s\x1b[0m\x1b[K`);
            throw new Error(`Design generation timed out after ${options.timeout} seconds`);
        }

        console.log(`\r  \x1b[31m✗ Error\x1b[0m\x1b[K`);
        throw error;
    }
}

// ============================================================
// DESIGN GENERATION LOGIC
// ============================================================

async function generateDesign(
    request: FeatureRequestDocument,
    phase: DesignPhaseType,
    options: CLIOptions
): Promise<{ content: string | null; usage: UsageStats | null }> {
    const prompt = phase === 'product'
        ? buildProductDesignPrompt(request)
        : buildTechDesignPrompt(request);

    if (options.verbose && !options.stream) {
        console.log('\n--- Design Prompt (truncated) ---');
        console.log(prompt.slice(0, 500) + '...');
        console.log('---------------------------------\n');
    }

    try {
        console.log(''); // New line before spinner
        const { result, filesExamined, usage } = await runDesignGeneration(prompt, {
            verbose: options.verbose,
            stream: options.stream,
            timeout: options.timeout,
        });

        if (options.verbose) {
            console.log('\n--- Claude Output (last 2000 chars) ---');
            console.log(result.slice(-2000));
            console.log('---------------------------------------\n');
            console.log(`  Files examined: ${filesExamined.length}`);
        }

        // Extract the markdown content from the output
        const content = parseDesignOutput(result);

        if (!content) {
            console.warn('  Could not extract design document from output');
            return { content: null, usage };
        }

        return { content, usage };
    } catch (error) {
        console.error('  Design generation error:', error instanceof Error ? error.message : error);
        return { content: null, usage: null };
    }
}

function parseDesignOutput(text: string): string | null {
    if (!text) return null;

    try {
        // Try to find markdown block in the text
        // Look for ```markdown ... ``` pattern first
        const markdownBlockMatch = text.match(/```markdown\s*([\s\S]*?)\s*```/);
        if (markdownBlockMatch?.[1]) {
            return markdownBlockMatch[1].trim();
        }

        // Try plain ``` blocks (might not have markdown specifier)
        const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch?.[1]) {
            // Check if it looks like a design document
            const content = codeBlockMatch[1].trim();
            if (content.includes('# ') && (content.includes('Overview') || content.includes('Design'))) {
                return content;
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

// ============================================================
// MAIN CLI
// ============================================================

async function main(): Promise<void> {
    const program = new Command();

    program
        .name('design-features')
        .description('Automatically generate Product/Technical Design documents using Claude Code SDK')
        .option('--id <requestId>', 'Process a specific feature request by ID')
        .option('--phase <phase>', 'Only process specific phase: product or tech')
        .option('--limit <number>', 'Limit number of requests to process', parseInt)
        .option('--timeout <seconds>', 'Timeout per design generation in seconds (default: 600)', parseInt)
        .option('--dry-run', 'Run without saving results to database', false)
        .option('--stream', "Stream Claude's full thinking and tool calls in real-time", false)
        .option('--verbose', 'Show additional debug output (prompt, final result, tool progress)', false)
        .parse(process.argv);

    const opts = program.opts();
    const options: CLIOptions = {
        id: opts.id as string | undefined,
        phase: opts.phase as 'product' | 'tech' | undefined,
        limit: opts.limit as number | undefined,
        timeout: (opts.timeout as number | undefined) ?? DEFAULT_TIMEOUT_SECONDS,
        dryRun: Boolean(opts.dryRun),
        verbose: Boolean(opts.verbose),
        stream: Boolean(opts.stream),
    };

    // Validate phase option
    if (options.phase && !['product', 'tech'].includes(options.phase)) {
        console.error('Error: --phase must be "product" or "tech"');
        process.exit(1);
    }

    console.log('\n========================================');
    console.log('  Feature Design Agent');
    console.log('========================================');
    console.log(`  Timeout: ${options.timeout}s per request`);
    if (options.phase) {
        console.log(`  Phase filter: ${options.phase} design only`);
    }
    console.log('');

    // Load environment
    loadEnv();

    if (!process.env.MONGO_URI) {
        console.error('Error: MONGO_URI environment variable is not set.');
        console.error('Please ensure your .env or .env.local file contains MONGO_URI.');
        process.exit(1);
    }

    // Connect to database
    console.log('Connecting to database...');
    const { featureRequests, closeDbConnection } = await getDatabase();
    const { sendNotificationToOwner } = await getTelegram();

    try {
        let requestsToProcess: Array<{ request: FeatureRequestDocument; phase: DesignPhaseType }>;

        if (options.id) {
            // Process specific request
            console.log(`Fetching request: ${options.id}`);
            const request = await featureRequests.findFeatureRequestById(options.id);
            if (!request) {
                console.error(`Feature request not found: ${options.id}`);
                process.exit(1);
            }

            // Determine which phase to work on
            // NOTE: With simplified status schema, this script is deprecated
            // Use yarn agent:product-design or yarn agent:tech-design instead
            let phase: DesignPhaseType | null = null;
            if (request.status === 'in_progress') {
                const reviewStatus = request.productDesign?.reviewStatus || 'not_started';
                if (reviewStatus === 'not_started' || reviewStatus === 'rejected') {
                    phase = 'product';
                } else {
                    const techReviewStatus = request.techDesign?.reviewStatus || 'not_started';
                    if (techReviewStatus === 'not_started' || techReviewStatus === 'rejected') {
                        phase = 'tech';
                    }
                }
            }

            if (!phase) {
                console.log('Request is not in a designable state (must be in_progress with design phases needing work)');
                console.log('NOTE: This script is deprecated - use yarn agent:product-design or yarn agent:tech-design instead');
                process.exit(0);
            }

            if (options.phase && options.phase !== phase) {
                console.log(`Request is in ${phase} phase, but --phase ${options.phase} was specified`);
                process.exit(0);
            }

            requestsToProcess = [{ request, phase }];
        } else {
            // Fetch requests needing design work
            console.log('Fetching feature requests needing design work...');
            const pendingRequests = await featureRequests.findPendingDesignWork(options.phase, options.limit);

            // Transform to include phase information
            requestsToProcess = pendingRequests.map(request => {
                // Determine which phase needs work
                let phase: DesignPhaseType;
                const productReviewStatus = request.productDesign?.reviewStatus;
                if (productReviewStatus === 'not_started' || productReviewStatus === 'rejected' || !request.productDesign) {
                    phase = 'product';
                } else {
                    phase = 'tech';
                }
                return { request, phase };
            });
        }

        if (requestsToProcess.length === 0) {
            console.log('\nNo feature requests need design work.');
            return;
        }

        console.log(`\nFound ${requestsToProcess.length} request(s) to process.\n`);

        // Track results
        const results = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            phases: { product: 0, tech: 0 },
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCostUSD: 0,
        };

        // Process each request
        for (const { request, phase } of requestsToProcess) {
            results.processed++;
            const requestId = request._id.toString();

            console.log(`----------------------------------------`);
            console.log(`[${results.processed}/${requestsToProcess.length}] Request: ${requestId}`);
            console.log(`  Title: ${request.title}`);
            console.log(`  Phase: ${phase === 'product' ? 'Product Design' : 'Technical Design'}`);
            console.log(`  Status: ${request.status}`);

            const currentDesign = phase === 'product' ? request.productDesign : request.techDesign;
            const iteration = currentDesign?.iterations || 0;
            if (iteration > 0) {
                console.log(`  Iteration: ${iteration + 1} (rework after rejection)`);
            }

            // Mark as in progress
            if (!options.dryRun) {
                console.log(`  Marking as in_progress...`);
                await featureRequests.markDesignInProgress(requestId, phase);
            }

            console.log(`  Generating design...`);
            const { content, usage } = await generateDesign(request, phase, options);

            // Accumulate usage stats
            if (usage) {
                results.totalInputTokens += usage.inputTokens;
                results.totalOutputTokens += usage.outputTokens;
                results.totalCostUSD += usage.totalCostUSD;
            }

            if (content) {
                results.succeeded++;
                results.phases[phase]++;

                console.log(`\n  Result:`);
                console.log(`    Design generated: ${content.length} chars`);
                console.log(`    Preview: ${content.slice(0, 100).replace(/\n/g, ' ')}...`);

                // Save to database (unless dry run)
                if (!options.dryRun) {
                    await featureRequests.updateDesignContent(requestId, phase, content);
                    console.log(`    Saved to database.`);

                    // Send notification to admin
                    try {
                        const phaseLabel = phase === 'product' ? 'Product Design' : 'Technical Design';
                        await sendNotificationToOwner(
                            `Design ready for review!\n\n` +
                            `Feature: ${request.title}\n` +
                            `Phase: ${phaseLabel}\n` +
                            `Iteration: ${iteration + 1}\n\n` +
                            `View in admin panel to approve or reject.`
                        );
                        console.log(`    Notification sent to admin.`);
                    } catch (notifyError) {
                        console.warn(`    Failed to send notification:`, notifyError instanceof Error ? notifyError.message : notifyError);
                    }
                } else {
                    console.log(`    [DRY RUN] Would save to database.`);
                    console.log(`    [DRY RUN] Would send notification to admin.`);
                }
            } else {
                results.failed++;
                console.log(`  Failed to generate design.`);

                // Reset status back to not_started on failure
                if (!options.dryRun) {
                    // Note: We can't easily reset, so we leave it as in_progress
                    // The admin can manually reset or the next run can try again
                    console.log(`    Status left as in_progress (manual intervention may be needed)`);
                }
            }

            console.log('');
        }

        // Print summary
        console.log('========================================');
        console.log('  Summary');
        console.log('========================================');
        console.log(`  Processed: ${results.processed}`);
        console.log(`  Succeeded: ${results.succeeded}`);
        console.log(`  Failed: ${results.failed}`);
        console.log('');
        console.log('  Phase breakdown:');
        console.log(`    Product Design: ${results.phases.product}`);
        console.log(`    Technical Design: ${results.phases.tech}`);
        console.log('');
        console.log('  Token usage:');
        console.log(`    Input tokens:  ${results.totalInputTokens.toLocaleString()}`);
        console.log(`    Output tokens: ${results.totalOutputTokens.toLocaleString()}`);
        console.log(`    Total tokens:  ${(results.totalInputTokens + results.totalOutputTokens).toLocaleString()}`);
        console.log(`    Total cost:    $${results.totalCostUSD.toFixed(4)}`);
        console.log('========================================\n');
    } finally {
        await closeDbConnection();
    }
}

// Run
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
