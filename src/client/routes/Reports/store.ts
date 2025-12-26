import { createStore } from '@/client/stores';
import type { ReportType, ReportStatus } from '@/apis/reports/types';

/**
 * Reports page types
 */
export type ReportsViewMode = 'individual' | 'grouped';

export type ReportsSortOrder = 'asc' | 'desc';

interface ReportsState {
    typeFilter: ReportType | 'all';
    statusFilter: ReportStatus | 'all';
    sortOrder: ReportsSortOrder;
    viewMode: ReportsViewMode;
    setTypeFilter: (type: ReportType | 'all') => void;
    setStatusFilter: (status: ReportStatus | 'all') => void;
    setSortOrder: (order: ReportsSortOrder) => void;
    setViewMode: (mode: ReportsViewMode) => void;
}

/**
 * Reports store - persists filters and view mode across sessions
 */
export const useReportsStore = createStore<ReportsState>({
    key: 'reports-storage',
    label: 'Reports',
    creator: (set) => ({
        typeFilter: 'all',
        statusFilter: 'all',
        sortOrder: 'desc',
        viewMode: 'individual',
        setTypeFilter: (type: ReportType | 'all') => set({ typeFilter: type }),
        setStatusFilter: (status: ReportStatus | 'all') => set({ statusFilter: status }),
        setSortOrder: (order: ReportsSortOrder) => set({ sortOrder: order }),
        setViewMode: (mode: ReportsViewMode) => set({ viewMode: mode }),
    }),
    persistOptions: {
        partialize: (state) => ({
            typeFilter: state.typeFilter,
            statusFilter: state.statusFilter,
            sortOrder: state.sortOrder,
            viewMode: state.viewMode,
        }),
    },
});
