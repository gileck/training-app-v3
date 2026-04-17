import type { Collection, Document, ObjectId } from 'mongodb';

/**
 * Shared "latest updatedAt for this planId" read. Ensures the
 * `{ planId, updatedAt }` compound index exists on first call per-process
 * (idempotent, cached — cheap after the first hit).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const indexPromises = new WeakMap<Collection<any>, Promise<unknown>>();

function ensurePlanIdUpdatedAtIndex<T extends Document>(col: Collection<T>): Promise<unknown> {
    let p = indexPromises.get(col);
    if (!p) {
        p = col.createIndex({ planId: 1, updatedAt: -1 });
        indexPromises.set(col, p);
    }
    return p;
}

export async function findLatestUpdatedAtByPlanId<T extends Document>(
    col: Collection<T>,
    planIdQuery: ObjectId,
): Promise<Date | null> {
    await ensurePlanIdUpdatedAtIndex(col);
    const filter = { planId: planIdQuery } as unknown as Parameters<Collection<T>['find']>[0];
    const doc = await col
        .find(filter)
        .sort({ updatedAt: -1 })
        .limit(1)
        .project<{ updatedAt?: Date }>({ updatedAt: 1 })
        .next();
    return doc?.updatedAt ? new Date(doc.updatedAt) : null;
}
