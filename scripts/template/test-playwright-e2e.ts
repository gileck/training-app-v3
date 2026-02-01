/**
 * E2E Test: Playwright MCP with Local Dev Server
 *
 * This test simulates what the implementor agent will do:
 * 1. Start yarn dev
 * 2. Navigate to localhost:3000
 * 3. Go to /todos page
 * 4. Find a todo item and mark it as done
 * 5. Verify it's marked as done
 *
 * Usage:
 *   yarn tsx scripts/test-playwright-e2e.ts
 */

import { spawn, ChildProcess } from 'child_process';
import { query, type SDKResultMessage, type SDKSystemMessage } from '@anthropic-ai/claude-agent-sdk';

// Type for MCP server status in init message
interface MCPServerStatus {
    name: string;
    status: string;
    error?: string;
}

// Port will be detected from dev server output
let DEV_SERVER_PORT = 3000;
let DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// MCP Server configuration for Playwright (headless mode)
const PLAYWRIGHT_MCP_CONFIG = {
    playwright: {
        command: 'node',
        args: ['./node_modules/@playwright/mcp/cli.js', '--headless'],
    },
};

// Playwright MCP tools
const PLAYWRIGHT_TOOLS = ['mcp__playwright__*'];

// Basic tools
const BASIC_TOOLS = ['Read', 'Glob', 'Grep'];

