import type {
    ReportClient,
    ReportType,
    ReportStatus,
    ReportSource,
    SessionLogEntry,
    ReportUserInfo,
    ReportBrowserInfo,
    BugCategory,
    PerformanceEntryData,
    InvestigationStatus,
    ConfidenceLevel,
    ProposedFix
} from '@/server/database/collections/template/reports/types';

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
    errorKey?: string;   // Dedup key for automatic error reporting
    apiName?: string;    // API name for API error reporting
}

export interface CreateReportResponse {
    report?: ReportClient;
    error?: string;
}

// Get reports
export interface GetReportsRequest {
    type?: ReportType;
    status?: ReportStatus;
    source?: ReportSource;
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

// Batch update status
export interface BatchUpdateStatusRequest {
    reportIds: string[];
    status: ReportStatus;
}

export interface BatchUpdateStatusResponse {
    updatedCount?: number;
    error?: string;
}

// Batch delete reports
export interface BatchDeleteReportsRequest {
    reportIds: string[];
}

export interface BatchDeleteReportsResponse {
    deletedCount?: number;
    error?: string;
}

// Update investigation
export interface UpdateInvestigationRequest {
    reportId: string;
    investigation: {
        status: InvestigationStatus;
        headline: string;
        summary: string;
        confidence: ConfidenceLevel;
        rootCause?: string;
        proposedFix?: ProposedFix;
        analysisNotes?: string;
        filesExamined: string[];
        investigatedBy: 'agent' | 'human';
    };
}

export interface UpdateInvestigationResponse {
    report?: ReportClient;
    error?: string;
}

// Approve bug report and sync to GitHub
export interface ApproveBugReportRequest {
    reportId: string;
}

export interface ApproveBugReportResponse {
    success?: boolean;
    error?: string;
    githubIssueUrl?: string;
    githubIssueNumber?: number;
    githubProjectItemId?: string;
    needsRouting?: boolean;
}

// Re-export types for convenience
export type {
    ReportClient,
    ReportType,
    ReportStatus,
    ReportSource,
    SessionLogEntry,
    ReportUserInfo,
    ReportBrowserInfo,
    InvestigationStatus,
    ConfidenceLevel,
    ProposedFix
};

