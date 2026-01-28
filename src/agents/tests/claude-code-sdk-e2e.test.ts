#!/usr/bin/env npx tsx
/**
 * E2E Test for Claude Code SDK with Playwright MCP
 *
 * This test:
 * 1. Starts the dev server (yarn dev)
 * 2. Uses claude-code-sdk adapter with Playwright MCP to mark a todo as done
 * 3. Verifies the todo status changed
 *
 * Usage: npx tsx src/agents/tests/claude-code-sdk-e2e.test.ts
 */

import { spawn, ChildProcess } from 'child_process';
import claudeCodeSDKAdapter from '../lib/adapters/claude-code-sdk';
import { PLAYWRIGHT_MCP_CONFIG, PLAYWRIGHT_TOOLS, isPlaywrightMCPAvailable } from '../lib/playwright-mcp';

const DEV_SERVER_PORT = 3000;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const SERVER_STARTUP_TIMEOUT = 60000; // 60 seconds

let devServer: ChildProcess | null = null;

/**
 * Start the dev server and wait for it to be ready
 */
async function startDevServer(): Promise<void> {
    console.log('🚀 Starting dev server...');

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Dev server failed to start within ${SERVER_STARTUP_TIMEOUT / 1000}s`));
        }, SERVER_STARTUP_TIMEOUT);

        devServer = spawn('yarn', ['dev'], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        let output = '';

        devServer.stdout?.on('data', (data: Buffer) => {
            const text = data.toString();
            output += text;

            // Check if server is ready
            if (text.includes('Ready in') || text.includes('started server') || text.includes(`localhost:${DEV_SERVER_PORT}`)) {
                clearTimeout(timeout);
                console.log('✅ Dev server started');
                // Give it a moment to fully initialize
                setTimeout(resolve, 2000);
            }
        });

        devServer.stderr?.on('data', (data: Buffer) => {
            const text = data.toString();
            // Next.js outputs some info to stderr
            if (text.includes('Ready in') || text.includes(`localhost:${DEV_SERVER_PORT}`)) {
                clearTimeout(timeout);
                console.log('✅ Dev server started');
                setTimeout(resolve, 2000);
            }
        });

        devServer.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`Failed to start dev server: ${error.message}`));
        });

        devServer.on('close', (code) => {
            if (code !== 0 && code !== null) {
                clearTimeout(timeout);
                reject(new Error(`Dev server exited with code ${code}\n${output}`));
            }
        });
    });
}

/**
 * Stop the dev server
 */
function stopDevServer(): void {
    if (devServer) {
        console.log('🛑 Stopping dev server...');
        devServer.kill('SIGTERM');
        devServer = null;
    }
}

/**
 * Wait for the server to be accessible
 */
async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {
            // Server not ready yet
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Server at ${url} not accessible after ${maxAttempts} attempts`);
}

async function main() {
    console.log('🧪 E2E Test: Claude Code SDK with Playwright MCP\n');

    // Check prerequisites
    const playwrightAvailable = isPlaywrightMCPAvailable();
    console.log(`📦 Playwright MCP available: ${playwrightAvailable ? '✅ Yes' : '❌ No'}`);

    if (!playwrightAvailable) {
        console.log('\n⚠️  Install @playwright/mcp first: yarn add @playwright/mcp');
        process.exit(1);
    }

    // Initialize claude-code-sdk adapter
    console.log('\n🔧 Initializing Claude Code SDK adapter...');
    try {
        await claudeCodeSDKAdapter.init();
        console.log('✅ Claude Code SDK adapter initialized');
        console.log(`   Model: ${claudeCodeSDKAdapter.model}`);
    } catch (error) {
        console.error('❌ Failed to initialize:', error instanceof Error ? error.message : error);
        process.exit(1);
    }

    // Show capabilities
    console.log('\n📋 Adapter capabilities:');
    console.log(`   - customTools: ${claudeCodeSDKAdapter.capabilities.customTools}`);
    console.log(`   - streaming: ${claudeCodeSDKAdapter.capabilities.streaming}`);
    console.log(`   - webFetch: ${claudeCodeSDKAdapter.capabilities.webFetch}`);

    try {
        // Start dev server
        await startDevServer();
        await waitForServer(DEV_SERVER_URL);
        console.log(`✅ Server accessible at ${DEV_SERVER_URL}`);

        // Run the E2E test with claude-code-sdk
        console.log('\n🎯 Running E2E test...');
        console.log('   Task: Navigate to todos page, mark a todo as done, verify status\n');

        const prompt = `
You have access to Playwright MCP browser tools. Use them to perform this E2E test:

1. Navigate to ${DEV_SERVER_URL}/todos
2. Wait for the page to load (use mcp__playwright_playwright__browser_snapshot to see the page)
3. Look for any todo item in the list
4. Click on a todo item to mark it as done (or find a checkbox/toggle to mark it done)
5. After clicking, take another snapshot to verify the todo's status changed
6. Report what you did and whether the test passed (todo was successfully marked as done)

Use mcp__playwright_playwright__browser_navigate, mcp__playwright_playwright__browser_snapshot, and mcp__playwright_playwright__browser_click tools.
If the page requires login, report that and consider the test blocked.
If there are no todos, report that.

Be concise in your response - just report:
- What page you saw
- What action you took
- Whether the todo status changed (PASS/FAIL)
`;

        const result = await claudeCodeSDKAdapter.run({
            prompt,
            mcpServers: PLAYWRIGHT_MCP_CONFIG,
            allowedTools: PLAYWRIGHT_TOOLS,
            stream: true,
            timeout: 180, // 3 minutes for E2E test
            progressLabel: 'E2E Test',
            allowWrite: true,
        });

        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Result:');
        console.log('='.repeat(60));
        console.log(`   Success: ${result.success ? '✅' : '❌'}`);
        console.log(`   Duration: ${result.durationSeconds}s`);

        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }

        if (result.content) {
            console.log('\n📝 Agent Report:');
            console.log('-'.repeat(60));
            console.log(result.content);
            console.log('-'.repeat(60));
        }

        if (result.usage) {
            console.log(`\n💰 Usage: ${result.usage.inputTokens + result.usage.outputTokens} tokens, $${result.usage.totalCostUSD.toFixed(4)}`);
        }

    } finally {
        // Always stop the dev server
        stopDevServer();
        await claudeCodeSDKAdapter.dispose();
    }

    console.log('\n✅ E2E Test complete');
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n⚠️  Interrupted, cleaning up...');
    stopDevServer();
    process.exit(1);
});

process.on('SIGTERM', () => {
    stopDevServer();
    process.exit(1);
});

main().catch((error) => {
    console.error('Fatal error:', error);
    stopDevServer();
    process.exit(1);
});
