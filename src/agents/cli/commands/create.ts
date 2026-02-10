/**
 * Create Command
 *
 * Handles creation of feature requests and bug reports via CLI.
 * DB insert only — approval and routing delegated to workflow-service.
 */

import { randomBytes } from 'crypto';
import { ObjectId } from 'mongodb';
import { featureRequests, reports } from '@/server/database';
import { sendFeatureRequestNotification, sendBugReportNotification } from '@/server/telegram';
import { approveWorkflowItem } from '@/server/workflow-service';
import type { RoutingDestination } from '@/server/workflow-service';
import type { FeatureRequestPriority } from '@/server/database/collections/template/feature-requests/types';
import { parseArgs, validateCreateArgs } from '../utils/parse-args';

export interface CreateOptions {
    title: string;
    description: string;
    priority?: string;
    workflowRoute?: string;    // Workflow routing (product-dev, tech-design, etc.)
    clientPageRoute?: string;  // Affected client page route for bugs (e.g., "/settings")
    dryRun?: boolean;
    autoApprove?: boolean;
}

/**
 * Generate a secure approval token
 */
function generateApprovalToken(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Handle the create command
 */
export async function handleCreate(args: string[]): Promise<void> {
    const parsed = parseArgs(args);
    const validation = validateCreateArgs(parsed);

    if (!validation.valid) {
        console.error(`Error: ${validation.error}`);
        process.exit(1);
    }

    // --workflow-route implies --auto-approve (can't route without syncing to GitHub first)
    const autoApprove = parsed.autoApprove || !!parsed.workflowRoute;

    const options: CreateOptions = {
        title: parsed.title!,
        description: parsed.description!,
        priority: parsed.priority,
        workflowRoute: parsed.workflowRoute,
        clientPageRoute: parsed.clientPageRoute,
        dryRun: parsed.dryRun,
        autoApprove,
    };

    if (parsed.type === 'feature') {
        await createFeatureWorkflow(options);
    } else {
        await createBugWorkflow(options);
    }
}

/**
 * Create a feature request through the workflow
 */
export async function createFeatureWorkflow(options: CreateOptions): Promise<void> {
    if (options.dryRun) {
        console.log('\nDRY RUN - Would create feature request:');
        console.log(`  Title: ${options.title}`);
        console.log(`  Description: ${options.description}`);
        console.log(`  Priority: ${options.priority || 'medium'}`);
        console.log(`  Auto-approve: ${options.autoApprove ? 'yes' : 'no (sends approval notification)'}`);
        if (options.autoApprove) {
            console.log(`  Route: ${options.workflowRoute || 'Telegram (for routing decision)'}`);
        }
        return;
    }

    console.log('\nCreating feature request...\n');

    // Generate approval token for non-auto-approve flow
    const approvalToken = options.autoApprove ? undefined : generateApprovalToken();

    // 1. Create MongoDB document
    const request = await featureRequests.createFeatureRequest({
        title: options.title,
        description: options.description,
        status: options.autoApprove ? 'in_progress' : 'new',
        priority: (options.priority || 'medium') as FeatureRequestPriority,
        needsUserInput: false,
        requestedBy: new ObjectId(), // CLI-created, no user
        requestedByName: 'CLI',
        comments: [],
        approvalToken,
        source: 'cli',
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    console.log(`  MongoDB document created: ${request._id}`);

    // If not auto-approving, send approval notification and stop
    if (!options.autoApprove) {
        try {
            await sendFeatureRequestNotification(request);
            console.log(`  Telegram approval notification sent`);
        } catch (error) {
            console.warn(`  Warning: Failed to send approval notification: ${error}`);
        }
        console.log('\nFeature request created! Waiting for approval via Telegram.');
        return;
    }

    // 2. Approve via workflow-service (creates GitHub issue + logs + notifications)
    const result = await approveWorkflowItem(
        { id: request._id.toString(), type: 'feature' },
        options.workflowRoute ? { initialRoute: options.workflowRoute as RoutingDestination } : undefined
    );

    if (!result.success) {
        console.error(`  Approval failed: ${result.error}`);
        process.exit(1);
    }

    console.log(`  GitHub issue created: #${result.issueNumber}`);
    console.log(`  URL: ${result.issueUrl}`);

    if (options.workflowRoute) {
        console.log(`  Routed to: ${options.workflowRoute}`);
    } else if (result.needsRouting) {
        console.log(`  Telegram routing notification sent`);
    }

    console.log('\nFeature request created successfully!');
}

/**
 * Create a bug report through the workflow
 */
export async function createBugWorkflow(options: CreateOptions): Promise<void> {
    if (options.dryRun) {
        console.log('\nDRY RUN - Would create bug report:');
        console.log(`  Title: ${options.title}`);
        console.log(`  Description: ${options.description}`);
        console.log(`  Auto-approve: ${options.autoApprove ? 'yes' : 'no (sends approval notification)'}`);
        if (options.autoApprove) {
            console.log(`  Route: ${options.workflowRoute || 'Bug Investigation (default)'}`);
        }
        return;
    }

    console.log('\nCreating bug report...\n');

    // Generate approval token for non-auto-approve flow
    const approvalToken = options.autoApprove ? undefined : generateApprovalToken();

    // 1. Create MongoDB document
    const report = await reports.createReport({
        type: 'bug',
        status: options.autoApprove ? 'investigating' : 'new',
        description: options.description ? `${options.title}\n\n${options.description}` : options.title,
        sessionLogs: [],
        browserInfo: {
            userAgent: 'CLI',
            viewport: { width: 0, height: 0 },
            language: 'en',
        },
        route: options.clientPageRoute || '',  // Affected client route (if any)
        networkStatus: 'online',
        occurrenceCount: 1,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        approvalToken,
        source: 'cli',
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    console.log(`  MongoDB document created: ${report._id}`);

    // If not auto-approving, send approval notification and stop
    if (!options.autoApprove) {
        try {
            await sendBugReportNotification(report);
            console.log(`  Telegram approval notification sent`);
        } catch (error) {
            console.warn(`  Warning: Failed to send approval notification: ${error}`);
        }
        console.log('\nBug report created! Waiting for approval via Telegram.');
        return;
    }

    // 2. Approve via workflow-service (creates GitHub issue + logs + notifications)
    const result = await approveWorkflowItem(
        { id: report._id.toString(), type: 'bug' },
        options.workflowRoute ? { initialRoute: options.workflowRoute as RoutingDestination } : undefined
    );

    if (!result.success) {
        console.error(`  Approval failed: ${result.error}`);
        process.exit(1);
    }

    console.log(`  GitHub issue created: #${result.issueNumber}`);
    console.log(`  URL: ${result.issueUrl}`);

    if (options.workflowRoute) {
        console.log(`  Routed to: ${options.workflowRoute}`);
    } else {
        console.log(`  Auto-routed to: Bug Investigation`);
    }

    console.log('\nBug report created successfully!');
}
