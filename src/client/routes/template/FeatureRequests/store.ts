import { createStore } from '@/client/stores';
import type { FeatureRequestStatus, FeatureRequestPriority } from '@/apis/template/feature-requests/types';
import type { SortMode } from './utils/sortingUtils';

// Stable fallback references (prevent infinite loops in selectors)
const EMPTY_STATUS_FILTERS: string[] = [];
const EMPTY_PRIORITY_FILTERS: FeatureRequestPriority[] = [];
const EMPTY_GITHUB_FILTERS: ('has_issue' | 'no_link')[] = [];
const EMPTY_ACTIVITY_FILTERS: ('recent' | 'stale')[] = [];

/**
 * Feature Requests page filter types
 * @deprecated Use SortMode from sortingUtils instead
 */
export type FeatureRequestsSortOrder = 'asc' | 'desc';

/**
 * UI-only status filter that includes 'all' and 'active'
 * @deprecated Use statusFilters array instead
 */
export type StatusFilterOption = FeatureRequestStatus | 'all' | 'active';

/**
 * GitHub linkage filter options
 */
export type GitHubFilterOption = 'has_issue' | 'no_link';

/**
 * Activity filter options
 */
export type ActivityFilterOption = 'recent' | 'stale';

interface FeatureRequestsState {
    // Legacy single-filter state (for backward compatibility)
    statusFilter?: StatusFilterOption;
    priorityFilter?: FeatureRequestPriority | 'all';

    // New multi-filter state
    statusFilters: string[];
    priorityFilters: FeatureRequestPriority[];
    githubFilters: GitHubFilterOption[];
    activityFilters: ActivityFilterOption[];

    // Sorting
    sortOrder: FeatureRequestsSortOrder; // Legacy
    sortMode: SortMode;

    // Track if user has ever interacted with filters (to prevent forcing default on reload)
    hasInteractedWithFilters?: boolean;

    // Actions for multi-filter management
    toggleStatusFilter: (filter: string) => void;
    togglePriorityFilter: (priority: FeatureRequestPriority) => void;
    toggleGitHubFilter: (filter: GitHubFilterOption) => void;
    toggleActivityFilter: (filter: ActivityFilterOption) => void;
    clearAllFilters: () => void;

    // Sorting actions
    setSortMode: (mode: SortMode) => void;

    // Legacy actions (for backward compatibility)
    setStatusFilter?: (status: StatusFilterOption) => void;
    setPriorityFilter?: (priority: FeatureRequestPriority | 'all') => void;
    setSortOrder: (order: FeatureRequestsSortOrder) => void;
}

/**
 * Feature Requests store - persists filters across sessions
 *
 * Migrates from single-filter to multi-filter approach:
 * - Old: statusFilter: 'active', priorityFilter: 'high'
 * - New: statusFilters: ['active'], priorityFilters: ['high']
 */
export const useFeatureRequestsStore = createStore<FeatureRequestsState>({
    key: 'feature-requests-storage',
    label: 'Feature Requests',
    creator: (set, _get) => ({
        // Initialize with stable empty arrays
        statusFilters: EMPTY_STATUS_FILTERS,
        priorityFilters: EMPTY_PRIORITY_FILTERS,
        githubFilters: EMPTY_GITHUB_FILTERS,
        activityFilters: EMPTY_ACTIVITY_FILTERS,
        sortOrder: 'desc', // Legacy
        sortMode: 'smart', // Default to smart sort

        // Multi-filter toggle actions
        toggleStatusFilter: (filter: string) =>
            set((state) => {
                const isActive = state.statusFilters.includes(filter);
                return {
                    statusFilters: isActive
                        ? state.statusFilters.filter((f) => f !== filter)
                        : [...state.statusFilters, filter],
                    hasInteractedWithFilters: true,
                };
            }),

        togglePriorityFilter: (priority: FeatureRequestPriority) =>
            set((state) => {
                const isActive = state.priorityFilters.includes(priority);
                return {
                    priorityFilters: isActive
                        ? state.priorityFilters.filter((p) => p !== priority)
                        : [...state.priorityFilters, priority],
                    hasInteractedWithFilters: true,
                };
            }),

        toggleGitHubFilter: (filter: GitHubFilterOption) =>
            set((state) => {
                const isActive = state.githubFilters.includes(filter);
                return {
                    githubFilters: isActive
                        ? state.githubFilters.filter((f) => f !== filter)
                        : [...state.githubFilters, filter],
                    hasInteractedWithFilters: true,
                };
            }),

        toggleActivityFilter: (filter: ActivityFilterOption) =>
            set((state) => {
                const isActive = state.activityFilters.includes(filter);
                return {
                    activityFilters: isActive
                        ? state.activityFilters.filter((f) => f !== filter)
                        : [...state.activityFilters, filter],
                    hasInteractedWithFilters: true,
                };
            }),

        clearAllFilters: () =>
            set({
                statusFilters: [],
                priorityFilters: [],
                githubFilters: [],
                activityFilters: [],
                hasInteractedWithFilters: true,
            }),

        setSortMode: (mode: SortMode) => set({ sortMode: mode }),

        setSortOrder: (order: FeatureRequestsSortOrder) => set({ sortOrder: order }),
    }),
    persistOptions: {
        partialize: (state) => ({
            statusFilters: state.statusFilters,
            priorityFilters: state.priorityFilters,
            githubFilters: state.githubFilters,
            activityFilters: state.activityFilters,
            sortOrder: state.sortOrder,
            sortMode: state.sortMode,
            hasInteractedWithFilters: state.hasInteractedWithFilters,
        }),
        // Migration function to handle old format
        migrate: (persistedState: unknown, _version: number) => {
            const state = persistedState as Record<string, unknown>;

            // If old format detected, migrate to new format
            if (state.statusFilter && !state.statusFilters) {
                const statusFilter = state.statusFilter as StatusFilterOption;
                const statusFilters =
                    statusFilter === 'all' || !statusFilter ? [] : [statusFilter];

                const priorityFilter = state.priorityFilter as
                    | FeatureRequestPriority
                    | 'all'
                    | undefined;
                const priorityFilters =
                    !priorityFilter || priorityFilter === 'all' ? [] : [priorityFilter];

                return {
                    statusFilters,
                    priorityFilters,
                    githubFilters: [],
                    activityFilters: [],
                    sortOrder: (state.sortOrder as FeatureRequestsSortOrder) || 'desc',
                    sortMode: 'smart', // Default to smart sort
                    hasInteractedWithFilters: true, // Mark as interacted since they had old filters
                };
            }

            // Only default to 'active' filter on very first load (never interacted)
            // If user has interacted (even to clear all), respect their choice
            const hasInteracted = state.hasInteractedWithFilters === true;
            const hasStatusFilters = Array.isArray(state.statusFilters) &&
                                    state.statusFilters.length > 0;

            if (!hasInteracted && !hasStatusFilters) {
                return {
                    ...state,
                    statusFilters: ['active'], // Default to 'active' only on first load
                    sortMode: (state.sortMode as SortMode) || 'smart', // Ensure sortMode exists
                    hasInteractedWithFilters: false, // Still first load
                } as Partial<FeatureRequestsState>;
            }

            // Ensure sortMode exists for existing users
            if (!state.sortMode) {
                return {
                    ...state,
                    sortMode: 'smart' as SortMode,
                } as Partial<FeatureRequestsState>;
            }

            // Return the state as-is (it already matches the persisted structure)
            return state as Partial<FeatureRequestsState>;
        },
    },
});
