import { createStore } from '@/client/stores';

interface RpcConnectionTokenState {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

/**
 * Per-connection RPC bearer token, returned by the server on Connect and
 * sent as `X-RPC-Connection-Token` on every subsequent API call. Persisted
 * in localStorage so it survives reloads but is bound to the specific
 * device/browser that received the approval.
 */
export const useRpcConnectionTokenStore = createStore<RpcConnectionTokenState>({
  key: 'rpc-connection-token',
  label: 'RPC Connection Token',
  creator: (set) => ({
    token: null,
    setToken: (token) => set({ token }),
    clearToken: () => set({ token: null }),
  }),
  persistOptions: {
    partialize: (state) => ({ token: state.token }),
  },
});

/** Sync accessor for code outside React (e.g., apiClient). */
export function getRpcConnectionToken(): string | null {
  return useRpcConnectionTokenStore.getState().token;
}
