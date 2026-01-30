#!/usr/bin/env npx tsx
/**
 * Structured Output Support Test
 *
 * Tests which agent adapters support structured output.
 * Run this to verify which adapters can return prSummary/comment fields.
 *
 * Usage: npx tsx src/agents/tests/structured-output.test.ts
 */

import claudeCodeSDKAdapter from '../lib/adapters/claude-code-sdk';
import cursorAdapter from '../lib/adapters/cursor';
import type { AgentLibraryAdapter } from '../lib/types';
// import geminiAdapter from '../lib/adapters/gemini';
// import openaiCodexAdapter from '../lib/adapters/openai-codex';

const TEST_OUTPUT_FORMAT = {
    type: 'json_schema' as const,
    schema: {
        type: 'object',
        properties: {
            prSummary: {
                type: 'string',
                description: 'A brief summary of changes',
            },
            comment: {
                type: 'string',
                description: 'A comment to post',
            },
        },
        required: ['prSummary', 'comment'],
    },
};

const TEST_PROMPT = `
Return a JSON response with these two fields:
- prSummary: Write "Test summary - structured output works"
- comment: Write "Test comment - fields are present"

This is just a test to verify structured output support.
`;

interface TestResult {
    adapter: string;
    supported: boolean;
    hasStructuredOutput: boolean;
    hasPrSummary: boolean;
    hasComment: boolean;
    error?: string;
    rawOutput?: unknown;
}

async function testAdapter(
    name: string,
    adapter: AgentLibraryAdapter
): Promise<TestResult> {
    console.log(`\n🧪 Testing ${name}...`);

    try {
        await adapter.init();
        console.log(`   Initialized`);

        const result = await adapter.run({
            prompt: TEST_PROMPT,
            outputFormat: TEST_OUTPUT_FORMAT,
            timeout: 60,
            progressLabel: `${name} structured output test`,
            allowWrite: false,
        });

        await adapter.dispose();

        const structuredOutput = result.structuredOutput as { prSummary?: string; comment?: string } | undefined;

        const testResult: TestResult = {
            adapter: name,
            supported: true,
            hasStructuredOutput: !!structuredOutput,
            hasPrSummary: !!(structuredOutput?.prSummary),
            hasComment: !!(structuredOutput?.comment),
            rawOutput: structuredOutput,
        };

        if (!result.success) {
            testResult.supported = false;
            testResult.error = result.error;
        }

        return testResult;
    } catch (error) {
        return {
            adapter: name,
            supported: false,
            hasStructuredOutput: false,
            hasPrSummary: false,
            hasComment: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function main() {
    // Parse command line args to select adapters
    const args = process.argv.slice(2);
    const testAll = args.includes('--all');
    const testCursor = args.includes('--cursor') || testAll;
    const testClaude = args.includes('--claude') || args.length === 0 || testAll;

    console.log('='.repeat(60));
    console.log('  Structured Output Support Test');
    console.log('='.repeat(60));
    console.log('\nUsage: npx tsx structured-output.test.ts [--claude] [--cursor] [--all]\n');

    const results: TestResult[] = [];

    // Test Claude Code SDK
    if (testClaude) {
        results.push(await testAdapter('Claude Code SDK', claudeCodeSDKAdapter));
    }

    // Test Cursor
    if (testCursor) {
        results.push(await testAdapter('Cursor', cursorAdapter));
    }

    // Uncomment to test other adapters (they need to be installed/configured)
    // results.push(await testAdapter('Gemini CLI', geminiAdapter));
    // results.push(await testAdapter('OpenAI Codex', openaiCodexAdapter));

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('  Results Summary');
    console.log('='.repeat(60));

    for (const result of results) {
        console.log(`\n📦 ${result.adapter}:`);
        console.log(`   Adapter works: ${result.supported ? '✅' : '❌'}`);
        console.log(`   Returns structuredOutput: ${result.hasStructuredOutput ? '✅' : '❌'}`);
        console.log(`   Has prSummary field: ${result.hasPrSummary ? '✅' : '❌'}`);
        console.log(`   Has comment field: ${result.hasComment ? '✅' : '❌'}`);

        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }

        if (result.rawOutput) {
            console.log(`   Raw output: ${JSON.stringify(result.rawOutput, null, 2)}`);
        }
    }

    // Final verdict
    console.log('\n' + '='.repeat(60));
    console.log('  Verdict');
    console.log('='.repeat(60));

    const fullSupport = results.filter(r => r.hasStructuredOutput && r.hasPrSummary && r.hasComment);
    const noSupport = results.filter(r => !r.hasStructuredOutput);

    console.log(`\n✅ Full structured output support: ${fullSupport.map(r => r.adapter).join(', ') || 'None'}`);
    console.log(`❌ No structured output support: ${noSupport.map(r => r.adapter).join(', ') || 'None'}`);

    console.log('\n' + '='.repeat(60));
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
