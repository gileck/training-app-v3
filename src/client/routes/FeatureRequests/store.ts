import { createStore } from '@/client/stores';
import type { FeatureRequestStatus, FeatureRequestPriority } from '@/apis/feature-requests/types';

/**
 * Feature Requests page filter types
 */
export type FeatureRequestsSortOrder = 'asc' | 'desc';

/**
 * UI-only status filter that includes 'all' and 'active'
 */
export type StatusFilterOption = FeatureRequestStatus | 'all' | 'active';

interface FeatureRequestsState {
    statusFilter: StatusFilterOption;
    priorityFilter: FeatureRequestPriority | 'all';
    sortOrder: FeatureRequestsSortOrder;
    setStatusFilter: (status: StatusFilterOption) => void;
    setPriorityFilter: (priority: FeatureRequestPriority | 'all') => void;
    setSortOrder: (order: FeatureRequestsSortOrder) => void;
}

/**
 * Feature Requests store - persists filters across sessions
 */
export const useFeatureRequestsStore = createStore<FeatureRequestsState>({
    key: 'feature-requests-storage',
    label: 'Feature Requests',
    creator: (set) => ({
        statusFilter: 'active', // Default to 'active' (excludes done, rejected)
        priorityFilter: 'all',
        sortOrder: 'desc',
        setStatusFilter: (status: StatusFilterOption) => set({ statusFilter: status }),
        setPriorityFilter: (priority: FeatureRequestPriority | 'all') => set({ priorityFilter: priority }),
        setSortOrder: (order: FeatureRequestsSortOrder) => set({ sortOrder: order }),
    }),
    persistOptions: {
        partialize: (state) => ({
            statusFilter: state.statusFilter,
            priorityFilter: state.priorityFilter,
            sortOrder: state.sortOrder,
        }),
    },
});
