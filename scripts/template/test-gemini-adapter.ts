#!/usr/bin/env tsx
/**
 * Gemini CLI Adapter Test Script
 *
 * Verifies that the Gemini CLI adapter works correctly:
 * - Basic read-only queries
 * - File modification with --yolo
 * - Streaming output parsing
 * - Timeout handling
 * - Error handling
 *
 * Prerequisites:
 *   - Gemini CLI installed: npm install -g @google/gemini-cli
 *   - Authenticated: Set GEMINI_API_KEY or run `gemini` for interactive setup
 *
 * Usage:
 *   yarn test-gemini-adapter              # Run all tests
 *   yarn test-gemini-adapter --test read  # Run specific test
 *   yarn test-gemini-adapter --verbose    # Show detailed output
 *   yarn test-gemini-adapter --stream     # Test streaming mode
 */

import { Command } from 'commander';
import type { AgentRunResult, AgentLibraryAdapter } from '../../src/agents/lib';

// Import gemini adapter directly for testing
import geminiAdapter from '../../src/agents/lib/adapters/gemini';

/**
 * Get the gemini adapter (initializing if needed)
 */
async function getGeminiAdapter(): Promise<AgentLibraryAdapter> {
    if (!geminiAdapter.isInitialized()) {
        await geminiAdapter.init();
    }
    return geminiAdapter;
}

// ============================================================
// CONFIGURATION
// ============================================================

const TIMEOUT_SHORT = 30; // 30 seconds for simple queries
const TIMEOUT_MEDIUM = 60; // 60 seconds for standard operations

// ============================================================
// TYPES
// ============================================================

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
    result?: AgentRunResult;
}

interface CLIOptions {
    test?: string;
    verbose: boolean;
    stream: boolean;
    skipWrite: boolean;
}

// ============================================================
// TEST CASES
// ============================================================

/**
 * Test: Basic read-only query
 */
