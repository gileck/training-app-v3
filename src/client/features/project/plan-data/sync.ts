/**
 * Plan Data Sync Module
 * 
 * Handles loading plan data from server and syncing changes back.
 * 
 * Load Flow:
 * 1. Check if localStorage has data for this plan
 * 2. If yes: use localStorage (instant), don't fetch
 * 3. If no: show loading, fetch from server, save to localStorage
 * 
 * Sync Flow:
 * 1. On any change: mark plan as dirty
 * 2. Debounced (1s): sync to server
 * 3. On error: keep trying (user is source of truth)
 * 
 * @see docs/local-first-plan-data.md for architecture details
 */

import { usePlanDataStore } from './store';
import { useWorkoutStore } from '@/client/features/project/workout/store';
import type { PlanData, PlanExerciseWithDefinition, ExerciseProgress } from './types';
import type {
    SyncPlanDataResponse,
    GetPlanVersionResponse,
} from '@/apis/project/plan-data/types';
import {
    API_SYNC_PLAN_DATA,
    API_GET_PLAN_VERSION,
} from '@/apis/project/plan-data';
import { listPlanExercises } from '@/apis/project/plan-exercises/client';
import { getWeekProgress } from '@/apis/project/weekly-progress/client';
import { getQueryClient } from '@/client/query';
import apiClient from '@/client/utils/apiClient';

// ============================================================================
// Constants
// ============================================================================

const SYNC_DEBOUNCE_MS = 1000;

// Clock-skew grace window between client `Date.now()` and server `updatedAt`.
const STALENESS_SKEW_MS = 2_000;
// Minimum interval between staleness checks for a given plan. Stops
// focus+visibilitychange double-fires (and other rapid re-triggers) from
// pounding the server.
const STALENESS_CHECK_COOLDOWN_MS = 5_000;

// ============================================================================
// Debounce tracking
// ============================================================================

const syncTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};
const syncInProgress: Record<string, boolean> = {};

// ============================================================================
// Load Plan Data
// ============================================================================

/**
 * Load plan data into the store.
 * 
 * - If localStorage has data: use it immediately (no fetch)
 * - If localStorage is empty: fetch from server, save to localStorage
 * 
 * @param planId The plan ID to load
 * @param weekNumber Current week number to load progress for
 */
export async function loadPlan(planId: string, weekNumber: number): Promise<void> {
    const store = usePlanDataStore.getState();

    if (store.plans[planId]) {
        // Local hit. Background-check whether external writers (other devices,
        // the MCP on behalf of an agent) have newer data.
        void checkServerStaleness(planId, weekNumber);
        return;
    }

    // No local data, need to fetch from server
    store._setLoading(planId, true);

    try {
        const planData = await fetchPlanFromServer(planId, weekNumber);
        store._setPlanData(planId, planData);
    } catch (error) {
        console.error('Failed to load plan from server:', error);
        // Set empty data so UI doesn't stay in loading state forever
        store._setPlanData(planId, {
            exercises: [],
            weekProgress: {},
            workoutSets: {},
            lastSyncedAt: null,
            isDirty: false,
        });
    } finally {
        store._setLoading(planId, false);
    }
}

// ============================================================================
// Staleness check (picks up external writes like the MCP server)
// ============================================================================

/**
 * Best-effort "has someone else changed this plan on the server?" check.
 * Clean local → auto `syncFromCloud`. Dirty local → flip the existing
 * conflict banner via `_setConflict`. Throttled per plan so rapid
 * focus/visibilitychange/remount sequences can't hammer the server.
 */
const lastCheckedAt: Record<string, number> = {};

async function checkServerStaleness(
    planId: string,
    weekNumber: number,
): Promise<void> {
    const store = usePlanDataStore.getState();
    const plan = store.plans[planId];
    if (!plan) return;
    if (store.syncing[planId] || store.conflicts[planId]) return;

    const now = Date.now();
    if (now - (lastCheckedAt[planId] ?? 0) < STALENESS_CHECK_COOLDOWN_MS) return;
    lastCheckedAt[planId] = now;

    let serverLastModifiedAt: number | null;
    try {
        const result = await apiClient.post<GetPlanVersionResponse, { planId: string }>(
            API_GET_PLAN_VERSION,
            { planId },
        );
        serverLastModifiedAt = result.data?.lastModifiedAt ?? null;
    } catch (error) {
        console.warn('[plan-data] staleness check failed:', error);
        return;
    }
    if (serverLastModifiedAt == null) return;

    const local = plan.lastSyncedAt ?? 0;
    if (serverLastModifiedAt <= local + STALENESS_SKEW_MS) return;

    if (plan.isDirty) {
        store._setConflict(planId, serverLastModifiedAt);
        return;
    }

    try {
        await syncFromCloud(planId, weekNumber);
    } catch (error) {
        console.warn('[plan-data] auto sync-from-cloud failed:', error);
    }
}

