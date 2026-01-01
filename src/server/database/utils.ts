import { ObjectId } from 'mongodb';

/**
 * Check if a string is a valid MongoDB ObjectId format (24 hex chars)
 */
export function isObjectIdFormat(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Convert string ID to appropriate MongoDB query format.
 * Returns ObjectId for legacy IDs, string for UUIDs.
 */
export function toQueryId(id: string): ObjectId | string {
    return isObjectIdFormat(id) ? new ObjectId(id) : id;
}

/**
 * Convert ID to string format for API responses.
 * Handles both ObjectId and string IDs.
 */
export function toStringId(id: ObjectId | string): string {
    return typeof id === 'string' ? id : id.toHexString();
}
