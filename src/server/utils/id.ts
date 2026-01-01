import { ObjectId } from 'mongodb';

/**
 * Server-side ID utilities for handling both MongoDB ObjectIds and client-generated UUIDs.
 * 
 * This app supports two ID formats:
 * - Legacy: MongoDB ObjectId (24 hex chars, e.g., "507f1f77bcf86cd799439011")
 * - New: Client-generated UUID (36 chars with hyphens, e.g., "550e8400-e29b-41d4-a716-446655440000")
 * 
 * These utilities help query and convert between formats seamlessly.
 * 
 * @see docs/react-query-mutations.md for client-side ID generation guidelines
 */

/**
 * Check if a string is a valid MongoDB ObjectId format (24 hex chars)
 * 
 * @example
 * isObjectIdFormat("507f1f77bcf86cd799439011") // true
 * isObjectIdFormat("550e8400-e29b-41d4-a716-446655440000") // false
 */
export function isObjectIdFormat(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Check if a string is a valid UUID format
 * 
 * @example
 * isUuidFormat("550e8400-e29b-41d4-a716-446655440000") // true
 * isUuidFormat("507f1f77bcf86cd799439011") // false
 */
export function isUuidFormat(id: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
}

/**
 * Convert string ID to appropriate MongoDB query format.
 * Returns ObjectId for legacy IDs, string for UUIDs.
 * 
 * Use this when querying MongoDB with IDs that could be either format.
 * 
 * @example
 * // For ObjectId format
 * toQueryId("507f1f77bcf86cd799439011") // ObjectId("507f1f77bcf86cd799439011")
 * 
 * // For UUID format
 * toQueryId("550e8400-e29b-41d4-a716-446655440000") // "550e8400-e29b-41d4-a716-446655440000"
 */
export function toQueryId(id: string): ObjectId | string {
    return isObjectIdFormat(id) ? new ObjectId(id) : id;
}

/**
 * Convert ID to string format for API responses.
 * Handles both ObjectId and string IDs.
 * 
 * @example
 * toStringId(new ObjectId("507f1f77bcf86cd799439011")) // "507f1f77bcf86cd799439011"
 * toStringId("550e8400-e29b-41d4-a716-446655440000") // "550e8400-e29b-41d4-a716-446655440000"
 */
export function toStringId(id: ObjectId | string): string {
    return typeof id === 'string' ? id : id.toHexString();
}

/**
 * Create an ObjectId from a string, or return the string if it's a UUID.
 * Useful when inserting documents that may have client-generated IDs.
 * 
 * @example
 * // For ObjectId format - converts to ObjectId
 * toDocumentId("507f1f77bcf86cd799439011") // ObjectId("507f1f77bcf86cd799439011")
 * 
 * // For UUID format - returns as string (will be stored as string _id)
 * toDocumentId("550e8400-e29b-41d4-a716-446655440000") // "550e8400-e29b-41d4-a716-446655440000"
 */
export function toDocumentId(id: string): ObjectId | string {
    return isObjectIdFormat(id) ? new ObjectId(id) : id;
}
