#!/usr/bin/env tsx
/**
 * Test GitHub Projects Workflow
 *
 * Adds a test issue to the GitHub Project and sends a routing notification
 */

import '../src/agents/shared/loadEnv';
import { getProjectManagementAdapter } from '../src/server/project-management';
import { sendNotificationToOwner } from '../src/server/telegram';

const ISSUE_NUMBER = parseInt(process.argv[2] || '25');

async function main() {
    console.log('🧪 Testing GitHub Projects Workflow');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        const adapter = getProjectManagementAdapter();

        console.log(`📝 Adding issue #${ISSUE_NUMBER} to GitHub Project...`);

        // Initialize adapter
        await adapter.init();

        // Get issue node ID using REST API (GraphQL query doesn't include it)
        const { Octokit } = await import('@octokit/rest');
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        const { data: issue } = await octokit.rest.issues.get({
            owner: 'gileck',
            repo: 'training-app-v3',
            issue_number: ISSUE_NUMBER,
        });

        console.log(`  Issue node ID: ${issue.node_id}`);

        // Add issue to project
        const itemId = await adapter.addIssueToProject(issue.node_id);

        // Set status to Backlog
        await adapter.updateItemStatus(itemId, 'Backlog');

        console.log('✅ Issue added to project!\n');

        console.log('📱 Sending Telegram routing notification...');

        // Send routing notification
        const message = `🎯 New Test Issue Added to Project

**Issue #${ISSUE_NUMBER}**: test: verify GitHub Projects workflow integration

Please choose where to route this item:`;

        const buttons = [
            [
                { text: '📋 Product Design', callback_data: `route:${ISSUE_NUMBER}:Product Design` },
                { text: '🔧 Tech Design', callback_data: `route:${ISSUE_NUMBER}:Technical Design` },
            ],
            [
                { text: '💻 Ready for Development', callback_data: `route:${ISSUE_NUMBER}:Ready for development` },
                { text: '📦 Backlog', callback_data: `route:${ISSUE_NUMBER}:Backlog` },
            ],
        ];

        await sendNotificationToOwner(message, { inlineKeyboard: buttons });

        console.log('✅ Notification sent!\n');

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('✅ Test complete!');
        console.log('\nCheck your Telegram for the routing notification.');
        console.log('Tap a button to route the item, then run the appropriate agent:');
        console.log('  - yarn agent:product-design');
        console.log('  - yarn agent:tech-design');
        console.log('  - yarn agent:implement');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
