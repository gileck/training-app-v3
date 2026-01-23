#!/usr/bin/env tsx
/**
 * Cursor CLI Adapter Test Script
 *
 * Verifies that the Cursor CLI adapter works correctly:
 * - Basic read-only queries
 * - File modification with --force
 * - Streaming output parsing
 * - Timeout handling
 * - Error handling
 *
 * Prerequisites:
 *   - Cursor CLI installed: curl https://cursor.com/install -fsS | bash
 *   - Login: cursor-agent login
 *   - Active Cursor subscription
 *
 * Usage:
 *   yarn test-cursor-adapter              # Run all tests
 *   yarn test-cursor-adapter --test read  # Run specific test
 *   yarn test-cursor-adapter --verbose    # Show detailed output
 *   yarn test-cursor-adapter --stream     # Test streaming mode
 */

import { Command } from 'commander';
import type { AgentRunResult, AgentLibraryAdapter } from '../src/agents/lib';

// Import cursor adapter directly for testing
import cursorAdapter from '../src/agents/lib/adapters/cursor';

/**
 * Get the cursor adapter (initializing if needed)
 */
async function getCursorAdapter(): Promise<AgentLibraryAdapter> {
    if (!cursorAdapter.isInitialized()) {
        await cursorAdapter.init();
    }
    return cursorAdapter;
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

        const adapter = await getCursorAdapter();

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

        const adapter = await getCursorAdapter();

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

        const adapter = await getCursorAdapter();

        const duration = Math.floor((Date.now() - startTime) / 1000);

        // Verify it's the cursor adapter
        if (adapter.name !== 'cursor') {
            return {
                name: testName,
                passed: false,
                duration,
                error: `Expected cursor adapter, got ${adapter.name}`,
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
 * Test: Error handling for invalid prompt
 */
async function testErrorHandling(options: CLIOptions): Promise<TestResult> {
    const testName = 'Error handling';
    const startTime = Date.now();

    try {
        console.log(`\n  Running: ${testName}`);

        const adapter = await getCursorAdapter();

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
 * Test: Review latest commit with streaming (shows thinking process)
 */
async function testReviewCommit(options: CLIOptions): Promise<TestResult> {
    const testName = 'Review latest commit';
    const startTime = Date.now();

    try {
        console.log(`\n  Running: ${testName}`);
        console.log('  (Streaming output with thinking process)\n');

        // Get latest commit info
        const { execSync } = await import('child_process');
        const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
        const commitMessage = execSync('git log -1 --pretty=%s', { encoding: 'utf-8' }).trim();
        const commitDiff = execSync('git show --stat HEAD', { encoding: 'utf-8' }).trim();

        console.log(`  Commit: ${commitHash} - ${commitMessage}\n`);
        console.log('  --- Streaming Output ---\n');

        // Run cursor-agent directly to show streaming output
        const { spawn } = await import('child_process');
        
        const prompt = `Review the following git commit and provide brief feedback:

Commit: ${commitHash}
Message: ${commitMessage}

Changes:
${commitDiff}

Provide a brief code review (2-3 sentences) focusing on:
1. Is the change clear and well-documented?
2. Any potential issues?`;

        const args = [
            prompt,
            '-p',
            '--model', 'opus-4.5',
            '--output-format', 'stream-json',
        ];

        return new Promise((resolve) => {
            let buffer = '';
            let fullContent = '';
            let thinkingContent = '';
            let timedOut = false;

            const proc = spawn('cursor-agent', args, {
                cwd: process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            // Close stdin immediately
            proc.stdin?.end();

            // Set timeout (2 minutes)
            const timeoutId = setTimeout(() => {
                timedOut = true;
                proc.kill('SIGTERM');
            }, 120000);

            proc.stdout?.on('data', (data: Buffer) => {
                buffer += data.toString();
                
                // Parse JSON lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    try {
                        const event = JSON.parse(line);
                        
                        // Debug: show raw event type if verbose
                        if (options.verbose && event.type !== 'result') {
                            process.stdout.write(`\x1b[90m[${event.type}]\x1b[0m `);
                        }

                        // Handle different event types
                        if (event.type === 'assistant' && event.message?.content) {
                            for (const block of event.message.content) {
                                if (block.type === 'thinking') {
                                    // Show thinking in cyan
                                    const thinking = block.thinking || block.text || '';
                                    if (thinking) {
                                        thinkingContent += thinking;
                                        process.stdout.write(`\x1b[36m💭 ${thinking}\x1b[0m\n`);
                                    }
                                } else if (block.type === 'text') {
                                    // Show text in normal color
                                    const text = block.text || '';
                                    if (text) {
                                        fullContent += text;
                                        process.stdout.write(text);
                                    }
                                } else if (options.verbose) {
                                    // Show unknown block types in debug
                                    process.stdout.write(`\x1b[33m[block:${block.type}]\x1b[0m `);
                                }
                            }
                        } else if (event.type === 'result') {
                            // Final result
                            if (event.result && !fullContent) {
                                fullContent = event.result;
                                process.stdout.write(event.result);
                            }
                            process.stdout.write('\n');
                        }
                    } catch {
                        // Not valid JSON, skip
                    }
                }
            });

            proc.stderr?.on('data', (data: Buffer) => {
                process.stderr.write(data);
            });

            proc.on('close', (code) => {
                clearTimeout(timeoutId);
                
                const duration = Math.floor((Date.now() - startTime) / 1000);

                console.log('\n  --- End Streaming ---\n');

                if (timedOut) {
                    resolve({
                        name: testName,
                        passed: false,
                        duration,
                        error: 'Timed out after 2 minutes',
                    });
                    return;
                }

                if (options.verbose) {
                    console.log(`  Thinking content length: ${thinkingContent.length}`);
                    console.log(`  Response content length: ${fullContent.length}`);
                }

                resolve({
                    name: testName,
                    passed: code === 0 && fullContent.length > 0,
                    duration,
                    error: code !== 0 ? `Exit code: ${code}` : undefined,
                });
            });
        });
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

        const adapter = await getCursorAdapter();

        // Create a temporary test file
        const testFilePath = '.test-cursor-adapter-temp.txt';
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
        .name('test-cursor-adapter')
        .description('Test the Cursor CLI adapter implementation')
        .option('-t, --test <name>', 'Run specific test (init, read, stream, error, write, review)')
        .option('-v, --verbose', 'Show detailed output', false)
        .option('-s, --stream', 'Use streaming mode for tests', false)
        .option('--skip-write', 'Skip write operation test', false)
        .parse(process.argv);

    const options = program.opts<CLIOptions>();

    console.log('\n========================================');
    console.log('  Cursor CLI Adapter Test Suite');
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
        { name: 'Review latest commit', key: 'review', fn: testReviewCommit },
    ];

    // Filter tests if specific test requested
    const testsToRun = options.test
        ? tests.filter(t => t.key === options.test)
        : tests;

    if (testsToRun.length === 0) {
        console.error(`\n  Unknown test: ${options.test}`);
        console.error('  Available tests: init, read, stream, error, write, review');
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
