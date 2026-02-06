/**
 * Create Command
 *
 * Handles creation of feature requests and bug reports via CLI.
 */

import { randomBytes } from 'crypto';
import { ObjectId } from 'mongodb';
import { featureRequests, reports } from '@/server/database';
import { syncFeatureRequestToGitHub, syncBugReportToGitHub } from '@/server/github-sync';
import { sendFeatureRequestNotification, sendBugReportNotification } from '@/server/telegram';
import { getProjectManagementAdapter, STATUSES } from '@/server/project-management';
import type { FeatureRequestPriority } from '@/server/database/collections/template/feature-requests/types';
import { parseArgs, validateCreateArgs } from '../utils/parse-args';

// Map route names to status values
const ROUTE_TO_STATUS: Record<string, string> = {
    'product-dev': STATUSES.productDevelopment,
    'product-design': STATUSES.productDesign,
    'tech-design': STATUSES.techDesign,
    'implementation': STATUSES.implementation,
    'backlog': STATUSES.backlog,
};

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

    // 2. Sync to GitHub (creates issue)
    // Skip routing notification if we're auto-routing (we'll set the status directly)
    const result = await syncFeatureRequestToGitHub(request._id.toString(), {
        skipNotification: !!options.workflowRoute,
    });

    if (!result.success) {
        console.error(`  GitHub sync failed: ${result.error}`);
        process.exit(1);
    }

    console.log(`  GitHub issue created: #${result.issueNumber}`);
    console.log(`  URL: ${result.issueUrl}`);

    // 3. Route to phase if specified (otherwise Telegram routing notification was already sent)
    if (options.workflowRoute && result.projectItemId) {
        const targetStatus = ROUTE_TO_STATUS[options.workflowRoute];
        if (targetStatus) {
            const adapter = getProjectManagementAdapter();
            await adapter.init();
            await adapter.updateItemStatus(result.projectItemId, targetStatus);
            console.log(`  Routed to: ${targetStatus}`);
        }
    } else {
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
            console.log(`  Route: ${options.workflowRoute || 'Telegram (for routing decision)'}`);
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

    // 2. Sync to GitHub (creates issue)
    // Skip routing notification if we're auto-routing (we'll set the status directly)
    const result = await syncBugReportToGitHub(report._id.toString(), {
        skipNotification: !!options.workflowRoute,
    });

    if (!result.success) {
        console.error(`  GitHub sync failed: ${result.error}`);
        process.exit(1);
    }

    console.log(`  GitHub issue created: #${result.issueNumber}`);
    console.log(`  URL: ${result.issueUrl}`);

    // 3. Route to phase if specified (otherwise Telegram routing notification was already sent)
    if (options.workflowRoute && result.projectItemId) {
        const targetStatus = ROUTE_TO_STATUS[options.workflowRoute];
        if (targetStatus) {
            const adapter = getProjectManagementAdapter();
            await adapter.init();
            await adapter.updateItemStatus(result.projectItemId, targetStatus);
            console.log(`  Routed to: ${targetStatus}`);
        }
    } else {
        console.log(`  Telegram routing notification sent`);
    }

    console.log('\nBug report created successfully!');
}
