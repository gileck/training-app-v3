#!/usr/bin/env node
/**
 * Migration script to import system exercises from trainingPlanDb to the new Training App database.
 * 
 * Source: trainingPlanDb.exerciseDefinitions (99 system exercises - those without userId)
 * Target: training_app_v3_db.exerciseDefinitions
 * 
 * Schema transformations:
 * - bodyWeight -> isBodyweight (rename)
 * - static -> isStatic (rename)
 * - Add isSystem: true
 * - Keep _id (for image URL consistency)
 * 
 * Usage: node scripts/migrate-exercises.js
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
    const mongodb = require('mongodb');

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('MONGO_URI is not set. Please set it in .env file.');
    }

    // Read target dbName from app.config.js
    const configPath = path.resolve(__dirname, '..', 'src', 'app.config.js');
    const cfg = fs.readFileSync(configPath, 'utf8');
    const dbMatch = cfg.match(/dbName:\s*['\"]([^'\"]+)['\"]/);
    if (!dbMatch) throw new Error('Failed to read dbName from app.config.js');
    const targetDbName = dbMatch[1];

    const sourceDbName = 'trainingPlanDb';
    const collectionName = 'exerciseDefinitions';

    console.log(`\n🏋️ Exercise Migration Script`);
    console.log(`================================`);
    console.log(`Source: ${sourceDbName}.${collectionName}`);
    console.log(`Target: ${targetDbName}.${collectionName}\n`);

    const client = new mongodb.MongoClient(mongoUri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const sourceDb = client.db(sourceDbName);
        const targetDb = client.db(targetDbName);

        const sourceCollection = sourceDb.collection(collectionName);
        const targetCollection = targetDb.collection(collectionName);

        // Check if target already has system exercises
        const existingCount = await targetCollection.countDocuments({ isSystem: true });
        if (existingCount > 0) {
            console.log(`⚠️  Target collection already has ${existingCount} system exercises.`);
            console.log(`   Skipping migration to avoid duplicates.`);
            console.log(`   To re-run: manually delete system exercises first.\n`);
            return;
        }

        // Get all system exercises from source (those without userId field)
        console.log('📥 Fetching system exercises from source...');
        const sourceExercises = await sourceCollection.find({
            userId: { $exists: false }
        }).toArray();

        console.log(`   Found ${sourceExercises.length} system exercises\n`);

        if (sourceExercises.length === 0) {
            console.log('⚠️  No system exercises found in source. Nothing to migrate.\n');
            return;
        }

        // Transform exercises
        console.log('🔄 Transforming schema...');
        const transformedExercises = sourceExercises.map(exercise => {
            const transformed = {
                _id: exercise._id, // Keep same ID for image URL consistency
                name: exercise.name,
                imageUrl: exercise.imageUrl || '',
                primaryMuscle: exercise.primaryMuscle || '',
                secondaryMuscles: exercise.secondaryMuscles || [],
                type: exercise.type || '',
                isBodyweight: Boolean(exercise.bodyWeight), // Rename: bodyWeight -> isBodyweight
                isStatic: Boolean(exercise.static), // Rename: static -> isStatic
                isSystem: true, // Add system flag
                createdAt: exercise.createdAt || new Date(),
                updatedAt: exercise.updatedAt || new Date(),
            };
            return transformed;
        });

        // Log some stats
        const bodyweightCount = transformedExercises.filter(e => e.isBodyweight).length;
        const staticCount = transformedExercises.filter(e => e.isStatic).length;
        const types = [...new Set(transformedExercises.map(e => e.type))];
        const muscles = [...new Set(transformedExercises.map(e => e.primaryMuscle))];

        console.log(`   Bodyweight exercises: ${bodyweightCount}`);
        console.log(`   Static/timed exercises: ${staticCount}`);
        console.log(`   Exercise types: ${types.join(', ')}`);
        console.log(`   Primary muscles: ${muscles.join(', ')}\n`);

        // Insert into target
        console.log('📤 Inserting into target database...');
        const result = await targetCollection.insertMany(transformedExercises);

        console.log(`   Inserted ${result.insertedCount} exercises\n`);

        // Create indexes for better query performance
        console.log('📋 Creating indexes...');
        await targetCollection.createIndex({ isSystem: 1 });
        await targetCollection.createIndex({ userId: 1 }, { sparse: true });
        await targetCollection.createIndex({ name: 1 });
        await targetCollection.createIndex({ primaryMuscle: 1 });
        await targetCollection.createIndex({ type: 1 });
        console.log('   Created indexes on isSystem, userId, name, primaryMuscle, type\n');

        console.log('✅ Migration complete!\n');
        console.log(`   ${result.insertedCount} system exercises are now available in ${targetDbName}.\n`);

    } finally {
        await client.close().catch(() => {});
    }
}

main().catch((err) => {
    console.error('\n❌ Migration failed:', err.message || err);
    process.exit(1);
});


