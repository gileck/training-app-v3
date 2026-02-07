/**
 * Migration Script: GitHub Projects V2 → MongoDB Workflow Fields
 *
 * Migrates workflow status data from GitHub Projects V2 to MongoDB.
 * After migration, set PROJECT_MANAGEMENT_TYPE=app to use the AppProjectAdapter.
 *
 * Usage:
 *   npx tsx scripts/template/migrate-github-projects-to-mongodb.ts [--dry-run]
 *
 * Options:
 *   --dry-run  Show what would happen without writing to MongoDB
 */

// Load env vars BEFORE any other imports (dynamic imports used below)
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const isDryRun = process.argv.includes('--dry-run');

interface MigrationStats {
    total: number;
    migrated: number;
    skipped: number;
    errors: number;
}

async function migrate() {
    // Dynamic imports so dotenv.config() runs first
    const { GitHubProjectsAdapter } = await import('../../src/server/project-management/adapters/github');
    const { IMPLEMENTATION_PHASE_FIELD } = await import('../../src/server/project-management/config');
    const featureRequests = await import('../../src/server/database/collections/template/feature-requests/feature-requests');
    const reports = await import('../../src/server/database/collections/template/reports/reports');

    console.log(`\n🔄 Migrating GitHub Projects V2 → MongoDB Workflow Fields`);
    console.log(`   Mode: ${isDryRun ? '🏃 DRY RUN (no writes)' : '✍️  LIVE (writing to MongoDB)'}\n`);

    // 1. Initialize the old GitHub Projects adapter
    console.log('1. Initializing GitHub Projects V2 adapter...');
    const adapter = new GitHubProjectsAdapter();
    await adapter.init();
    console.log('   ✅ Adapter initialized\n');

    // 2. Fetch all items from GitHub Projects
    console.log('2. Fetching items from GitHub Projects...');
    const items = await adapter.listItems({ limit: 100 });
    console.log(`   Found ${items.length} items\n`);

    const stats: MigrationStats = { total: items.length, migrated: 0, skipped: 0, errors: 0 };

    // 3. Process each item
    console.log('3. Processing items...\n');

    for (const item of items) {
        const issueNumber = item.content?.number;
        const title = item.content?.title || '(no title)';
        const status = item.status || '(no status)';
        const reviewStatus = item.reviewStatus || null;
        const labels = item.content?.labels || [];

        // Get implementation phase from field values
        const phaseField = item.fieldValues.find(fv => fv.fieldName === IMPLEMENTATION_PHASE_FIELD);
        const implementationPhase = phaseField?.value || null;

        if (!issueNumber) {
            console.log(`   ⏭️  Skipping item ${item.id} (no linked issue number)`);
            stats.skipped++;
            continue;
        }

        // Determine if this is a feature or bug
        const isBug = labels.some(l => l === 'bug' || l.startsWith('category:'));
        const itemType = isBug ? 'report' : 'feature';

        try {
            // Look up in the correct collection
            let mongoDoc;
            if (itemType === 'feature') {
                mongoDoc = await featureRequests.findByGitHubIssueNumber(issueNumber);
            } else {
                mongoDoc = await reports.findByGitHubIssueNumber(issueNumber);
            }

            if (!mongoDoc) {
                console.log(`   ⏭️  Skipping #${issueNumber} "${title}" - no MongoDB document found`);
                stats.skipped++;
                continue;
            }

            const mongoId = mongoDoc._id.toHexString();
            const compositeId = `${itemType}:${mongoId}`;

            console.log(`   📝 #${issueNumber} "${title}"`);
            console.log(`      Type: ${itemType} | Status: ${status} | Review: ${reviewStatus || '(none)'} | Phase: ${implementationPhase || '(none)'}`);
            console.log(`      Composite ID: ${compositeId}`);

            if (!isDryRun) {
                // Write workflow fields
                const workflowFields = {
                    workflowStatus: status !== '(no status)' ? status : undefined,
                    workflowReviewStatus: reviewStatus || undefined,
                    implementationPhase: implementationPhase || undefined,
                };

                if (itemType === 'feature') {
                    await featureRequests.updateWorkflowFields(mongoId, workflowFields);
                    // Update the projectItemId to composite key and cache the title
                    await featureRequests.updateGitHubFields(mongoId, {
                        githubProjectItemId: compositeId,
                        githubIssueTitle: item.content?.title,
                    });
                } else {
                    await reports.updateWorkflowFields(mongoId, workflowFields);
                    // Update the projectItemId to composite key and cache the title
                    await reports.updateReport(mongoId, {
                        githubProjectItemId: compositeId,
                        githubIssueTitle: item.content?.title,
                    });
                }

                console.log(`      ✅ Migrated`);
            } else {
                console.log(`      🏃 Would migrate (dry run)`);
            }

            stats.migrated++;
        } catch (error) {
            console.error(`   ❌ Error migrating #${issueNumber}: ${error instanceof Error ? error.message : error}`);
            stats.errors++;
        }
    }

    // 4. Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Migration Summary${isDryRun ? ' (DRY RUN)' : ''}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  Total items:  ${stats.total}`);
    console.log(`  Migrated:     ${stats.migrated}`);
    console.log(`  Skipped:      ${stats.skipped}`);
    console.log(`  Errors:       ${stats.errors}`);
    console.log(`${'='.repeat(60)}`);

    if (isDryRun) {
        console.log(`\nTo run the actual migration, remove the --dry-run flag.`);
    } else {
        console.log(`\nMigration complete! Set PROJECT_MANAGEMENT_TYPE=app in your environment.`);
    }
}

migrate()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\nFatal error:', error);
        process.exit(1);
    });
