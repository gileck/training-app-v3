/**
 * Test Playwright MCP Tools with Claude Code SDK
 *
 * This script verifies that the Claude Code SDK can use Playwright MCP tools
 * to interact with a web page in headless mode.
 *
 * Usage:
 *   yarn tsx scripts/test-playwright-mcp.ts
 *   yarn tsx scripts/test-playwright-mcp.ts --with-dev-server  # Also starts yarn dev
 *   yarn tsx scripts/test-playwright-mcp.ts --url=https://example.com
 */

import { spawn, ChildProcess } from 'child_process';
import { query, type SDKResultMessage, type SDKSystemMessage } from '@anthropic-ai/claude-agent-sdk';

// Type for MCP server status in init message
interface MCPServerStatus {
    name: string;
    status: string;
    error?: string;
}

// MCP Server configuration for Playwright (headless mode)
// Using official @playwright/mcp package from Microsoft (locally installed)
const PLAYWRIGHT_MCP_CONFIG = {
    playwright: {
        command: 'node',
        args: ['./node_modules/@playwright/mcp/cli.js', '--headless'],
    },
};

// Playwright MCP tools (wildcard to allow all)
const PLAYWRIGHT_TOOLS = [
    'mcp__playwright__*',
];

// Basic tools
const BASIC_TOOLS = ['Read', 'Glob', 'Grep'];

async function waitForServer(port: number, timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        try {
            const response = await fetch(`http://localhost:${port}`);
            if (response.ok || response.status === 404) {
                return true;
            }
        } catch {
            // Server not ready yet
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.stdout.write('.');
    }

    return false;
}

async function startDevServer(): Promise<ChildProcess> {
    console.log('\n📦 Starting dev server...');

    const devServer = spawn('yarn', ['dev'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
    });

    devServer.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Ready') || output.includes('started')) {
            console.log(`  ✓ ${output.trim()}`);
        }
    });

    devServer.stderr?.on('data', (data) => {
        const output = data.toString();
        if (!output.includes('WARN') && output.trim()) {
            console.log(`  ⚠ ${output.trim()}`);
        }
    });

    process.stdout.write('  Waiting for server');
    const isReady = await waitForServer(3000, 60000);
    console.log('');

    if (!isReady) {
        throw new Error('Dev server failed to start within 60 seconds');
    }

    console.log('  ✓ Dev server is ready on http://localhost:3000\n');
    return devServer;
}

function stopDevServer(devServer: ChildProcess): void {
    if (devServer.pid) {
        try {
            process.kill(-devServer.pid, 'SIGTERM');
            console.log('\n🛑 Dev server stopped');
        } catch (error) {
            console.log('\n⚠ Could not stop dev server:', error);
        }
    }
}

async function runTest(url: string): Promise<void> {
    console.log('🧪 Testing Playwright MCP with Claude Code SDK\n');
    console.log(`   URL: ${url}`);
    console.log(`   Mode: Headless (no visible browser)`);
    console.log(`   MCP Server: @anthropic-ai/mcp-server-playwright\n`);

    const testPrompt = `
You have access to Playwright MCP tools to interact with a headless browser.

**Your task:**
1. Navigate to ${url}
2. Take a snapshot of the page to see what's there
3. Report what you see on the page (title, main elements, any buttons or links)

**Important:**
- Use the Playwright MCP tools (mcp__playwright__*) for browser automation
- The browser runs in headless mode (no visible window)
- After you're done, close the browser

**Output:**
Provide a brief summary of what you found on the page, proving that Playwright MCP works.
`;

    console.log('📤 Starting Playwright MCP server and sending test prompt...\n');

    const startTime = Date.now();
    let lastResult = '';
    let toolCallCount = 0;
    let mcpStatus: string | null = null;

    try {
        for await (const message of query({
            prompt: testPrompt,
            options: {
                mcpServers: PLAYWRIGHT_MCP_CONFIG,
                allowedTools: [...BASIC_TOOLS, ...PLAYWRIGHT_TOOLS],
                cwd: process.cwd(),
                model: 'sonnet',
                maxTurns: 20,
                permissionMode: 'bypassPermissions',
            },
        })) {
            // Check MCP server status on init
            if (message.type === 'system' && message.subtype === 'init') {
                const initMsg = message as SDKSystemMessage & { mcp_servers?: MCPServerStatus[] };
                console.log('  Init message received');
                if (initMsg.mcp_servers) {
                    console.log(`  MCP servers: ${JSON.stringify(initMsg.mcp_servers, null, 2)}`);
                    const playwrightServer = initMsg.mcp_servers.find((s: MCPServerStatus) => s.name === 'playwright');
                    if (playwrightServer) {
                        mcpStatus = playwrightServer.status;
                        console.log(`  MCP Server Status: ${mcpStatus}`);
                        if (mcpStatus !== 'connected') {
                            console.log(`  ⚠ Playwright MCP server not connected: ${playwrightServer.status}`);
                            if (playwrightServer.error) {
                                console.log(`  Error: ${playwrightServer.error}`);
                            }
                        }
                    }
                } else {
                    console.log('  No MCP servers in init message');
                }
            }

            // Track assistant messages
            if (message.type === 'assistant') {
                for (const block of message.message.content) {
                    if (block.type === 'text') {
                        const text = (block as { type: 'text'; text: string }).text;
                        lastResult = text;
                        // Show streaming output
                        const lines = text.split('\n').filter(l => l.trim());
                        for (const line of lines) {
                            console.log(`    \x1b[90m${line}\x1b[0m`);
                        }
                    }
                    if (block.type === 'tool_use') {
                        toolCallCount++;
                        const tool = block as { type: 'tool_use'; name: string };
                        const elapsed = Math.floor((Date.now() - startTime) / 1000);
                        console.log(`  \x1b[36m[${elapsed}s] Tool: ${tool.name}\x1b[0m`);
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

        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Results:');
        console.log('='.repeat(60));

        // Check if Playwright tools were actually used
        const usedPlaywright = lastResult.toLowerCase().includes('playwright') ||
                              lastResult.toLowerCase().includes('browser') ||
                              lastResult.toLowerCase().includes('snapshot');

        if (mcpStatus === 'connected' && usedPlaywright) {
            console.log('\n✅ SUCCESS - Playwright MCP tools work with Claude Code SDK!\n');
        } else if (mcpStatus !== 'connected') {
            console.log('\n⚠️ PARTIAL - MCP server did not connect properly\n');
        } else {
            console.log('\n⚠️ PARTIAL - Agent may have used fallback tools\n');
        }

        console.log('Agent Response:');
        console.log('-'.repeat(40));
        console.log(lastResult || '(no content)');
        console.log('-'.repeat(40));
        console.log(`\n   Duration: ${durationSeconds}s`);
        console.log(`   Tool Calls: ${toolCallCount}`);
        console.log('');

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        throw error;
    }
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const withDevServer = args.includes('--with-dev-server');
    const customUrl = args.find(arg => arg.startsWith('--url='))?.split('=')[1];

    let devServer: ChildProcess | null = null;
    const testUrl = customUrl || (withDevServer ? 'http://localhost:3000' : 'https://example.com');

    try {
        if (withDevServer) {
            devServer = await startDevServer();
        }

        await runTest(testUrl);

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        process.exit(1);
    } finally {
        if (devServer) {
            stopDevServer(devServer);
        }
    }
}

main();
