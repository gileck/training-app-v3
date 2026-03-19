/**
 * Migration Script: Feature Requests & Reports → Workflow Items Collection
 *
 * Migrates workflow data from feature-requests and reports collections
 * into the dedicated workflow-items collection.
 *
 * For each feature-request/report that has a githubProjectItemId (has been synced):
 * 1. Creates a workflow-item document with workflow fields, source ref, and GitHub fields
 * 2. Updates the source document's githubProjectItemId to the new workflow-item _id
 *
 * Usage:
 *   npx tsx scripts/template/migrate-workflow-items.ts [--dry-run]
 *
 * Options:
 *   --dry-run  Show what would happen without writing to MongoDB
 */

// Load env vars BEFORE any other imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const isDryRun = process.argv.includes('--dry-run');

interface MigrationStats {
    features: { total: number; migrated: number; skipped: number; errors: number };
    reports: { total: number; migrated: number; skipped: number; errors: number };
}

async function migrate() {
    const { ObjectId } = await import('mongodb');
    const featureRequestsModule = await import('../../src/server/database/collections/template/feature-requests/feature-requests');
    const reportsModule = await import('../../src/server/database/collections/template/reports/reports');
    const workflowItemsModule = await import('../../src/server/database/collections/template/workflow-items/workflow-items');

    console.log(`\n🔄 Migrating Feature Requests & Reports → Workflow Items Collection`);
    console.log(`   Mode: ${isDryRun ? '🏃 DRY RUN (no writes)' : '✍️  LIVE (writing to MongoDB)'}\n`);

    const stats: MigrationStats = {
        features: { total: 0, migrated: 0, skipped: 0, errors: 0 },
        reports: { total: 0, migrated: 0, skipped: 0, errors: 0 },
    };

    // 1. Migrate feature requests
    console.log('1. Fetching feature requests with workflow data...');
    const features = await featureRequestsModule.findByWorkflowStatus();
    stats.features.total = features.length;
    console.log(`   Found ${features.length} feature requests with workflow data\n`);

    for (const f of features) {
        const featureId = f._id.toHexString();
        const title = f.githubIssueTitle || f.title;

        try {
            // Check if already migrated (githubProjectItemId is a workflow-item ObjectId)
            if (f.githubProjectItemId && ObjectId.isValid(f.githubProjectItemId)) {
                // Check if a workflow item with this ID already exists
                const existing = await workflowItemsModule.findWorkflowItemById(f.githubProjectItemId);
                if (existing) {
                    console.log(`   ⏭️  SKIP feature "${title}" - already migrated (workflow-item: ${f.githubProjectItemId})`);
                    stats.features.skipped++;
                    continue;
                }
            }

            console.log(`   📋 Feature: "${title}" (${featureId})`);
            console.log(`      Status: ${f.workflowStatus || 'none'}, Review: ${f.workflowReviewStatus || 'none'}, Phase: ${f.implementationPhase || 'none'}`);
            console.log(`      GitHub: #${f.githubIssueNumber || 'N/A'}`);

            if (!isDryRun) {
                const now = new Date();
                const doc = await workflowItemsModule.createWorkflowItem({
                    type: 'feature',
                    title,
                    description: f.description,
                    status: f.workflowStatus || 'Backlog',
                    reviewStatus: f.workflowReviewStatus || undefined,
                    implementationPhase: f.implementationPhase || undefined,
                    sourceRef: {
                        collection: 'feature-requests',
                        id: f._id,
                    },
                    githubIssueNumber: f.githubIssueNumber,
                    githubIssueUrl: f.githubIssueUrl,
                    githubIssueTitle: f.githubIssueTitle,
                    labels: ['feature'],
                    artifacts: {}, // Initialize empty artifacts object to ensure $push operations work correctly
                    createdAt: f.createdAt || now,
                    updatedAt: now,
                });

                // Update feature request's githubProjectItemId to point to the new workflow item
                await featureRequestsModule.updateGitHubFields(featureId, {
                    githubProjectItemId: doc._id.toHexString(),
                });

                console.log(`      ✅ Created workflow-item: ${doc._id.toHexString()}`);
            } else {
                console.log(`      🏃 Would create workflow-item and update source doc`);
            }

            stats.features.migrated++;
        } catch (error) {
            console.error(`      ❌ Error migrating feature "${title}":`, error);
            stats.features.errors++;
        }
    }

    // 2. Migrate reports (bug reports)
    console.log('\n2. Fetching reports with workflow data...');
    const reports = await reportsModule.findByWorkflowStatus();
    stats.reports.total = reports.length;
    console.log(`   Found ${reports.length} reports with workflow data\n`);

    for (const r of reports) {
        const reportId = r._id.toHexString();
        const title = r.githubIssueTitle || r.description?.split('\n')[0]?.slice(0, 100) || r.errorMessage || 'Bug Report';

        try {
            // Check if already migrated
            if (r.githubProjectItemId && ObjectId.isValid(r.githubProjectItemId)) {
                const existing = await workflowItemsModule.findWorkflowItemById(r.githubProjectItemId);
                if (existing) {
                    console.log(`   ⏭️  SKIP report "${title}" - already migrated (workflow-item: ${r.githubProjectItemId})`);
                    stats.reports.skipped++;
                    continue;
                }
            }

            console.log(`   🐛 Report: "${title}" (${reportId})`);
            console.log(`      Status: ${r.workflowStatus || 'none'}, Review: ${r.workflowReviewStatus || 'none'}, Phase: ${r.implementationPhase || 'none'}`);
            console.log(`      GitHub: #${r.githubIssueNumber || 'N/A'}`);

            if (!isDryRun) {
                const now = new Date();
                const doc = await workflowItemsModule.createWorkflowItem({
                    type: 'bug',
                    title,
                    description: r.description,
                    status: r.workflowStatus || 'Backlog',
                    reviewStatus: r.workflowReviewStatus || undefined,
                    implementationPhase: r.implementationPhase || undefined,
                    sourceRef: {
                        collection: 'reports',
                        id: r._id,
                    },
                    githubIssueNumber: r.githubIssueNumber,
                    githubIssueUrl: r.githubIssueUrl,
                    githubIssueTitle: r.githubIssueTitle,
                    labels: ['bug'],
                    artifacts: {}, // Initialize empty artifacts object to ensure $push operations work correctly
                    createdAt: r.createdAt || now,
                    updatedAt: now,
                });

                // Update report's githubProjectItemId to point to the new workflow item
                await reportsModule.updateReport(reportId, {
                    githubProjectItemId: doc._id.toHexString(),
                });

                console.log(`      ✅ Created workflow-item: ${doc._id.toHexString()}`);
            } else {
                console.log(`      🏃 Would create workflow-item and update source doc`);
            }

            stats.reports.migrated++;
        } catch (error) {
            console.error(`      ❌ Error migrating report "${title}":`, error);
            stats.reports.errors++;
        }
    }

    // 3. Summary
    console.log('\n📊 Migration Summary');
    console.log('─'.repeat(50));
    console.log(`Feature Requests: ${stats.features.migrated} migrated, ${stats.features.skipped} skipped, ${stats.features.errors} errors (${stats.features.total} total)`);
    console.log(`Reports:          ${stats.reports.migrated} migrated, ${stats.reports.skipped} skipped, ${stats.reports.errors} errors (${stats.reports.total} total)`);
    console.log('─'.repeat(50));

    if (isDryRun) {
        console.log('\n🏃 This was a DRY RUN. Run without --dry-run to apply changes.\n');
    } else {
        console.log('\n✅ Migration complete!\n');
    }
}

migrate()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
