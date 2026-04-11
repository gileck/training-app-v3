/**
 * Exercise Migration Script
 *
 * Migrates exercises from data.json to the exerciseDefinitions collection.
 * - Only imports exercises from popularExercises.json (top 200 by usage)
 * - Downloads images from source URLs
 * - Uploads to Vercel Blob storage
 * - Transforms data to match our schema
 * - Skips duplicates (by name)
 *
 * Usage:
 *   node scripts/exercises-scripts/migrateExercises.js [--dry-run] [--limit=N] [--start=N] [--all]
 *
 * Flags:
 *   --dry-run  Preview without making changes
 *   --limit=N  Only process N exercises
 *   --start=N  Start from index N
 *   --all      Import all exercises, not just popular ones
 */

const path = require('path');
const { MongoClient } = require('mongodb');
const { put, list } = require('@vercel/blob');

// Load environment variables from .env.local (same as Next.js). Do NOT fall back
// to .env — that file contains a stale MONGO_URI pointing at an old cluster.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });

const MONGO_URI = process.env.MONGO_URI;
const BATCH_SIZE = 20;

// Load popular exercises list
const POPULAR_EXERCISES = require('./popularExercises.json');
const POPULAR_EXERCISES_SET = new Set(POPULAR_EXERCISES.map(n => n.toLowerCase()));

// Body part to type mapping
const BODY_PART_TO_TYPE = {
    'Chest': 'Upper body',
    'Back': 'Upper body',
    'Shoulders': 'Upper body',
    'Upper Arms': 'Upper body',
    'Biceps': 'Upper body',
    'Triceps': 'Upper body',
    'Forearms': 'Upper body',
    'Neck': 'Upper body',
    'Thighs': 'Lower body',
    'Hips': 'Lower body',
    'Calves': 'Lower body',
    'Quadriceps': 'Lower body',
    'Hamstrings': 'Lower body',
    'Waist': 'Core',
    'Cardio': 'Cardio',
    'Full body': 'Full body',
    'Plyometrics': 'Full body',
    'Weightlifting': 'Full body',
    'Yoga': 'Full body',
    'Stretching': 'Full body',
    '': '',
};

// Body part to primaryMuscle mapping (maps to our existing muscle names)
const BODY_PART_TO_MUSCLE = {
    'Chest': 'Chest',
    'Back': 'Back',
    'Shoulders': 'Shoulders',
    'Upper Arms': 'Biceps', // Default to Biceps
    'Biceps': 'Biceps',
    'Triceps': 'Triceps',
    'Forearms': 'Forearms',
    'Neck': 'Shoulders',
    'Thighs': 'Thighs',
    'Hips': 'Hips',
    'Calves': 'Calves',
    'Quadriceps': 'Quadriceps',
    'Hamstrings': 'Hamstrings',
    'Waist': 'Core',
    'Cardio': 'Cardio',
    'Full body': 'Core',
    'Plyometrics': 'Core',
    'Weightlifting': 'Core',
    'Yoga': 'Core',
    'Stretching': 'Core',
    '': 'Core',
};

async function downloadImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function uploadToVercel(buffer, filename, contentType) {
    const blob = await put(`exercises/${filename}`, buffer, {
        access: 'public',
        contentType,
    });
    return blob.url;
}

function getContentType(url) {
    if (url.includes('.png')) return 'image/png';
    if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
    if (url.includes('.gif')) return 'image/gif';
    if (url.includes('.webp')) return 'image/webp';
    return 'image/png'; // Default
}

function sanitizeFilename(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
}

