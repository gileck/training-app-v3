/**
 * Client-side ID generation utility
 * 
 * Use this for optimistic creates where the client needs to generate
 * a stable ID that the server will persist.
 * 
 * @example
 * ```typescript
 * const id = generateId();
 * createMutation.mutate({ _id: id, title: 'New item' });
 * ```
 * 
 * @see docs/react-query-mutations.md for usage guidelines
 */

/**
 * Generate a unique ID for client-side entity creation.
 * 
 * Uses crypto.randomUUID() which generates a UUID v4 string.
 * This is built into all modern browsers and Node.js 19+.
 * 
 * Properties:
 * - 36 characters with hyphens (e.g., "550e8400-e29b-41d4-a716-446655440000")
 * - Extremely low collision probability (1 in 2^122)
 * - No external dependencies
 * 
 * @returns A UUID v4 string
 */
export function generateId(): string {
    return crypto.randomUUID();
}
