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
import type { PlanData, PlanExerciseWithDefinition, ExerciseProgress } from './types';
import type { SyncPlanDataResponse } from '@/apis/plan-data/types';
import { listPlanExercises } from '@/apis/plan-exercises/client';
import { getWeekProgress } from '@/apis/weekly-progress/client';
import apiClient from '@/client/utils/apiClient';

// ============================================================================
// Constants
// ============================================================================

const SYNC_DEBOUNCE_MS = 1000;
const API_SYNC_PLAN_DATA = 'plan-data/sync';

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
    
    // Check if we already have data for this plan
    if (store.plans[planId]) {
        // Data exists in localStorage, no need to fetch
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
            lastSyncedAt: null,
            isDirty: false,
        });
    } finally {
        store._setLoading(planId, false);
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
            };
        }
    }
    
    return {
        exercises,
        weekProgress,
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
        // Prepare sync payload with conflict detection data
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
        
        // Sync successful - clear any conflict and mark as synced
        store._clearConflict(planId);
        store._markSynced(planId);
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
 * @param planId The plan ID to sync
 * @param weekNumber Current week number to load progress for
 */
export async function syncFromCloud(planId: string, weekNumber: number): Promise<void> {
    const store = usePlanDataStore.getState();
    
    store._setSyncing(planId, true);
    
    try {
        // Clear local data and conflict state first
        store._clearPlan(planId);
        store._clearConflict(planId);
        
        // Fetch fresh from server
        const planData = await fetchPlanFromServer(planId, weekNumber);
        
        // Save to store (which persists to localStorage)
        store._setPlanData(planId, planData);
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
// Subscribe to Changes
// ============================================================================

/**
 * Subscribe to store changes and trigger sync on dirty state.
 * 
 * Call this once at app initialization.
 */
export function initPlanDataSync(): () => void {
    return usePlanDataStore.subscribe(
        (state) => state.plans,
        (plans, prevPlans) => {
            // Check each plan for changes
            for (const planId of Object.keys(plans)) {
                const plan = plans[planId];
                const prevPlan = prevPlans[planId];
                
                // If plan became dirty, trigger sync
                if (plan?.isDirty && !prevPlan?.isDirty) {
                    syncPlanToServer(planId);
                }
            }
        }
    );
}
