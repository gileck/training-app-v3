/**
 * Start Command (Interactive Mode)
 *
 * Guides users through creating feature requests or bug reports interactively.
 */

import { promptSelect, promptText } from '../utils/prompts';
import { createFeatureWorkflow, createBugWorkflow, CreateOptions } from './create';

/**
 * Handle the start command - interactive mode
 */
export async function handleStart(): Promise<void> {
    console.log('\n=== Agent Workflow CLI ===\n');

    // 1. Select type
    const type = await promptSelect('What would you like to create?', [
        { label: 'Feature Request', value: 'feature' },
        { label: 'Bug Report', value: 'bug' },
    ]);

    // 2. Get title
    const title = await promptText('\nTitle:');
    if (!title) {
        console.error('Error: Title is required');
        process.exit(1);
    }

    // 3. Get description
    const description = await promptText('\nDescription:');
    if (!description) {
        console.error('Error: Description is required');
        process.exit(1);
    }

    // 4. Select priority (feature requests only)
    let priority: string | undefined;
    if (type === 'feature') {
        priority = await promptSelect('Priority:', [
            { label: 'Medium (default)', value: 'medium' },
            { label: 'Low', value: 'low' },
            { label: 'High', value: 'high' },
            { label: 'Critical', value: 'critical' },
        ]);
    }

    // 5. Ask about auto-approve
    const autoApprove = await promptSelect('Approval:', [
        { label: 'Auto-approve and sync to GitHub now (Recommended)', value: true },
        { label: 'Send approval notification (wait for Telegram approval)', value: false },
    ]);

    // 6. If auto-approve, ask about routing
    let workflowRoute: string | undefined;
    if (autoApprove) {
        const routeOptions = type === 'feature'
            ? [
                { label: 'Send to Telegram for routing (default)', value: undefined },
                { label: 'Product Development', value: 'product-dev' },
                { label: 'Product Design', value: 'product-design' },
                { label: 'Tech Design', value: 'tech-design' },
                { label: 'Implementation', value: 'implementation' },
                { label: 'Backlog', value: 'backlog' },
            ]
            : [
                { label: 'Send to Telegram for routing (default)', value: undefined },
                { label: 'Product Design', value: 'product-design' },
                { label: 'Tech Design', value: 'tech-design' },
                { label: 'Implementation', value: 'implementation' },
                { label: 'Backlog', value: 'backlog' },
            ];

        workflowRoute = await promptSelect<string | undefined>('Route to phase:', routeOptions);
    }

    // Build options
    const options: CreateOptions = {
        title,
        description,
        priority,
        workflowRoute,
        autoApprove,
    };

    // Execute workflow
    if (type === 'feature') {
        await createFeatureWorkflow(options);
    } else {
        await createBugWorkflow(options);
    }
}
