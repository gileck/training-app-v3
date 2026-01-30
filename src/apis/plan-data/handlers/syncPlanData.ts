/**
 * Sync Plan Data Handler
 * 
 * Bulk upserts plan exercises and weekly progress from client.
 * This is the server-side handler for local-first sync.
 * 
 * Conflict Detection:
 * - Client sends `clientLastSyncedAt` (when it last synced from server)
 * - Server compares with `lastDataSyncedAt` (when data was last modified)
 * - If server is newer, returns conflict (unless `forceSync` is true)
 */

import {
    ApiHandlerContext,
    SyncPlanDataRequest,
    SyncPlanDataResponse,
} from '../types';
import {
    trainingPlans,
    planExercises,
    weeklyProgress,
    exerciseProgress,
} from '@/server/database';
import { toQueryId, toStringId } from '@/server/utils';
import { getDb } from '@/server/database';
import { PlanExercise } from '@/server/database/collections/planExercises/types';

export const syncPlanData = async (
    request: SyncPlanDataRequest,
    context: ApiHandlerContext
): Promise<SyncPlanDataResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.planId) {
            return { error: 'Plan ID is required' };
        }

        // Verify plan belongs to user
        const plan = await trainingPlans.findPlanById(request.planId, context.userId);
        if (!plan) {
            return { error: 'Plan not found' };
        }

        // ====================================================================
        // Conflict Detection
        // ====================================================================
        
        const serverLastSyncedAt = plan.lastDataSyncedAt ?? null;
        const clientLastSyncedAt = request.clientLastSyncedAt ?? null;
        
        // Check for conflict: server has newer data than client knows about
        // Only check if both timestamps exist and forceSync is not set
        if (
            !request.forceSync &&
            serverLastSyncedAt !== null &&
            clientLastSyncedAt !== null &&
            serverLastSyncedAt > clientLastSyncedAt
        ) {
            return {
                conflict: true,
                serverLastSyncedAt,
            };
        }

        // ====================================================================
        // Sync Exercises
        // ====================================================================
        
        // Always sync exercises - even empty array means "delete all"
        if (request.exercises) {
            await syncExercises(request.planId, request.exercises);
        }

        // ====================================================================
        // Sync Week Progress
        // ====================================================================
        
        if (request.weekProgress && Object.keys(request.weekProgress).length > 0) {
            await syncWeekProgress(request.planId, request.weekProgress);
        }

        // ====================================================================
        // Update lastDataSyncedAt
        // ====================================================================
        
        const syncedAt = Date.now();
        await trainingPlans.updateLastDataSyncedAt(request.planId, syncedAt);

        return {
            success: true,
            syncedAt: new Date(syncedAt).toISOString(),
        };
    } catch (error: unknown) {
        console.error('Sync plan data error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to sync plan data' };
    }
};

/**
 * Sync exercises using bulk upsert
 */
async function syncExercises(
    planId: string,
    exercises: SyncPlanDataRequest['exercises']
): Promise<void> {
    const db = await getDb();
    const collection = db.collection<PlanExercise>('planExercises');
    const planIdQuery = toQueryId(planId);
    const now = new Date();

    // Get existing exercises to find ones to delete
    const existingExercises = await planExercises.findExercisesByPlanId(planId);
    const existingIds = new Set(existingExercises.map((ex) => toStringId(ex._id)));
    const incomingIds = new Set(exercises.map((ex) => ex._id));

    // Build bulk operations for upserts
    const upsertOps = exercises.map((ex) => {
        const hasOverrides = ex.overrides && Object.keys(ex.overrides).length > 0;
        
        // Build update object - MongoDB doesn't allow $set and $unset on same field
        const updateObj: Record<string, unknown> = {
            $set: {
                planId: planIdQuery,
                exerciseDefId: toQueryId(ex.exerciseDefId),
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                durationSeconds: ex.durationSeconds,
                comments: ex.comments,
                order: ex.order,
                updatedAt: now,
                // Include overrides in $set if present
                ...(hasOverrides ? { overrides: ex.overrides } : {}),
            },
            $setOnInsert: {
                createdAt: now,
            },
        };
        
        // Add $unset for overrides if not present (to clean up old data)
        if (!hasOverrides) {
            updateObj.$unset = { overrides: '' };
        }
        
        return {
            updateOne: {
                filter: { _id: toQueryId(ex._id) },
                update: updateObj,
                upsert: true,
            },
        };
    });

    // Build delete operations for exercises that no longer exist
    const deleteOps = [...existingIds]
        .filter((id) => !incomingIds.has(id))
        .map((id) => ({
            deleteOne: {
                filter: { _id: toQueryId(id), planId: planIdQuery },
            },
        }));

    // Execute bulk operations
    const allOps = [...upsertOps, ...deleteOps];
    if (allOps.length > 0) {
        await collection.bulkWrite(allOps);
    }

    // Clean up exercise progress for deleted exercises
    // TODO: [N+1 QUERY] This loop deletes exercise progress one at a time (N delete operations).
    // Fix: Add `deleteExerciseProgressByPlanExerciseIds(ids: string[])` to exerciseProgress collection.
    // This would use `collection.deleteMany({ planExerciseId: { $in: ids } })`.
    const deletedIds = [...existingIds].filter((id) => !incomingIds.has(id));
    for (const id of deletedIds) {
        await exerciseProgress.deleteExerciseProgressByPlanExerciseId(id);
    }
}

/**
 * Sync week progress using bulk upsert
 */
async function syncWeekProgress(
    planId: string,
    weekProgressData: SyncPlanDataRequest['weekProgress']
): Promise<void> {
    const db = await getDb();
    const collection = db.collection('exerciseProgress');
    const now = new Date();

    for (const [weekStr, exercisesProgress] of Object.entries(weekProgressData)) {
        const weekNumber = parseInt(weekStr, 10);
        
        // Get or create weekly progress record for this week
        const weeklyProgressRecord = await weeklyProgress.findOrCreateWeeklyProgress(
            planId,
            weekNumber
        );
        const weeklyProgressId = toQueryId(toStringId(weeklyProgressRecord._id));

        // Build bulk operations for this week's exercise progress
        const bulkOps = Object.entries(exercisesProgress).map(([planExerciseId, progress]) => ({
            updateOne: {
                filter: {
                    weeklyProgressId: weeklyProgressId,
                    planExerciseId: toQueryId(planExerciseId),
                },
                update: {
                    $set: {
                        setsCompleted: progress.setsCompleted,
                        isDone: progress.isDone,
                        updatedAt: now,
                    },
                },
                upsert: true,
            },
        }));

        if (bulkOps.length > 0) {
            await collection.bulkWrite(bulkOps);
        }
    }
}