/**
 * Fetch plan data from server (exercises + week progress)
 */
async function fetchPlanFromServer(planId: string, weekNumber: number): Promise<PlanData> {
    // Fetch exercises and week progress in parallel
    const [exercisesResult, weekProgressResult] = await Promise.all([
        listPlanExercises({ planId }),
        getWeekProgress({ planId, weekNumber }),
    ]);
    
    // Extract exercises
    const exercises: PlanExerciseWithDefinition[] = exercisesResult.data?.exercises || [];
    
    // Extract week progress
    const weekProgress: Record<number, Record<string, ExerciseProgress>> = {};
    if (weekProgressResult.data?.exercises) {
        weekProgress[weekNumber] = {};
        for (const ex of weekProgressResult.data.exercises) {
            weekProgress[weekNumber][ex.planExerciseId] = {
                setsCompleted: ex.setsCompleted,
                isDone: ex.isDone,
                isSkipped: ex.isSkipped,
            };
        }
    }

    return {
        exercises,
        weekProgress,
        workoutSets: {},
        lastSyncedAt: Date.now(),
        isDirty: false,
    };
}

// ============================================================================
// Sync to Server
// ============================================================================

/**
 * Sync plan data to server (debounced).
 * 
 * Call this after any local change. It will debounce and batch changes.
 * 
 * @param planId The plan ID to sync
 */
export function syncPlanToServer(planId: string): void {
    // Clear any existing timeout
    if (syncTimeouts[planId]) {
        clearTimeout(syncTimeouts[planId]);
    }
    
    // Set new timeout
    syncTimeouts[planId] = setTimeout(() => {
        void doSyncToServer(planId);
    }, SYNC_DEBOUNCE_MS);
}

/**
 * Actually perform the sync to server
 * 
 * @param planId The plan ID to sync
 * @param forceSync If true, overwrite server even if conflict detected
 */
async function doSyncToServer(planId: string, forceSync: boolean = false): Promise<void> {
    // Prevent multiple simultaneous syncs
    if (syncInProgress[planId]) {
        // If already syncing, schedule another sync after current one completes
        syncPlanToServer(planId);
        return;
    }
    
    const store = usePlanDataStore.getState();
    const plan = store.plans[planId];
    
    // Don't sync if no plan, not dirty, or has conflict (unless forcing)
    if (!plan || !plan.isDirty) {
        return;
    }
    
    // If there's a conflict and not forcing, don't sync
    if (store.conflicts[planId] && !forceSync) {
        return;
    }
    
    syncInProgress[planId] = true;
    
    try {
        // Prepare sync payload with conflict detection data.
        //
        // `overrides` is ALWAYS included (as `{}` when the user has cleared
        // their customizations) so that clearing round-trips correctly:
        // the server uses `{}` as the signal to $unset the stored field.
        // Stale clients that predate this feature simply omit the key and
        // the server's `if ('overrides' in ex)` guard preserves their data.
        const payload = {
            planId,
            exercises: plan.exercises.map((ex) => ({
                _id: ex._id,
                exerciseDefId: ex.exerciseDefId,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                durationSeconds: ex.durationSeconds,
                comments: ex.comments,
                order: ex.order,
                overrides: ex.overrides ?? {},
            })),
            weekProgress: plan.weekProgress,
            clientLastSyncedAt: plan.lastSyncedAt,
            forceSync,
        };
        
        // Send to server (complex payload requires type assertion)
        const result = await apiClient.post<SyncPlanDataResponse, typeof payload>(
            API_SYNC_PLAN_DATA, 
            payload
        );
        
        // Check for conflict
        if (result.data?.conflict && result.data.serverLastSyncedAt) {
            console.warn('Sync conflict detected - server has newer data');
            store._setConflict(planId, result.data.serverLastSyncedAt);
            return;
        }
        
        // Check for errors (but don't throw - local is source of truth)
        if (result.data?.error) {
            console.error('Sync to server failed:', result.data.error);
            // Will retry on next change
            return;
        }
        
        // Only mark synced if server confirmed success
        // When offline, result.data is empty {} and request is queued for later
        if (result.data?.success) {
            store._clearConflict(planId);
            store._markSynced(planId);
        } else {
            // Offline or unexpected response - request is queued, will sync later
            console.log('Sync queued (offline or pending)');
        }
    } catch (error) {
        console.error('Sync to server error:', error);
        // Will retry on next change
    } finally {
        syncInProgress[planId] = false;
    }
}

/**
 * Force sync to server, overwriting any server changes.
 * 
 * Use this when user explicitly chooses to keep their local changes
 * despite server having newer data.
 * 
 * @param planId The plan ID to sync
 */
