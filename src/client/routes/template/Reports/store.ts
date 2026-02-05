import { createStore } from '@/client/stores';
import type { ReportType, ReportStatus } from '@/apis/template/reports/types';

/**
 * Reports page types
 */
export type ReportsViewMode = 'individual' | 'grouped';

export type ReportsSortOrder = 'asc' | 'desc';

/**
 * UI-only status filter that includes 'open' (new + investigating)
 */
export type StatusFilterOption = ReportStatus | 'all' | 'open';

interface ReportsState {
    typeFilter: ReportType | 'all';
    statusFilter: StatusFilterOption;
    sortOrder: ReportsSortOrder;
    viewMode: ReportsViewMode;
    setTypeFilter: (type: ReportType | 'all') => void;
    setStatusFilter: (status: StatusFilterOption) => void;
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
        statusFilter: 'open', // Default to 'open' (new + investigating)
        sortOrder: 'desc',
        viewMode: 'individual',
        setTypeFilter: (type: ReportType | 'all') => set({ typeFilter: type }),
        setStatusFilter: (status: StatusFilterOption) => set({ statusFilter: status }),
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
