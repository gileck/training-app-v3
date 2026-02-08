/**
 * List Workflow Items Handler
 *
 * Returns pending items (awaiting approval) and active workflow items
 * from the workflow-items collection.
 */

import { ApiHandlerContext } from '@/apis/types';
import { findFeatureRequests } from '@/server/database/collections/template/feature-requests/feature-requests';
import { findReports } from '@/server/database/collections/template/reports/reports';
import { findAllWorkflowItems } from '@/server/database/collections/template/workflow-items/workflow-items';
import { toStringId } from '@/server/utils';
import type { ListWorkflowItemsResponse, PendingItem, WorkflowItem } from '../types';

export async function listItems(
    _params: unknown,
    context: ApiHandlerContext
): Promise<ListWorkflowItemsResponse> {
    if (!context.isAdmin) {
        return { error: 'Admin access required' };
    }

    try {
        const [newFeatures, newReports, workflowDocs] = await Promise.all([
            findFeatureRequests({ status: 'new' }),
            findReports({ status: 'new' }),
            findAllWorkflowItems(),
        ]);

        // Build pending items from new feature requests and bug reports
        const pendingItems: PendingItem[] = [];

        for (const f of newFeatures) {
            // Skip features that are already in the workflow pipeline
            if (f.githubProjectItemId) continue;
            pendingItems.push({
                id: `feature:${toStringId(f._id)}`,
                type: 'feature',
                title: f.title,
                source: f.source,
                priority: f.priority,
                createdAt: new Date(f.createdAt).toISOString(),
            });
        }

        for (const r of newReports) {
            // Skip reports that are already in the workflow pipeline
            if (r.githubProjectItemId) continue;
            // Only include bug reports (not auto error reports that haven't been triaged)
            if (r.type !== 'bug') continue;
            pendingItems.push({
                id: `report:${toStringId(r._id)}`,
                type: 'bug',
                title: r.description?.split('\n')[0]?.slice(0, 100) || r.errorMessage || 'Bug Report',
                source: r.source,
                createdAt: new Date(r.createdAt).toISOString(),
            });
        }

        // Build workflow items from workflow-items collection
        const workflowItems: WorkflowItem[] = workflowDocs.map((doc) => {
            const docId = toStringId(doc._id);
            const labels = doc.labels || (doc.type === 'feature' ? ['feature'] : doc.type === 'bug' ? ['bug'] : ['task']);

            // Build composite sourceId for navigation to detail page
            let sourceId: string | null = null;
            if (doc.sourceRef) {
                const prefix = doc.sourceRef.collection === 'feature-requests' ? 'feature' : 'report';
                sourceId = `${prefix}:${toStringId(doc.sourceRef.id)}`;
            }

            return {
                id: docId,
                sourceId,
                type: doc.type,
                status: doc.status || null,
                reviewStatus: doc.reviewStatus || null,
                content: {
                    type: 'Issue' as const,
                    number: doc.githubIssueNumber,
                    title: doc.githubIssueTitle || doc.title,
                    url: doc.githubIssueUrl,
                    state: 'OPEN' as const,
                    labels,
                },
                implementationPhase: doc.implementationPhase || null,
                createdAt: new Date(doc.createdAt).toISOString(),
            };
        });

        return { pendingItems, workflowItems };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : 'Failed to list workflow items',
        };
    }
}
