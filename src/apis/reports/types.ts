import { 
    ReportClient, 
    ReportType, 
    ReportStatus, 
    SessionLogEntry, 
    ReportUserInfo, 
    ReportBrowserInfo,
    BugCategory,
    PerformanceEntryData
} from '@/server/database/collections/reports/types';

// Create report
export interface CreateReportRequest {
    type: ReportType;
    description?: string;
    screenshot?: string;
    sessionLogs: SessionLogEntry[];
    userInfo?: ReportUserInfo;
    browserInfo: ReportBrowserInfo;
    route: string;
    networkStatus: 'online' | 'offline';
    stackTrace?: string;
    errorMessage?: string;
    category?: BugCategory;
    performanceEntries?: PerformanceEntryData[];
}

export interface CreateReportResponse {
    report?: ReportClient;
    error?: string;
}

// Get reports
export interface GetReportsRequest {
    type?: ReportType;
    status?: ReportStatus;
    startDate?: string; // ISO string
    endDate?: string; // ISO string
    sortBy?: 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
}

export interface GetReportsResponse {
    reports?: ReportClient[];
    error?: string;
}

// Get single report
export interface GetReportRequest {
    reportId: string;
}

export interface GetReportResponse {
    report?: ReportClient;
    error?: string;
}

// Update report status
export interface UpdateReportStatusRequest {
    reportId: string;
    status: ReportStatus;
}

export interface UpdateReportStatusResponse {
    report?: ReportClient;
    error?: string;
}

// Delete report
export interface DeleteReportRequest {
    reportId: string;
}

export interface DeleteReportResponse {
    success?: boolean;
    error?: string;
}

// Delete all reports
export type DeleteAllReportsRequest = Record<string, never>;

export interface DeleteAllReportsResponse {
    deletedCount?: number;
    error?: string;
}

// Re-export types for convenience
export type { ReportClient, ReportType, ReportStatus, SessionLogEntry, ReportUserInfo, ReportBrowserInfo };

