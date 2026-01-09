/**
 * Training Plans route hooks
 * 
 * ============================================================================
 * OPTIMISTIC-ONLY UI PATTERN (CRITICAL - READ CAREFULLY)
 * ============================================================================
 * 
 * All mutations use OPTIMISTIC UPDATES for instant UI feedback.
 * 
 * **RULE: NEVER update UI from server responses on SUCCESS.**
 * 
 * Why? Race conditions:
 *   1. User creates plan → UI shows new plan (optimistic)
 *   2. User deletes it quickly → UI removes plan (optimistic)
 *   3. Server response for create arrives → UI would re-add deleted plan (WRONG!)
 * 
 * Solution:
 *   - `onMutate`: Update UI immediately (this IS the source of truth)
 *   - `onSuccess`: Do NOT call invalidateQueries or setQueryData
 *   - `onError`: ONLY on error - rollback to previous state
 *   - `onSettled`: NEVER refetch - optimistic state is already correct
 * 
 * The app works offline - mutations are queued and synced when online.
 * Server responses are only used to detect errors, not to update UI.
 * ============================================================================
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query/defaults';
import {
    listPlans,
    createPlan,
    updatePlan,
    deletePlan,
    setActivePlan,
    duplicatePlan,
    generatePlanFromText,
    createPlanFromText,
    exportPlan,
    matchImportedPlan,
} from '@/apis/training-plans/client';
import { listPlanExercises } from '@/apis/plan-exercises/client';
import { listExercises } from '@/apis/exercise-definitions/client';
import type { ListExercisesResponse } from '@/apis/exercise-definitions/types';
import { generateId } from '@/client/utils/id';
import type {
    ListPlansResponse,
    CreatePlanRequest,
    UpdatePlanRequest,
    DeletePlanRequest,
    SetActivePlanRequest,
    DuplicatePlanRequest,
    GeneratePlanFromTextRequest,
    GeneratePlanFromTextResponse,
    CreatePlanFromTextRequest,
    CreatePlanFromTextResponse,
    ExportPlanRequest,
    ExportPlanResponse,
    MatchImportedPlanRequest,
    MatchImportedPlanResponse,
} from '@/apis/training-plans/types';
import type { TrainingPlanClient } from '@/server/database/collections/trainingPlans/types';
import type { ListPlanExercisesResponse } from '@/apis/plan-exercises/types';

// ============================================================================
// Query Keys
// ============================================================================

export const plansQueryKey = ['training-plans'] as const;
export const planQueryKey = (planId: string) => ['training-plans', planId] as const;
export const planExercisesQueryKey = (planId: string) => ['plan-exercises', planId] as const;
export const exercisesQueryKey = ['exercise-definitions'] as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all training plans
 */
export function usePlans(options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: plansQueryKey,
        queryFn: async (): Promise<ListPlansResponse> => {
            const response = await listPlans({});
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: options?.enabled ?? true,
        ...queryDefaults,
    });
}

/**
 * Hook to fetch exercises for a plan (for exercise count)
 */
export function usePlanExercises(planId: string, options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: planExercisesQueryKey(planId),
        queryFn: async (): Promise<ListPlanExercisesResponse> => {
            const response = await listPlanExercises({ planId });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: (options?.enabled ?? true) && !!planId,
        ...queryDefaults,
    });
}

/**
 * Hook to fetch all available exercises (exercise library)
 * Used for searching exercises in the exercise resolver
 */
export function useExerciseLibrary(options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: exercisesQueryKey,
        queryFn: async (): Promise<ListExercisesResponse> => {
            const response = await listExercises({});
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: options?.enabled ?? true,
        ...queryDefaults,
    });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for creating a new training plan
 * 
 * Uses OPTIMISTIC-ONLY pattern with client-generated UUID:
 * - Client generates stable UUID that server persists
 * - UI updates immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 * - Idempotent: retries with same ID won't create duplicates
 */
export function useCreatePlan() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (data: CreatePlanRequest & { _id: string }) => {
            const response = await createPlan(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.plan;
        },
        // OPTIMISTIC UPDATE: Add plan to list immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables: CreatePlanRequest & { _id: string }) => {
            await queryClient.cancelQueries({ queryKey: plansQueryKey });
            const previousPlans = queryClient.getQueryData<ListPlansResponse>(plansQueryKey);

            // Determine if this will be the first plan (and thus active)
            const existingPlans = previousPlans?.plans || [];
            const isFirstPlan = existingPlans.length === 0;

            // Create optimistic plan with client-generated UUID
            const optimisticPlan: TrainingPlanClient = {
                _id: variables._id,
                userId: '',
                name: variables.name,
                durationWeeks: variables.durationWeeks,
                isActive: isFirstPlan,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                if (!old?.plans) return { plans: [optimisticPlan] };
                return { plans: [...old.plans, optimisticPlan] };
            });

            return { previousPlans };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousPlans) {
                queryClient.setQueryData(plansQueryKey, context.previousPlans);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });

    // Wrap mutate to inject client-generated ID
    return {
        ...mutation,
        mutate: (data: CreatePlanRequest, options?: Parameters<typeof mutation.mutate>[1]) => {
            return mutation.mutate({ ...data, _id: generateId() }, options);
        },
        mutateAsync: async (data: CreatePlanRequest, options?: Parameters<typeof mutation.mutateAsync>[1]) => {
            return mutation.mutateAsync({ ...data, _id: generateId() }, options);
        },
    };
}