async function waitForServer(port: number, timeoutMs: number = 90000): Promise<boolean> {
    const startTime = Date.now();
    console.log(`  Waiting for server on port ${port}...`);

    while (Date.now() - startTime < timeoutMs) {
        try {
            const response = await fetch(`http://localhost:${port}`);
            if (response.ok || response.status === 404 || response.status === 307) {
                return true;
            }
        } catch {
            // Server not ready yet
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        process.stdout.write(`\r  Waiting... ${elapsed}s`);
    }

    return false;
}

async function startDevServer(): Promise<ChildProcess> {
    console.log('\n📦 Starting dev server (yarn dev)...\n');

    const devServer = spawn('yarn', ['dev'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
    });

    let serverOutput = '';
    let detectedPort: number | null = null;

    devServer.stdout?.on('data', (data) => {
        serverOutput += data.toString();
        const output = data.toString();

        // Detect port from Next.js output (e.g., "- Local: http://localhost:3001")
        const portMatch = output.match(/localhost:(\d+)/);
        if (portMatch && !detectedPort) {
            detectedPort = parseInt(portMatch[1], 10);
            DEV_SERVER_PORT = detectedPort;
            DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
            console.log(`  📍 Detected port: ${DEV_SERVER_PORT}`);
        }

        if (output.includes('Ready') || output.includes('started') || output.includes('Local:')) {
            console.log(`  ✓ ${output.trim()}`);
        }
    });

    devServer.stderr?.on('data', (data) => {
        const output = data.toString();
        // Only show non-warning errors
        if (!output.includes('WARN') && !output.includes('warn') && output.trim()) {
            // Check if it's an actual error
            if (output.includes('Error') || output.includes('error')) {
                console.log(`  ❌ ${output.trim()}`);
            }
        }
    });

    // Wait a bit for port detection
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Use detected port or default
    const portToCheck = detectedPort || DEV_SERVER_PORT;
    console.log(`  Checking server on port ${portToCheck}...`);

    const isReady = await waitForServer(portToCheck, 90000);
    console.log('');

    if (!isReady) {
        console.log('Server output:', serverOutput);
        throw new Error(`Dev server failed to start within 90 seconds on port ${portToCheck}`);
    }

    console.log(`  ✓ Dev server is ready on ${DEV_SERVER_URL}\n`);
    return devServer;
}

function stopDevServer(devServer: ChildProcess): void {
    if (devServer.pid) {
        try {
            process.kill(-devServer.pid, 'SIGTERM');
            console.log('\n🛑 Dev server stopped');
        } catch (error) {
            // Try regular kill if process group kill fails
            try {
                devServer.kill('SIGTERM');
            } catch {
                console.log('\n⚠ Could not stop dev server:', error);
            }
        }
    }
}

async function runE2ETest(): Promise<boolean> {
    console.log('🧪 E2E Test: Todo Workflow with Playwright MCP\n');
    console.log(`   URL: ${DEV_SERVER_URL}/todos`);
    console.log(`   Mode: Headless browser`);
    console.log(`   Test: Navigate → Find todo → Mark done → Verify\n`);

    const testPrompt = `
You are testing a web application. Use the Playwright MCP tools to perform this E2E test.

## Test Steps

1. **Navigate to the todos page**: Go to ${DEV_SERVER_URL}/todos

2. **Take initial snapshot**: Capture the page to see the current state of todos

3. **Find an incomplete todo**: Look for a todo item that is NOT completed (checkbox should NOT have aria-checked="true")
   - Look for elements with role="checkbox" and aria-checked="false"
   - Note: The app might need you to log in first. If you see a login page, report that.

4. **Click the checkbox to mark it done**: Click on the checkbox of an incomplete todo

5. **Wait briefly**: Wait 1-2 seconds for the UI to update

6. **Take final snapshot**: Capture the page again to verify the change

7. **Verify**: Confirm that:
   - The checkbox now shows aria-checked="true"
   - The todo text has the completed styling (strikethrough or different appearance)

8. **Close browser**: Clean up

## Important Notes
- The app runs on ${DEV_SERVER_URL}
- If you encounter a login page, just report what you see - don't try to log in
- Focus on finding and clicking ONE checkbox, then verifying the state changed
- If there are no todos, report that

## Output Format
Report your findings in this format:

**Test Result:** PASS or FAIL

**Steps Performed:**
1. [What you did]
2. [What you did]
...

**Observations:**
- What you saw on the page
- Whether the todo was successfully marked as done

**Verification:**
- Before state: [checkbox state before click]
- After state: [checkbox state after click]
`;

    console.log('📤 Running E2E test with Playwright MCP...\n');

    const startTime = Date.now();
    let lastResult = '';
    let toolCalls: string[] = [];
    let mcpStatus: string | null = null;

    try {
        for await (const message of query({
            prompt: testPrompt,
            options: {
                mcpServers: PLAYWRIGHT_MCP_CONFIG,
                allowedTools: [...BASIC_TOOLS, ...PLAYWRIGHT_TOOLS],
                cwd: process.cwd(),
                model: 'sonnet',
                maxTurns: 30,
                permissionMode: 'bypassPermissions',
            },
        })) {
            // Check MCP server status on init
            if (message.type === 'system' && message.subtype === 'init') {
                const initMsg = message as SDKSystemMessage & { mcp_servers?: MCPServerStatus[] };
                if (initMsg.mcp_servers) {
                    const playwrightServer = initMsg.mcp_servers.find((s: MCPServerStatus) => s.name === 'playwright');
                    if (playwrightServer) {
                        mcpStatus = playwrightServer.status;
                        console.log(`  MCP Server: ${mcpStatus === 'connected' ? '✅ Connected' : '❌ ' + mcpStatus}`);
                    }
                }
            }

            // Track assistant messages
            if (message.type === 'assistant') {
                for (const block of message.message.content) {
                    if (block.type === 'text') {
                        const text = (block as { type: 'text'; text: string }).text;
                        lastResult = text;
                        // Show streaming output (abbreviated)
                        const lines = text.split('\n').filter(l => l.trim()).slice(0, 3);
                        for (const line of lines) {
                            if (line.length > 100) {
                                console.log(`    \x1b[90m${line.substring(0, 100)}...\x1b[0m`);
                            } else {
                                console.log(`    \x1b[90m${line}\x1b[0m`);
                            }
                        }
                        if (text.split('\n').filter(l => l.trim()).length > 3) {
                            console.log(`    \x1b[90m...(more output)\x1b[0m`);
                        }
                    }
                    if (block.type === 'tool_use') {
                        const tool = block as { type: 'tool_use'; name: string };
                        const elapsed = Math.floor((Date.now() - startTime) / 1000);
                        toolCalls.push(tool.name);
                        // Show tool calls with nice formatting
                        const shortName = tool.name.replace('mcp__playwright__', '🎭 ');
                        console.log(`  \x1b[36m[${elapsed}s] ${shortName}\x1b[0m`);
                    }
                }
            }

            // Get final result
            if (message.type === 'result') {
                const resultMsg = message as SDKResultMessage;
                if (resultMsg.subtype === 'success' && resultMsg.result) {
                    lastResult = resultMsg.result;
                }
            }
        }

        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

        console.log('\n' + '='.repeat(70));
        console.log('📊 E2E Test Results:');
        console.log('='.repeat(70));

        // Check if test passed based on output
        const testPassed = lastResult.toLowerCase().includes('pass') ||
                          (lastResult.toLowerCase().includes('success') && !lastResult.toLowerCase().includes('fail'));

        if (mcpStatus === 'connected' && testPassed) {
            console.log('\n✅ E2E TEST PASSED!\n');
        } else if (mcpStatus !== 'connected') {
            console.log('\n❌ E2E TEST FAILED - MCP server not connected\n');
        } else {
            console.log('\n⚠️ E2E TEST - Check results below\n');
        }

        console.log('Agent Report:');
        console.log('-'.repeat(70));
        console.log(lastResult || '(no content)');
        console.log('-'.repeat(70));
        console.log(`\n📈 Stats:`);
        console.log(`   Duration: ${durationSeconds}s`);
        console.log(`   Tool Calls: ${toolCalls.length}`);
        console.log(`   Playwright Tools Used: ${toolCalls.filter(t => t.includes('playwright')).length}`);
        console.log('');

        return testPassed;

    } catch (error) {
        console.error('\n❌ E2E test failed with error:', error);
        return false;
    }
}

async function main(): Promise<void> {
    let devServer: ChildProcess | null = null;

    try {
        // Start dev server
        devServer = await startDevServer();

        // Run E2E test
        const passed = await runE2ETest();

        process.exitCode = passed ? 0 : 1;

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        process.exitCode = 1;
    } finally {
        if (devServer) {
            stopDevServer(devServer);
        }
    }
}

main();