export async function forceSyncToServer(planId: string): Promise<void> {
    const store = usePlanDataStore.getState();
    const plan = store.plans[planId];
    
    if (!plan) {
        return;
    }
    
    // Mark as dirty to ensure it syncs
    if (!plan.isDirty) {
        store._markDirty(planId);
    }
    
    // Force sync immediately (bypass debounce)
    await doSyncToServer(planId, true);
}

// ============================================================================
// Sync from Cloud (Manual)
// ============================================================================

/**
 * Force sync from cloud, replacing local data.
 * 
 * This is a destructive operation - local changes will be lost.
 * Show a confirmation dialog before calling this.
 * Also clears any conflict state.
 * 
 * Note: Only the specified week's progress is fetched. Progress for other weeks
 * is preserved from local storage to avoid data loss.
 * 
 * @param planId The plan ID to sync
 * @param weekNumber Current week number to load progress for
 */
export async function syncFromCloud(planId: string, weekNumber: number): Promise<void> {
    const store = usePlanDataStore.getState();
    
    store._setSyncing(planId, true);
    
    try {
        // Preserve local progress for other weeks (we only fetch specified week)
        const existingPlan = store.plans[planId];
        const preservedWeekProgress: Record<number, Record<string, ExerciseProgress>> = {};
        
        if (existingPlan?.weekProgress) {
            for (const [week, progress] of Object.entries(existingPlan.weekProgress)) {
                const weekNum = parseInt(week, 10);
                // Keep progress for weeks OTHER than the one we're fetching
                if (weekNum !== weekNumber) {
                    preservedWeekProgress[weekNum] = progress;
                }
            }
        }
        
        // Clear conflict state
        store._clearConflict(planId);
        
        // Fetch fresh from server
        const planData = await fetchPlanFromServer(planId, weekNumber);
        
        // Merge preserved progress with fetched progress
        const mergedWeekProgress = {
            ...preservedWeekProgress,
            ...planData.weekProgress,
        };
        
        // Save to store (which persists to localStorage)
        store._setPlanData(planId, {
            ...planData,
            weekProgress: mergedWeekProgress,
        });

        // Notes live outside the Zustand store (React Query-owned). Mark them
        // stale so any mounted ExerciseDetails refetches; unmounted keys
        // refetch on next access per React Query's rules.
        getQueryClient().invalidateQueries({ queryKey: ['exercise-notes', planId] });
    } catch (error) {
        console.error('Failed to sync from cloud:', error);
        throw error;
    } finally {
        store._setSyncing(planId, false);
    }
}

// ============================================================================
// Load Week Progress (Incremental)
// ============================================================================

/**
 * Load week progress for a specific week.
 * 
 * Used when user navigates to a different week.
 * Only fetches if we don't have data for that week.
 * 
 * @param planId The plan ID
 * @param weekNumber The week to load
 */
export async function loadWeekProgress(planId: string, weekNumber: number): Promise<void> {
    const store = usePlanDataStore.getState();
    const plan = store.plans[planId];
    
    // If we already have data for this week, skip
    if (plan?.weekProgress[weekNumber]) {
        return;
    }
    
    try {
        const result = await getWeekProgress({ planId, weekNumber });
        
        if (result.data?.exercises) {
            const weekProgressForWeek: Record<string, ExerciseProgress> = {};
            for (const ex of result.data.exercises) {
                weekProgressForWeek[ex.planExerciseId] = {
                    setsCompleted: ex.setsCompleted,
                    isDone: ex.isDone,
                    isSkipped: ex.isSkipped,
                };
            }
            
            // Update store with new week data
            const currentPlan = store.plans[planId];
            if (currentPlan) {
                store._setPlanData(planId, {
                    ...currentPlan,
                    weekProgress: {
                        ...currentPlan.weekProgress,
                        [weekNumber]: weekProgressForWeek,
                    },
                });
            }
        }
    } catch (error) {
        console.error('Failed to load week progress:', error);
        // Don't throw - user can retry
    }
}

// ============================================================================
// Subscribe to Changes (Alternative Pattern)
// ============================================================================

/**
 * Re-runs the staleness check on tab focus / visibility-visible for the
 * currently-active plan (only). Other cached plans — including ones deleted
 * on the server — aren't checked, which prevents phantom localStorage entries
 * from spamming the server on every focus event.
 */
export function startPlanStalenessWatcher(): () => void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return () => undefined;
    }

    const recheck = () => {
        const { plans } = usePlanDataStore.getState();
        const { activePlanId, currentWeek } = useWorkoutStore.getState();
        if (!activePlanId || !plans[activePlanId]) return;
        void checkServerStaleness(activePlanId, currentWeek);
    };

    const onVisibility = () => {
        if (document.visibilityState === 'visible') recheck();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', recheck);

    return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('focus', recheck);
    };
}
