/**
 * Generate a unique ID for optimistic creates.
 * Uses crypto.randomUUID() for stable, collision-resistant IDs.
 */
export function generateId(): string {
    return crypto.randomUUID();
}
