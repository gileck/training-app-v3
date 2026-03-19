/**
 * Create Command
 *
 * Creates a workflow item + GitHub issue directly, bypassing source docs.
 * Source docs (feature-requests, reports) remain for UI/Telegram intake only.
 */

import { getProjectManagementAdapter } from '@/server/template/project-management';
import { createWorkflowItem, updateWorkflowFields } from '@/server/database/collections/template/workflow-items/workflow-items';
import { STATUSES } from '@/server/template/project-management/config';
import { getRoutingStatusMap } from '@/server/template/workflow-service/constants';
import { writeLogHeader } from '@/agents/lib/logging/writer';
import { ensureArtifactComment } from '@/agents/lib/artifacts';
import { parseArgs, validateCreateArgs } from '../utils/parse-args';
import { sendItemCreatedNotification } from '@/server/template/telegram';

export interface CreateOptions {
    type: 'feature' | 'bug';
    title: string;
    description: string;
    priority?: string;
    size?: string;
    complexity?: string;
    domain?: string;
    workflowRoute?: string;
    clientPageRoute?: string;
    dryRun?: boolean;
    autoApprove?: boolean;
    createdBy?: string;
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

    const options: CreateOptions = {
        type: parsed.type as 'feature' | 'bug',
        title: parsed.title!,
        description: parsed.description!,
        priority: parsed.priority,
        size: parsed.size,
        complexity: parsed.complexity,
        domain: parsed.domain,
        workflowRoute: parsed.workflowRoute,
        clientPageRoute: parsed.clientPageRoute,
        dryRun: parsed.dryRun,
        autoApprove: parsed.autoApprove,
        createdBy: parsed.createdBy,
    };

    await createWorkflowItemDirect(options);
}

/**
 * Create a workflow item + GitHub issue directly
 */
async function createWorkflowItemDirect(options: CreateOptions): Promise<void> {
    if (options.dryRun) {
        console.log(`\nDRY RUN - Would create ${options.type}:`);
        console.log(`  Title: ${options.title}`);
        console.log(`  Description: ${options.description}`);
        console.log(`  Priority: ${options.priority || 'medium'}`);
        if (options.domain) console.log(`  Domain: ${options.domain}`);
        if (options.createdBy) console.log(`  Created By: ${options.createdBy}`);
        if (options.workflowRoute) console.log(`  Route: ${options.workflowRoute}`);
        return;
    }

    console.log(`\nCreating ${options.type}...\n`);

    // 1. Create GitHub issue
    const adapter = getProjectManagementAdapter();
    await adapter.init();

    const labels = [options.type];
    const issueBody = buildIssueBody(options);

    const issue = await adapter.createIssue(options.title, issueBody, labels);
    console.log(`  GitHub issue created: #${issue.number}`);
    console.log(`  URL: ${issue.url}`);

    // 2. Determine initial status
    let initialStatus: string = STATUSES.backlog;
    if (options.workflowRoute) {
        const statusMap = getRoutingStatusMap(options.type);
        const mapped = statusMap[options.workflowRoute];
        if (mapped) initialStatus = mapped;
    }

    // 3. Create workflow item
    const now = new Date();
    const workflowItem = await createWorkflowItem({
        type: options.type,
        title: options.title,
        description: options.description,
        status: initialStatus,
        githubIssueNumber: issue.number,
        githubIssueUrl: issue.url,
        githubIssueTitle: options.title,
        labels,
        artifacts: {},
        history: [{
            action: 'created',
            description: `Workflow item created via CLI for ${options.type}`,
            timestamp: now.toISOString(),
            actor: options.createdBy || 'cli',
        }],
        createdBy: options.createdBy,
        createdAt: now,
        updatedAt: now,
    });

    console.log(`  Workflow item created: ${workflowItem._id}`);

    // 4. Set additional fields (priority, size, complexity, domain)
    const extraFields: Parameters<typeof updateWorkflowFields>[1] = {};
    if (options.priority) extraFields.priority = options.priority as 'critical' | 'high' | 'medium' | 'low';
    if (options.size) extraFields.size = options.size as 'XS' | 'S' | 'M' | 'L' | 'XL';
    if (options.complexity) extraFields.complexity = options.complexity as 'High' | 'Medium' | 'Low';
    if (options.domain) extraFields.domain = options.domain;
    if (Object.keys(extraFields).length > 0) {
        await updateWorkflowFields(workflowItem._id, extraFields);
        console.log(`  Fields set: ${Object.entries(extraFields).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }

    // 5. Write log header
    writeLogHeader(issue.number, options.title, options.type);
    console.log(`  Log header written for issue #${issue.number}`);

    // 6. Create artifact comment on GitHub issue
    try {
        await ensureArtifactComment(adapter, issue.number);
        console.log(`  Artifact comment created`);
    } catch (error) {
        console.warn(`  Warning: Failed to create artifact comment: ${error}`);
    }

    if (options.workflowRoute) {
        console.log(`  Routed to: ${options.workflowRoute} (${initialStatus})`);
    }

    // 7. Send Telegram notification
    try {
        await sendItemCreatedNotification(
            workflowItem._id.toString(),
            options.type,
            options.title,
            { number: issue.number, url: issue.url },
            {
                priority: options.priority,
                createdBy: options.createdBy,
            }
        );
        console.log(`  Telegram notification sent`);
    } catch (error) {
        console.warn(`  Warning: Failed to send Telegram notification: ${error}`);
    }

    console.log(`\n${options.type === 'feature' ? 'Feature request' : 'Bug report'} created successfully!`);
}

/**
 * Build the GitHub issue body
 */
function buildIssueBody(options: CreateOptions): string {
    const lines: string[] = [];

    lines.push(options.description);

    if (options.priority) {
        lines.push('');
        lines.push(`**Priority:** ${options.priority}`);
    }

    if (options.domain) {
        lines.push(`**Domain:** ${options.domain}`);
    }

    if (options.createdBy) {
        lines.push(`**Created by:** ${options.createdBy}`);
    }

    if (options.clientPageRoute) {
        lines.push(`**Affected route:** ${options.clientPageRoute}`);
    }

    return lines.join('\n');
}
