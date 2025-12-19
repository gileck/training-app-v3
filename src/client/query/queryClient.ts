import { QueryClient } from '@tanstack/react-query';

/**
 * Create and configure the React Query client
 */
export function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Data is considered fresh for 5 minutes
                staleTime: 5 * 60 * 1000,
                // Keep data in memory for 1 hour
                gcTime: 60 * 60 * 1000,
                // Retry failed requests up to 3 times
                retry: 3,
                // Exponential backoff for retries
                retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
                // Don't refetch on window focus by default (can be overridden per query)
                refetchOnWindowFocus: false,
                // Don't auto-refetch on reconnect - gives user control over when to refresh
                // Data is cached and user can manually refresh if needed
                refetchOnReconnect: false,
            },
            mutations: {
                // Retry mutations once on failure
                retry: 1,
            },
        },
    });
}

/**
 * Singleton query client instance
 * This ensures the same client is used across the app
 */
let queryClientInstance: QueryClient | null = null;

export function getQueryClient(): QueryClient {
    if (!queryClientInstance) {
        queryClientInstance = createQueryClient();
    }
    return queryClientInstance;
}

