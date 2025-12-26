/**
 * Reports feature types
 */
import type { ReportType, ReportStatus } from '@/apis/reports/types';

export type ReportsViewMode = 'individual' | 'grouped';

export type ReportsSortOrder = 'asc' | 'desc';

export interface ReportsState {
    typeFilter: ReportType | 'all';
    statusFilter: ReportStatus | 'all';
    sortOrder: ReportsSortOrder;
    viewMode: ReportsViewMode;
    setTypeFilter: (type: ReportType | 'all') => void;
    setStatusFilter: (status: ReportStatus | 'all') => void;
    setSortOrder: (order: ReportsSortOrder) => void;
    setViewMode: (mode: ReportsViewMode) => void;
}
