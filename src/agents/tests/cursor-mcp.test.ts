#!/usr/bin/env npx tsx
/**
 * Test script for Cursor MCP integration
 *
 * Usage: npx tsx src/agents/tests/cursor-mcp.test.ts
 */

import cursorAdapter from '../lib/adapters/cursor';
import { PLAYWRIGHT_MCP_CONFIG, isPlaywrightMCPAvailable } from '../lib/playwright-mcp';

async function main() {
    console.log('🧪 Testing Cursor MCP Integration\n');

    // Check if Playwright MCP is available
    const playwrightAvailable = isPlaywrightMCPAvailable();
    console.log(`📦 Playwright MCP available: ${playwrightAvailable ? '✅ Yes' : '❌ No'}`);

    if (!playwrightAvailable) {
        console.log('\n⚠️  Install @playwright/mcp first: yarn add @playwright/mcp');
        process.exit(1);
    }

    // Initialize the cursor adapter
    console.log('\n🔧 Initializing Cursor adapter...');
    try {
        await cursorAdapter.init();
        console.log('✅ Cursor adapter initialized');
    } catch (error) {
        console.error('❌ Failed to initialize:', error instanceof Error ? error.message : error);
        process.exit(1);
    }

    // Show capabilities
    console.log('\n📋 Adapter capabilities:');
    console.log(`   - customTools: ${cursorAdapter.capabilities.customTools}`);
    console.log(`   - streaming: ${cursorAdapter.capabilities.streaming}`);
    console.log(`   - planMode: ${cursorAdapter.capabilities.planMode}`);

    // Run a simple test with Playwright MCP
    console.log('\n🚀 Running test with Playwright MCP...');
    console.log('   Prompt: "Navigate to https://example.com and tell me the page title"\n');

    const result = await cursorAdapter.run({
        prompt: 'Navigate to https://example.com using the Playwright MCP browser tools and tell me the page title. Use browser_navigate to go to the URL, then browser_snapshot to see the page content.',
        mcpServers: PLAYWRIGHT_MCP_CONFIG,
        stream: true,
        timeout: 120,
        progressLabel: 'Testing MCP',
        allowWrite: true, // Enable --force flag which may be needed for MCP tools
    });

    console.log('\n📊 Result:');
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Duration: ${result.durationSeconds}s`);
    if (result.error) {
        console.log(`   Error: ${result.error}`);
    }
    if (result.content) {
        console.log(`   Content: ${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}`);
    }
    if (result.usage) {
        console.log(`   Tokens: ${result.usage.inputTokens + result.usage.outputTokens}`);
        console.log(`   Cost: $${result.usage.totalCostUSD.toFixed(4)}`);
    }

    // Cleanup
    await cursorAdapter.dispose();
    console.log('\n✅ Test complete');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
