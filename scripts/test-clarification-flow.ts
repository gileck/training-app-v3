#!/usr/bin/env tsx
/**
 * Test Clarification Flow
 *
 * Creates a test issue with a clarification comment and sends
 * the Telegram notification so you can test the full UI flow.
 *
 * Usage: yarn test-clarification-flow
 */

import '../src/agents/shared/loadEnv';
import { GitHubProjectsAdapter } from '../src/server/project-management/adapters/github';
import { STATUSES, REVIEW_STATUSES } from '../src/server/project-management/config';
import { notifyAgentNeedsClarification } from '../src/agents/shared/notifications';

// Test content with MULTIPLE questions, each with multiple options
const TEST_CLARIFICATION_CONTENT = `## Context
The feature request asks to "add user notifications" but doesn't specify several important details.

## Question
What notification channels should be supported initially?

## Options

✅ Option 1: Email only
   - Simpler to implement
   - Most users have email configured
   - Can add more channels later

⚠️ Option 2: Email + Push notifications
   - More complex, requires service worker setup
   - Better user experience for time-sensitive notifications
   - Higher implementation cost

⚠️ Option 3: In-app notifications only
   - Simplest to implement
   - Users must be in the app to see them
   - Good starting point for MVP

⚠️ Option 4: All channels (Email + Push + In-app)
   - Most comprehensive
   - Highest implementation effort
   - Best user experience

## Recommendation
I recommend Option 1 (Email only) because it provides reliable delivery with minimal complexity.

## How to Respond
Please respond with one of the options above.

## Context
The notification system needs a storage strategy for notification history.

## Question
How long should notifications be retained?

## Options

✅ Option 1: 30 days
   - Standard retention period
   - Balances storage with user needs
   - Easy to implement

⚠️ Option 2: 7 days
   - Minimal storage requirements
   - May frustrate users who want history
   - Good for MVP

⚠️ Option 3: 90 days
   - Longer history for reference
   - More storage needed
   - Good for business users

## Recommendation
I recommend Option 1 (30 days) as it's a common industry standard.

## How to Respond
Please respond with one of the options above.

## Context
Notifications can be triggered by various events. We need to define the initial set.

## Question
Which notification triggers should be implemented first?

## Options

✅ Option 1: Task assignments only
   - Single use case to start
   - Clear value proposition
   - Easy to test

⚠️ Option 2: Task assignments + Due date reminders
   - Two common use cases
   - More valuable for users
   - Moderate complexity

⚠️ Option 3: All triggers (assignments, due dates, comments, status changes)
   - Comprehensive from day one
   - Higher implementation effort
   - May be overwhelming for users initially

## Recommendation
I recommend Option 2 because task assignments and due date reminders are the most commonly requested features.

## How to Respond
Please respond with one of the options above.`;

async function main() {
    console.log('🧪 Testing Clarification Flow\n');

    // Initialize adapter
    console.log('📡 Initializing GitHub adapter...');
    const adapter = new GitHubProjectsAdapter();
    await adapter.init();

    // Create test issue
    console.log('📝 Creating test issue...');
    const issueResult = await adapter.createIssue(
        '[TEST] Clarification Flow Test',
        'This is a test issue to verify the clarification UI flow.\n\n**Delete this issue after testing.**'
    );
    console.log(`   Created issue #${issueResult.number}: ${issueResult.url}`);

    // Add to project
    console.log('📋 Adding to project board...');
    const itemId = await adapter.addIssueToProject(issueResult.nodeId);
    console.log(`   Added to project (item ID: ${itemId})`);

    // Set status to Tech Design (a status where clarification makes sense)
    console.log('📊 Setting status to Tech Design...');
    await adapter.updateItemStatus(itemId, STATUSES.techDesign);

    // Add clarification comment
    console.log('💬 Adding clarification comment...');
    const comment = [
        '## 🤔 Agent Needs Clarification',
        '',
        TEST_CLARIFICATION_CONTENT,
        '',
        '---',
        '_Please respond with your answer in a comment below, then click "Clarification Received" in Telegram._',
    ].join('\n');
    await adapter.addIssueComment(issueResult.number, comment);

    // Set review status to Waiting for Clarification
    console.log('⏳ Setting review status to Waiting for Clarification...');
    if (adapter.hasReviewStatusField()) {
        await adapter.updateItemReviewStatus(itemId, REVIEW_STATUSES.waitingForClarification);
    } else {
        console.log('   ⚠️  No Review Status field found - skipping');
    }

    // Send Telegram notification
    console.log('📱 Sending Telegram notification...');
    const result = await notifyAgentNeedsClarification(
        'Tech Design',
        '[TEST] Clarification Flow Test',
        issueResult.number,
        TEST_CLARIFICATION_CONTENT,
        'feature'
    );

    if (result.success) {
        console.log('   ✅ Notification sent!');
    } else {
        console.log(`   ❌ Failed: ${result.error}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test setup complete!\n');
    console.log('Next steps:');
    console.log('1. Check Telegram for the notification');
    console.log('2. Click "ANSWER QUESTIONS" button');
    console.log('3. Answer the questions in the UI');
    console.log('4. Verify the comment is posted to the issue');
    console.log(`5. Delete test issue #${issueResult.number} when done`);
    console.log('='.repeat(60));
}

main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
