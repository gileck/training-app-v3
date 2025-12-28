const data = require('./data.json');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGO_URI);

(async () => {
    await client.connect();
    const db = client.db('training_app_v3_db');
    const existingNames = new Set(
        (await db.collection('exerciseDefinitions').find({}, { projection: { name: 1 } }).toArray())
            .map(e => e.name.toLowerCase())
    );
    await client.close();

    // Sort by num_exercises (popularity) and filter out existing
    const sorted = data.data
        .filter(e => !existingNames.has(e.name.toLowerCase()))
        .sort((a, b) => parseInt(b.num_exercises || 0) - parseInt(a.num_exercises || 0));

    console.log('Top 25 most popular exercises (not in DB):');
    sorted.slice(0, 25).forEach((e, i) => {
        console.log(`${i + 1}. ${e.name} (${parseInt(e.num_exercises).toLocaleString()})`);
    });

    console.log('\n... popularity at different ranks:');
    console.log(`#50: ${sorted[49]?.name} (${parseInt(sorted[49]?.num_exercises).toLocaleString()})`);
    console.log(`#100: ${sorted[99]?.name} (${parseInt(sorted[99]?.num_exercises).toLocaleString()})`);
    console.log(`#200: ${sorted[199]?.name} (${parseInt(sorted[199]?.num_exercises).toLocaleString()})`);
    console.log(`#500: ${sorted[499]?.name} (${parseInt(sorted[499]?.num_exercises).toLocaleString()})`);

    // Output top 500 as JSON file
    const top500 = sorted.slice(0, 500).map(e => e.name.trim());
    require('fs').writeFileSync(
        './scripts/exercises-scripts/popularExercises.json',
        JSON.stringify(top500, null, 2)
    );
    console.log(`\nSaved ${top500.length} popular exercises to popularExercises.json`);
})();
