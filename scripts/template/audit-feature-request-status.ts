#!/usr/bin/env tsx
/**
 * Audit Feature Request Status Values
 *
 * Scans MongoDB for feature requests with unsupported status values
 * and optionally migrates them to valid values.
 *
 * Usage:
 *   yarn audit-feature-status           # Report only
 *   yarn audit-feature-status --fix     # Migrate invalid values to 'new'
 *   yarn audit-feature-status --fix --target in_progress  # Migrate to specific status
 */

import '../src/agents/shared/loadEnv';
import { getDb } from '@/server/database';
import { FeatureRequestStatus } from '@/server/database/collections/feature-requests/types';

// Valid status values
const VALID_STATUSES: FeatureRequestStatus[] = ['new', 'in_progress', 'done', 'rejected'];

interface FeatureRequestRecord {
    _id: unknown;
    title: string;
    status: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface StatusCount {
    status: string;
    count: number;
    isValid: boolean;
}

async function main() {
    const args = process.argv.slice(2);
    const shouldFix = args.includes('--fix');
    const targetIndex = args.indexOf('--target');
    const targetStatus = targetIndex !== -1 ? args[targetIndex + 1] : 'new';

    // Validate target status
    if (shouldFix && !VALID_STATUSES.includes(targetStatus as FeatureRequestStatus)) {
        console.error(`\n❌ Invalid target status: "${targetStatus}"`);
        console.error(`   Valid statuses: ${VALID_STATUSES.join(', ')}`);
        process.exit(1);
    }

    console.log('\n🔍 Auditing Feature Request Status Values\n');
    console.log(`Valid statuses: ${VALID_STATUSES.join(', ')}\n`);

    try {
        const db = await getDb();
        const collection = db.collection<FeatureRequestRecord>('feature-requests');

        // Get all distinct status values with counts
        const statusAggregation = await collection.aggregate<{ _id: string; count: number }>([
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]).toArray();

        const statusCounts: StatusCount[] = statusAggregation.map((item) => ({
            status: item._id ?? '(null/undefined)',
            count: item.count,
            isValid: VALID_STATUSES.includes(item._id as FeatureRequestStatus),
        }));

        // Display status summary
        console.log('📊 Status Summary:\n');
        console.log('  Status           Count   Valid');
        console.log('  ─────────────────────────────────');

        let totalInvalid = 0;
        for (const { status, count, isValid } of statusCounts) {
            const validMark = isValid ? '✅' : '❌';
            const statusDisplay = status.padEnd(16);
            const countDisplay = count.toString().padStart(5);
            console.log(`  ${statusDisplay} ${countDisplay}   ${validMark}`);
            if (!isValid) {
                totalInvalid += count;
            }
        }
        console.log('  ─────────────────────────────────');

        // Find and list invalid records
        const invalidRecords = await collection.find({
            status: { $nin: VALID_STATUSES },
        }).toArray();

        if (invalidRecords.length === 0) {
            console.log('\n✅ All feature requests have valid status values!\n');
            process.exit(0);
        }

        console.log(`\n⚠️  Found ${totalInvalid} record(s) with invalid status values:\n`);

        // Group by status for display
        const byStatus: Record<string, FeatureRequestRecord[]> = {};
        for (const record of invalidRecords) {
            const status = record.status ?? '(null/undefined)';
            if (!byStatus[status]) {
                byStatus[status] = [];
            }
            byStatus[status].push(record);
        }

        for (const [status, records] of Object.entries(byStatus)) {
            console.log(`\n  Status: "${status}" (${records.length} record(s))`);
            console.log('  ───────────────────────────────────────────────────');
            for (const record of records) {
                const id = String(record._id);
                const title = record.title.length > 40
                    ? record.title.substring(0, 40) + '...'
                    : record.title;
                console.log(`    • [${id}] ${title}`);
            }
        }

        if (!shouldFix) {
            console.log('\n📝 To migrate invalid values, run:');
            console.log(`   yarn audit-feature-status --fix`);
            console.log(`   yarn audit-feature-status --fix --target in_progress\n`);
            console.log(`   (Default target: "new")\n`);
            process.exit(1);
        }

        // Migrate invalid records
        console.log(`\n🔧 Migrating ${invalidRecords.length} record(s) to status: "${targetStatus}"...\n`);

        const result = await collection.updateMany(
            { status: { $nin: VALID_STATUSES } },
            {
                $set: {
                    status: targetStatus,
                    updatedAt: new Date(),
                },
            }
        );

        console.log(`✅ Successfully migrated ${result.modifiedCount} record(s)\n`);

        // Verify
        const remainingInvalid = await collection.countDocuments({
            status: { $nin: VALID_STATUSES },
        });

        if (remainingInvalid === 0) {
            console.log('✅ All records now have valid status values!\n');
        } else {
            console.log(`⚠️  ${remainingInvalid} record(s) still have invalid status (unexpected)\n`);
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }

    process.exit(0);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