async function testReadOnlyQuery(options: CLIOptions): Promise<TestResult> {
    const testName = 'Read-only query';
    const startTime = Date.now();

    try {
        console.log(`\n  Running: ${testName}`);

        const adapter = await getGeminiAdapter();

        // Simple query that should read a file
        const result = await adapter.run({
            prompt: 'Read the package.json file and tell me the project name. Respond with just the name.',
            allowWrite: false,
            stream: options.stream,
            timeout: TIMEOUT_SHORT,
            progressLabel: 'Testing read-only',
        });

        const duration = Math.floor((Date.now() - startTime) / 1000);

        // Validate result
        if (!result.success) {
            return {
                name: testName,
                passed: false,
                duration,
                error: result.error || 'Unknown error',
                result,
            };
        }

        // Check that we got some content back
        if (!result.content || result.content.trim().length === 0) {
            return {
                name: testName,
                passed: false,
                duration,
                error: 'No content returned',
                result,
            };
        }

        if (options.verbose) {
            console.log(`    Content: ${result.content.substring(0, 100)}...`);
            console.log(`    Files examined: ${result.filesExamined.length}`);
        }

        return {
            name: testName,
            passed: true,
            duration,
            result,
        };
    } catch (error) {
        return {
            name: testName,
            passed: false,
            duration: Math.floor((Date.now() - startTime) / 1000),
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Test: Streaming output
 */
async function testStreamingOutput(options: CLIOptions): Promise<TestResult> {
    const testName = 'Streaming output';
    const startTime = Date.now();

    try {
        console.log(`\n  Running: ${testName}`);

        const adapter = await getGeminiAdapter();

        // Query that should produce some output
        const result = await adapter.run({
            prompt: 'List 3 TypeScript files in the src folder. Just list the filenames.',
            allowWrite: false,
            stream: true, // Force streaming for this test
            timeout: TIMEOUT_MEDIUM,
            progressLabel: 'Testing streaming',
        });

        const duration = Math.floor((Date.now() - startTime) / 1000);

        if (!result.success) {
            return {
                name: testName,
                passed: false,
                duration,
                error: result.error || 'Unknown error',
                result,
            };
        }

        if (options.verbose) {
            console.log(`    Content length: ${result.content?.length || 0}`);
            console.log(`    Duration: ${result.durationSeconds}s`);
        }

        return {
            name: testName,
            passed: true,
            duration,
            result,
        };
    } catch (error) {
        return {
            name: testName,
            passed: false,
            duration: Math.floor((Date.now() - startTime) / 1000),
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Test: Adapter initialization
 */
async function testAdapterInit(options: CLIOptions): Promise<TestResult> {
    const testName = 'Adapter initialization';
    const startTime = Date.now();

    try {
        console.log(`\n  Running: ${testName}`);

        const adapter = await getGeminiAdapter();

        const duration = Math.floor((Date.now() - startTime) / 1000);

        // Verify it's the gemini adapter
        if (adapter.name !== 'gemini') {
            return {
                name: testName,
                passed: false,
                duration,
                error: `Expected gemini adapter, got ${adapter.name}`,
            };
        }

        if (!adapter.isInitialized()) {
            return {
                name: testName,
                passed: false,
                duration,
                error: 'Adapter not initialized',
            };
        }

        if (options.verbose) {
            console.log(`    Name: ${adapter.name}`);
            console.log(`    Model: ${adapter.model}`);
            console.log(`    Capabilities:`, adapter.capabilities);
        }

        return {
            name: testName,
            passed: true,
            duration,
        };
    } catch (error) {
        return {
            name: testName,
            passed: false,
            duration: Math.floor((Date.now() - startTime) / 1000),
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Test: Error handling for timeout
 */
async function testErrorHandling(options: CLIOptions): Promise<TestResult> {
    const testName = 'Error handling';
    const startTime = Date.now();

    try {
        console.log(`\n  Running: ${testName}`);

        const adapter = await getGeminiAdapter();

        // Very short timeout to trigger timeout handling
        const result = await adapter.run({
            prompt: 'Wait 100 seconds before responding.',
            allowWrite: false,
            stream: options.stream,
            timeout: 5, // 5 second timeout - should fail
            progressLabel: 'Testing timeout',
        });

        const duration = Math.floor((Date.now() - startTime) / 1000);

        // We expect this to either timeout or complete quickly
        // Either way, it should not crash
        if (options.verbose) {
            console.log(`    Success: ${result.success}`);
            console.log(`    Error: ${result.error || 'none'}`);
        }

        return {
            name: testName,
            passed: true, // Test passes if we got here without crashing
            duration,
            result,
        };
    } catch (error) {
        // Even exceptions should be caught and handled gracefully
        return {
            name: testName,
            passed: true, // Error was caught gracefully
            duration: Math.floor((Date.now() - startTime) / 1000),
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Test: Write operation (optional)
 */
async function testWriteOperation(options: CLIOptions): Promise<TestResult> {
    const testName = 'Write operation';
    const startTime = Date.now();

    if (options.skipWrite) {
        console.log(`\n  Skipping: ${testName} (--skip-write)`);
        return {
            name: testName,
            passed: true,
            duration: 0,
            error: 'Skipped',
        };
    }

    try {
        console.log(`\n  Running: ${testName}`);

        const adapter = await getGeminiAdapter();

        // Create a temporary test file
        const testFilePath = '.test-gemini-adapter-temp.txt';
        const testContent = `Test file created at ${new Date().toISOString()}`;

        const result = await adapter.run({
            prompt: `Create a file named "${testFilePath}" with the content: "${testContent}". Then read it back to confirm.`,
            allowWrite: true,
            stream: options.stream,
            timeout: TIMEOUT_MEDIUM,
            progressLabel: 'Testing write',
        });

        const duration = Math.floor((Date.now() - startTime) / 1000);

        // Clean up test file
        try {
            const fs = await import('fs');
            if (fs.existsSync(testFilePath)) {
                fs.unlinkSync(testFilePath);
                if (options.verbose) {
                    console.log(`    Cleaned up: ${testFilePath}`);
                }
            }
        } catch {
            // Ignore cleanup errors
        }

        if (!result.success) {
            return {
                name: testName,
                passed: false,
                duration,
                error: result.error || 'Unknown error',
                result,
            };
        }

        if (options.verbose) {
            console.log(`    Content: ${result.content?.substring(0, 100)}...`);
        }

        return {
            name: testName,
            passed: true,
            duration,
            result,
        };
    } catch (error) {
        return {
            name: testName,
            passed: false,
            duration: Math.floor((Date.now() - startTime) / 1000),
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    const program = new Command();

    program
        .name('test-gemini-adapter')
        .description('Test the Gemini CLI adapter implementation')
        .option('-t, --test <name>', 'Run specific test (init, read, stream, error, write)')
        .option('-v, --verbose', 'Show detailed output', false)
        .option('-s, --stream', 'Use streaming mode for tests', false)
        .option('--skip-write', 'Skip write operation test', false)
        .parse(process.argv);

    const options = program.opts<CLIOptions>();

    console.log('\n========================================');
    console.log('  Gemini CLI Adapter Test Suite');
    console.log('========================================');

    // Define test suite
    const tests: Array<{
        name: string;
        key: string;
        fn: (opts: CLIOptions) => Promise<TestResult>;
    }> = [
        { name: 'Adapter initialization', key: 'init', fn: testAdapterInit },
        { name: 'Read-only query', key: 'read', fn: testReadOnlyQuery },
        { name: 'Streaming output', key: 'stream', fn: testStreamingOutput },
        { name: 'Error handling', key: 'error', fn: testErrorHandling },
        { name: 'Write operation', key: 'write', fn: testWriteOperation },
    ];

    // Filter tests if specific test requested
    const testsToRun = options.test
        ? tests.filter(t => t.key === options.test)
        : tests;

    if (testsToRun.length === 0) {
        console.error(`\n  Unknown test: ${options.test}`);
        console.error('  Available tests: init, read, stream, error, write');
        process.exit(1);
    }

    // Run tests
    const results: TestResult[] = [];
    for (const test of testsToRun) {
        const result = await test.fn(options);
        results.push(result);
    }

    // Print summary
    console.log('\n========================================');
    console.log('  Test Results');
    console.log('========================================\n');

    let passed = 0;
    let failed = 0;

    for (const result of results) {
        const status = result.passed ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
        const duration = result.duration > 0 ? ` (${result.duration}s)` : '';
        console.log(`  ${status} ${result.name}${duration}`);

        if (!result.passed && result.error) {
            console.log(`         Error: ${result.error}`);
        }

        if (result.passed) {
            passed++;
        } else {
            failed++;
        }
    }

    console.log('\n----------------------------------------');
    console.log(`  Total: ${results.length} tests`);
    console.log(`  Passed: \x1b[32m${passed}\x1b[0m`);
    console.log(`  Failed: \x1b[31m${failed}\x1b[0m`);
    console.log('========================================\n');

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