function transformExercise(raw, bodyParts, newImageUrl) {
    // Parse body part IDs
    let bodyPartIds = [];
    try {
        bodyPartIds = JSON.parse(raw.body_part_id || '[]');
    } catch {
        bodyPartIds = [];
    }

    // Get body part names
    const bodyPartNames = bodyPartIds
        .map(id => bodyParts[parseInt(id)])
        .filter(Boolean);

    const primaryBodyPart = bodyPartNames[0] || '';
    const secondaryBodyParts = bodyPartNames.slice(1);

    // Map to our schema
    const primaryMuscle = BODY_PART_TO_MUSCLE[primaryBodyPart] || 'Core';
    const type = BODY_PART_TO_TYPE[primaryBodyPart] || '';

    // Secondary muscles from other body parts
    const secondaryMuscles = secondaryBodyParts
        .map(bp => BODY_PART_TO_MUSCLE[bp])
        .filter(Boolean)
        .filter(m => m !== primaryMuscle); // Remove duplicates

    // Determine if static (duration-based exercises)
    const isStatic = raw.exercise_type === 'duration';

    // We don't have reliable equipment data, default to false
    const isBodyweight = false;

    return {
        name: raw.name,
        imageUrl: newImageUrl,
        primaryMuscle,
        secondaryMuscles,
        type,
        isBodyweight,
        isStatic,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

// Build a lookup of existing Vercel Blob objects keyed by sanitized-name stem.
// Filenames are `{stem}-{timestamp}.{ext}`. If multiple blobs share a stem we
// keep the most recent one (by uploadedAt) so we prefer the latest upload.
async function loadExistingBlobIndex() {
    const index = new Map(); // stem -> { url, uploadedAt }
    let cursor;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const res = await list({ prefix: 'exercises/', limit: 1000, cursor });
        for (const b of res.blobs) {
            const m = b.pathname.match(/^exercises\/(.+)-(\d{10,})\.(png|jpe?g|gif|webp)$/i);
            if (!m) continue;
            const stem = m[1];
            const uploadedAt = new Date(b.uploadedAt).getTime();
            const prev = index.get(stem);
            if (!prev || uploadedAt > prev.uploadedAt) {
                index.set(stem, { url: b.url, uploadedAt });
            }
        }
        if (!res.hasMore) break;
        cursor = res.cursor;
    }
    return index;
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const importAll = args.includes('--all');
    const forceReupload = args.includes('--force-reupload');
    const limitArg = args.find(a => a.startsWith('--limit='));
    const startArg = args.find(a => a.startsWith('--start='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;
    const startIndex = startArg ? parseInt(startArg.split('=')[1]) : 0;

    console.log('=== Exercise Migration Script ===');
    console.log(`Dry run: ${dryRun}`);
    console.log(`Import all: ${importAll} (${importAll ? 'all exercises' : 'only popular list'})`);
    console.log(`Force re-upload: ${forceReupload} (${forceReupload ? 're-download & re-upload all images' : 'reuse existing Blob objects when a match is found'})`);
    console.log(`Limit: ${limit === Infinity ? 'none' : limit}`);
    console.log(`Start index: ${startIndex}`);
    console.log('');

    // Load source data
    const sourceData = require('./data.json');
    const { bodyParts, data: exercises } = sourceData;
    console.log(`Source exercises: ${exercises.length}`);
    console.log(`Popular exercises list: ${POPULAR_EXERCISES.length}`);

    // Index existing Vercel Blob uploads so we can reuse them by sanitized name.
    let blobIndex = new Map();
    if (!forceReupload) {
        console.log('Loading existing Vercel Blob index...');
        blobIndex = await loadExistingBlobIndex();
        console.log(`Existing blobs under exercises/: ${blobIndex.size} unique stems`);
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db('training_app_v3_db');
    const collection = db.collection('exerciseDefinitions');

    // Get existing exercise names
    const existingNames = new Set(
        (await collection.find({}, { projection: { name: 1 } }).toArray())
            .map(e => e.name.toLowerCase())
    );
    console.log(`Existing exercises in DB: ${existingNames.size}`);

    // Filter: popular only (unless --all), not already in DB, deduplicate by name
    const seenNames = new Set();
    const toProcess = exercises
        .filter(e => importAll || POPULAR_EXERCISES_SET.has(e.name.trim().toLowerCase()))
        .filter(e => !existingNames.has(e.name.trim().toLowerCase()))
        .filter(e => {
            const name = e.name.trim().toLowerCase();
            if (seenNames.has(name)) return false;
            seenNames.add(name);
            return true;
        })
        .slice(startIndex, startIndex + limit);

    console.log(`Exercises to process: ${toProcess.length}`);
    console.log('');

    if (dryRun) {
        console.log('DRY RUN - No changes will be made');
        let wouldReuse = 0;
        let wouldUpload = 0;
        for (const e of toProcess) {
            const stem = sanitizeFilename(e.name);
            if (!forceReupload && blobIndex.has(stem)) wouldReuse++;
            else wouldUpload++;
        }
        console.log(`Would reuse existing Blob: ${wouldReuse}`);
        console.log(`Would download + upload new: ${wouldUpload}`);
        console.log('First 5 exercises that would be processed:');
        toProcess.slice(0, 5).forEach(e => {
            const stem = sanitizeFilename(e.name);
            const tag = (!forceReupload && blobIndex.has(stem)) ? '[reuse]' : '[upload]';
            console.log(`  ${tag} ${e.name}`);
        });
        await client.close();
        return;
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let reusedCount = 0;
    let reuploadedCount = 0;
    const errors = [];
    const startTime = Date.now();

    // Process in batches
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
        const batch = toProcess.slice(i, i + BATCH_SIZE);
        const batchStart = Date.now();
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);
        console.log(`\nProcessing batch ${batchNum}/${totalBatches}...`);

        const results = await Promise.allSettled(
            batch.map(async (exercise) => {
                try {
                    const stem = sanitizeFilename(exercise.name);

                    // Try to reuse an existing blob by sanitized-name match.
                    let newImageUrl;
                    let reused = false;
                    if (!forceReupload && blobIndex.has(stem)) {
                        newImageUrl = blobIndex.get(stem).url;
                        reused = true;
                    } else {
                        // Download from source and upload a fresh blob.
                        const imageUrl = exercise.image_name;
                        if (!imageUrl || !imageUrl.startsWith('http')) {
                            throw new Error(`Invalid image URL: ${imageUrl}`);
                        }
                        const imageBuffer = await downloadImage(imageUrl);
                        const contentType = getContentType(imageUrl);
                        const ext = contentType.split('/')[1];
                        const filename = `${stem}-${Date.now()}.${ext}`;
                        newImageUrl = await uploadToVercel(imageBuffer, filename, contentType);
                    }

                    // Transform and insert
                    const transformed = transformExercise(exercise, bodyParts, newImageUrl);
                    await collection.insertOne(transformed);

                    return { name: exercise.name, success: true, reused };
                } catch (error) {
                    return { name: exercise.name, success: false, error: error.message };
                }
            })
        );

        // Process results
        for (const result of results) {
            processed++;
            if (result.status === 'fulfilled' && result.value.success) {
                succeeded++;
                if (result.value.reused) reusedCount++;
                else reuploadedCount++;
            } else {
                failed++;
                const errorInfo = result.status === 'fulfilled'
                    ? result.value
                    : { name: 'unknown', error: result.reason?.message };
                errors.push(errorInfo);
            }
        }

        const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const remaining = toProcess.length - processed;
        const avgPerExercise = (Date.now() - startTime) / processed / 1000;
        const eta = Math.ceil(remaining * avgPerExercise);
        console.log(`  Batch ${batchNum} done in ${batchTime}s | Progress: ${processed}/${toProcess.length} | Success: ${succeeded} | Failed: ${failed} | ETA: ${eta}s`);

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < toProcess.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('');
    console.log('=== Migration Complete ===');
    console.log(`Total time: ${totalTime}s`);
    console.log(`Total processed: ${processed}`);
    console.log(`Succeeded: ${succeeded} (reused existing blob: ${reusedCount}, freshly uploaded: ${reuploadedCount})`);
    console.log(`Failed: ${failed}`);

    if (errors.length > 0) {
        console.log('');
        console.log('Errors:');
        errors.slice(0, 20).forEach(e => {
            console.log(`  - ${e.name}: ${e.error}`);
        });
        if (errors.length > 20) {
            console.log(`  ... and ${errors.length - 20} more`);
        }
    }

    await client.close();
}

main().catch(console.error);