/**
 * Import canonical exercises from training-app-v2 into v3.
 *
 * Source: ../../training-app-v2/scripts/exercisesInfo.json (99 canonical entries)
 * Target: training_app_v3_db.exerciseDefinitions
 *
 * The v2 curated set contains the plain canonical exercise names (e.g. "Bench
 * Press", "Squats", "Push-ups") that are absent from v3's popularExercises.json
 * (which only has variant names like "Barbell Bench Press"). Their image URLs
 * are already live in the same Vercel Blob store used by v3, so we reuse them
 * as-is instead of re-uploading.
 *
 * Usage:
 *   node scripts/exercises-scripts/importFromV2.js [--dry-run]
 */

const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

// Match migrateExercises.js: load only .env.local (not stale .env).
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'training_app_v3_db';
const COLLECTION = 'exerciseDefinitions';

const V2_SOURCE = path.resolve(__dirname, '../../../training-app-v2/scripts/exercisesInfo.json');

function transform(v2) {
    return {
        name: v2.name,
        imageUrl: v2.image || '',
        primaryMuscle: v2.primaryMuscle || '',
        secondaryMuscles: Array.isArray(v2.secondaryMuscles) ? v2.secondaryMuscles : [],
        type: v2.category || '',
        isBodyweight: Boolean(v2.bodyWeight),
        isStatic: false,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    console.log('=== Import from v2 canonical set ===');
    console.log(`Source: ${V2_SOURCE}`);
    console.log(`Target: ${DB_NAME}.${COLLECTION}`);
    console.log(`Dry run: ${dryRun}`);
    console.log('');

    if (!fs.existsSync(V2_SOURCE)) {
        throw new Error(`v2 source file not found: ${V2_SOURCE}`);
    }
    if (!MONGO_URI) {
        throw new Error('MONGO_URI not set — check .env.local');
    }

    const v2Exercises = JSON.parse(fs.readFileSync(V2_SOURCE, 'utf8'));
    console.log(`Loaded ${v2Exercises.length} v2 exercises`);

    const client = new MongoClient(MONGO_URI);
    await client.connect();
    try {
        const coll = client.db(DB_NAME).collection(COLLECTION);

        const existing = await coll
            .find({}, { projection: { name: 1 } })
            .toArray();
        const existingNames = new Set(existing.map((e) => e.name.trim().toLowerCase()));
        console.log(`v3 currently has ${existingNames.size} exercises`);

        const toInsert = [];
        const skipped = [];
        for (const v2 of v2Exercises) {
            const key = v2.name.trim().toLowerCase();
            if (existingNames.has(key)) {
                skipped.push(v2.name);
                continue;
            }
            if (!v2.image) {
                console.warn(`  ! skipping "${v2.name}" — no image`);
                continue;
            }
            toInsert.push(transform(v2));
        }

        console.log(`To insert: ${toInsert.length}`);
        console.log(`Already present (skipped): ${skipped.length}`);
        if (skipped.length > 0) {
            console.log(`  ${skipped.join(', ')}`);
        }
        console.log('');

        if (toInsert.length === 0) {
            console.log('Nothing to insert.');
            return;
        }

        if (dryRun) {
            console.log('DRY RUN — first 10 that would be inserted:');
            toInsert.slice(0, 10).forEach((e) => {
                console.log(`  - ${e.name} | ${e.primaryMuscle} | ${e.type} | bw=${e.isBodyweight}`);
            });
            return;
        }

        const result = await coll.insertMany(toInsert, { ordered: false });
        console.log(`Inserted: ${result.insertedCount}`);

        const total = await coll.countDocuments({});
        console.log(`v3 total after import: ${total}`);
    } finally {
        await client.close();
    }
}

main().catch((err) => {
    console.error('ERR:', err.message || err);
    process.exit(1);
});
