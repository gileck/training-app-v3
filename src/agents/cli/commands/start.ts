/**
 * Start Command (Interactive Mode)
 *
 * Guides users through creating feature requests or bug reports interactively.
 */

import { promptSelect, promptText } from '../utils/prompts';
import { handleCreate } from './create';

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

    // 5. Ask about routing
    const routeOptions = type === 'feature'
        ? [
            { label: 'Backlog (default)', value: undefined },
            { label: 'Product Development', value: 'product-dev' },
            { label: 'Product Design', value: 'product-design' },
            { label: 'Tech Design', value: 'tech-design' },
            { label: 'Implementation', value: 'implementation' },
        ]
        : [
            { label: 'Backlog (default)', value: undefined },
            { label: 'Product Design', value: 'product-design' },
            { label: 'Tech Design', value: 'tech-design' },
            { label: 'Implementation', value: 'implementation' },
        ];

    const workflowRoute = await promptSelect<string | undefined>('Route to phase:', routeOptions);

    // Build CLI args and delegate to handleCreate
    const args: string[] = [
        '--type', type as string,
        '--title', title,
        '--description', description,
    ];
    if (priority) args.push('--priority', priority);
    if (workflowRoute) args.push('--workflow-route', workflowRoute);

    await handleCreate(args);
}
