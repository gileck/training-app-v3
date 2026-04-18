/**
 * Finds or creates a user in the database and sets LOCAL_USER_ID in .env.local
 * Usage: npx tsx scripts/template/set-local-user-id.ts [username]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env BEFORE importing connection module (reads MONGO_URI at import time)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DEFAULT_PASSWORD = '1234';
const username = process.argv[2] || 'gileck';
const envPath = path.resolve(process.cwd(), '.env.local');

async function main() {
  const { getDb, closeDbConnection } = await import('@/server/database/connection');
  const bcrypt = await import('bcryptjs');
  const db = await getDb();
  let user = await db.collection('users').findOne({ username });

  if (!user) {
    console.log(`User "${username}" not found — creating with default password...`);
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const result = await db.collection('users').insertOne({
      username,
      password_hash: passwordHash,
      createdAt: new Date(),
    });
    user = { _id: result.insertedId, username };
    console.log(`Created user "${username}"`);
  }

  const userId = user._id.toString();
  console.log(`Found user "${username}" with ID: ${userId}`);

  if (!fs.existsSync(envPath)) {
    console.error(`.env.local not found at ${envPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf-8');

  const lines = content.split('\n');
  let commented = false;
  const updatedLines = lines.map(line => {
    if (/^LOCAL_USER_ID=/.test(line.trim())) {
      commented = true;
      return `# ${line} # commented out: old user id replaced by set-local-user-id script`;
    }
    return line;
  });

  if (commented) {
    console.log(`Commented out existing LOCAL_USER_ID in .env.local`);
  }

  updatedLines.push(`LOCAL_USER_ID="${userId}"`);
  fs.writeFileSync(envPath, updatedLines.join('\n') + '\n');
  console.log(`Set LOCAL_USER_ID="${userId}" in .env.local`);

  await closeDbConnection();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