/**
 * Hook for deleting a training plan
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI removes item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useDeletePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DeletePlanRequest) => {
            const response = await deletePlan(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return data.planId;
        },
        // OPTIMISTIC UPDATE: Remove plan immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: plansQueryKey });
            const previousPlans = queryClient.getQueryData<ListPlansResponse>(plansQueryKey);

            queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                if (!old?.plans) return old;
                return {
                    plans: old.plans.filter((plan) => plan._id !== variables.planId),
                };
            });

            // Also clear related queries (these won't cause race conditions)
            queryClient.removeQueries({ queryKey: planQueryKey(variables.planId) });
            queryClient.removeQueries({ queryKey: planExercisesQueryKey(variables.planId) });

            return { previousPlans };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousPlans) {
                queryClient.setQueryData(plansQueryKey, context.previousPlans);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for setting a plan as active
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates active state immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useSetActivePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: SetActivePlanRequest) => {
            const response = await setActivePlan(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.plan;
        },
        // OPTIMISTIC UPDATE: Set active immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: plansQueryKey });
            const previousPlans = queryClient.getQueryData<ListPlansResponse>(plansQueryKey);

            queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                if (!old?.plans) return old;
                return {
                    plans: old.plans.map((plan) => ({
                        ...plan,
                        isActive: plan._id === variables.planId,
                    })),
                };
            });

            return { previousPlans };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousPlans) {
                queryClient.setQueryData(plansQueryKey, context.previousPlans);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for updating a training plan
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useUpdatePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdatePlanRequest) => {
            const response = await updatePlan(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.plan;
        },
        // OPTIMISTIC UPDATE: Update plan immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: plansQueryKey });
            const previousPlans = queryClient.getQueryData<ListPlansResponse>(plansQueryKey);

            queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                if (!old?.plans) return old;
                return {
                    plans: old.plans.map((plan) =>
                        plan._id === variables.planId
                            ? {
                                  ...plan,
                                  ...(variables.name !== undefined && { name: variables.name }),
                                  ...(variables.durationWeeks !== undefined && { durationWeeks: variables.durationWeeks }),
                                  updatedAt: new Date().toISOString(),
                              }
                            : plan
                    ),
                };
            });

            return { previousPlans };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousPlans) {
                queryClient.setQueryData(plansQueryKey, context.previousPlans);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for duplicating a training plan
 * 
 * NON-OPTIMISTIC pattern:
 * Server duplicates the plan with all exercises and workouts.
 * This is complex cascade copy - we wait for server to complete.
 * Component shows loading state via isPending.
 */
export function useDuplicatePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DuplicatePlanRequest) => {
            const response = await duplicatePlan(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.plan;
        },
        // On success: insert the returned plan into cache
        onSuccess: (newPlan) => {
            if (!newPlan) return; // Guard for offline
            queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                if (!old?.plans) return { plans: [newPlan] };
                return { plans: [...old.plans, newPlan] };
            });
        },
    });
}

// ============================================================================
// AI Plan Generation Hooks
// ============================================================================

/**
 * Hook for generating a training plan preview from text using AI
 * 
 * This is NOT an optimistic mutation - it fetches a preview from the server.
 * The preview is transient and not cached in React Query.
 */
export function useGeneratePlanFromText() {
    return useMutation({
        mutationFn: async (data: GeneratePlanFromTextRequest): Promise<GeneratePlanFromTextResponse> => {
            const response = await generatePlanFromText(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
    });
}

/**
 * Hook for creating a training plan from an AI-generated draft
 * 
 * NON-OPTIMISTIC pattern:
 * AI generates complex plan structure - server creates multiple entities.
 * Component already shows AI processing state.
 */
export function useCreatePlanFromText() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreatePlanFromTextRequest): Promise<CreatePlanFromTextResponse> => {
            const response = await createPlanFromText(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // On success: insert the returned plan into cache
        onSuccess: (data) => {
            if (!data.plan) return; // Guard for offline
            queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                if (!old?.plans) return { plans: [data.plan!] };
                return { plans: [...old.plans, data.plan!] };
            });
        },
    });
}

// ============================================================================
// Plan Export/Import Hooks
// ============================================================================

/**
 * Hook for exporting a training plan to JSON
 * 
 * Returns export data - caller handles download/copy.
 */
export function useExportPlan() {
    return useMutation({
        mutationFn: async (data: ExportPlanRequest): Promise<ExportPlanResponse> => {
            const response = await exportPlan(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
    });
}

/**
 * Hook for matching imported plan exercises against the exercise library
 * 
 * Takes PlanExportData and returns a DraftPlan with matched/unresolved exercises.
 * Used by ChatGPT flow to enable exercise resolution UI.
 */
export function useMatchImportedPlan() {
    return useMutation({
        mutationFn: async (data: MatchImportedPlanRequest): Promise<MatchImportedPlanResponse> => {
            const response = await matchImportedPlan(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
    });
}
