import { createStore } from '@/client/stores';
import type { ReportType, ReportStatus } from '@/apis/reports/types';
import type { ReportsState, ReportsViewMode, ReportsSortOrder } from './types';

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

/**
 * Derived hooks for convenience
 */
export const useReportsTypeFilter = () => useReportsStore((state) => state.typeFilter);
export const useReportsStatusFilter = () => useReportsStore((state) => state.statusFilter);
export const useReportsSortOrder = () => useReportsStore((state) => state.sortOrder);
export const useReportsViewMode = () => useReportsStore((state) => state.viewMode);
export const useSetReportsTypeFilter = () => useReportsStore((state) => state.setTypeFilter);
export const useSetReportsStatusFilter = () => useReportsStore((state) => state.setStatusFilter);
export const useSetReportsSortOrder = () => useReportsStore((state) => state.setSortOrder);
export const useSetReportsViewMode = () => useReportsStore((state) => state.setViewMode);
