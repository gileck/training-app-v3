import { MongoClient, Db } from 'mongodb';
import { appConfig } from '@/app.config';
// --- Configuration ---
// Read connection string and DB name from environment variables
// Fallback to defaults for local development if needed
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = appConfig.dbName;

// --- Connection Management (Singleton Pattern) ---
let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let clientPromise: Promise<MongoClient> | null = null;

// Internal function returning the client
async function connectClient(): Promise<MongoClient> {
    if (client) {
        return client;
    }
    if (!MONGO_URI) {
        throw new Error('MONGO_URI environment variable is not set.');
    }
    client = new MongoClient(MONGO_URI);
    console.log('Connecting client to MongoDB...');
    try {
        await client.connect();
        console.log('MongoDB client connected successfully.');
        // Setup listeners
        client.on('close', () => {
            console.log('MongoDB connection closed.');
            client = null;
            dbInstance = null;
            clientPromise = null; // Allow reconnection attempt
        });
        client.on('error', (err) => {
            console.error('MongoDB connection error:', err);
            client = null;
            dbInstance = null;
            clientPromise = null;
        });
        return client;
    } catch (error) {
        console.error('Failed to connect client to MongoDB:', error);
        client = null;
        throw error;
    }
}

/**
 * Gets the singleton MongoClient instance.
 */
function getClient(): Promise<MongoClient> {
    if (!clientPromise) {
        clientPromise = connectClient();
    }
    return clientPromise;
}

/**
 * Gets the singleton Db instance.
 * @returns {Promise<Db>} A promise that resolves with the Db instance.
 */
export async function getDb(): Promise<Db> {
    if (dbInstance) {
        return dbInstance;
    }
    // Ensure client is connected first
    const connectedClient = await getClient();
    dbInstance = connectedClient.db(DB_NAME);
    return dbInstance;
}

/**
 * Gets the singleton MongoClient instance, primarily for session management.
 * @returns {Promise<MongoClient>} A promise that resolves with the MongoClient instance.
 */
export function getMongoClient(): Promise<MongoClient> {
    return getClient(); // Reuse the internal getClient logic
}

// Optional: Graceful shutdown function (call this on app termination)
export async function closeDbConnection(): Promise<void> {
    if (client) {
        console.log('Closing MongoDB connection...');
        try {
            await client.close();
        } catch (error) {
            console.error('Error closing MongoDB connection:', error);
        }
    }
}

// Export all collections
export * from './collections'; 