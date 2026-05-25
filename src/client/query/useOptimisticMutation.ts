/**
 * useOptimisticMutation — wrapper around useMutation that bakes in the
 * optimistic-only pattern documented in:
 *   - docs/template/react-query-mutations.md
 *   - docs/template/offline-pwa-support.md
 *
 * Bakes in:
 *   1. Cancel + snapshot + rollback for every affected query key
 *   2. errorToast on failure (override or suppress via `errorMessage`)
 *   3. Defensive invalidateQueries after rollback (catches missed keys)
 *   4. onSuccess / onSettled cannot write to cache from server response
 *
 * When offline, apiClient.post returns `{}` and `mutationFn` does not throw,
 * so onError never fires — exactly as designed. The offline banner is the
 * feedback for the offline path.
 *
 * For mission-critical flows (signup, payment, onboarding) where a toast is
 * not enough, use `mutateAsync` + try/catch at the call site and open a
 * blocking failure dialog. The wrapper's default toast still fires as a
 * safety net.
 */

import { useMutation, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { errorToast } from '@/client/features/template/error-tracking/errorToast';

type AffectedKeys<TVars> = readonly QueryKey[] | ((vars: TVars) => readonly QueryKey[]);

export interface UseOptimisticMutationOptions<TData, TVars, TError = Error> {
    /** The server call. Must throw on `response.data?.error`. */
    mutationFn: (vars: TVars) => Promise<TData>;

    /**
     * Query keys this mutation affects. The wrapper will:
     *   - cancel in-flight queries for these keys before optimistic update
     *   - snapshot each key for automatic rollback
     *   - invalidate each key in `onError` as a defensive safety net
     *
     * Function form receives the mutation variables, so keys can depend on vars.
     */
    affectedKeys: AffectedKeys<TVars>;

    /**
     * Apply the optimistic cache update. Snapshot + rollback are handled by the
     * wrapper — you only need to write the new state.
     */
    applyOptimistic?: (vars: TVars, queryClient: QueryClient) => void | Promise<void>;

    /**
     * Message for the error toast. Defaults to the thrown error's message.
     * Return `null` from the function form to suppress the toast (rare —
     * reserve for mutations that have a domain-specific error UI like a
     * blocking dialog at the call site).
     */
    errorMessage?: string | ((err: TError, vars: TVars) => string | null);

    /**
     * UI side effects on error (logging, analytics, opening a dialog).
     * Rollback + invalidate + toast are handled automatically — do not
     * duplicate them here.
     */
    onError?: (err: TError, vars: TVars) => void;

    /**
     * UI side effects on success (success toast, navigation, logging).
     * NEVER call `setQueryData` here — the optimistic update in
     * `applyOptimistic` is the source of truth.
     */
    onSuccess?: (data: TData, vars: TVars) => void;
}

interface OptimisticContext {
    keys: readonly QueryKey[];
    snapshots: unknown[];
}

export function useOptimisticMutation<TData, TVars, TError = Error>(
    options: UseOptimisticMutationOptions<TData, TVars, TError>,
) {
    const queryClient = useQueryClient();

    return useMutation<TData, TError, TVars, OptimisticContext>({
        mutationFn: options.mutationFn,

        onMutate: async (vars) => {
            const keys =
                typeof options.affectedKeys === 'function'
                    ? options.affectedKeys(vars)
                    : options.affectedKeys;

            await Promise.all(keys.map((key) => queryClient.cancelQueries({ queryKey: key })));

            const snapshots = keys.map((key) => queryClient.getQueryData(key));

            await options.applyOptimistic?.(vars, queryClient);

            return { keys, snapshots };
        },

        onError: (err, vars, context) => {
            if (context) {
                context.keys.forEach((key, i) => {
                    queryClient.setQueryData(key, context.snapshots[i]);
                });
                for (const key of context.keys) {
                    void queryClient.invalidateQueries({ queryKey: key });
                }
            }

            const resolved =
                typeof options.errorMessage === 'function'
                    ? options.errorMessage(err, vars)
                    : options.errorMessage;

            if (resolved !== null) {
                const message =
                    resolved ??
                    (err instanceof Error ? err.message : 'Something went wrong');
                errorToast(message, err);
            }

            options.onError?.(err, vars);
        },

        onSuccess: options.onSuccess
            ? (data, vars) => {
                  options.onSuccess?.(data, vars);
              }
            : undefined,

        onSettled: undefined,
    });
}
