import { ObjectId } from 'mongodb';

/**
 * Report type - either a user-submitted bug or an automatic error
 */
export type ReportType = 'bug' | 'error';

/**
 * Bug category - regular bug or performance issue
 */
export type BugCategory = 'bug' | 'performance';

/**
 * Report status for tracking
 */
export type ReportStatus = 'new' | 'investigating' | 'resolved' | 'closed';

/**
 * Source of the report - where it was created from
 */
export type ReportSource = 'ui' | 'cli' | 'auto';

/**
 * Session log entry stored with the report
 */
export interface SessionLogEntry {
    id: string;
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    feature: string;
    message: string;
    meta?: Record<string, unknown>;
    route?: string;
    networkStatus: 'online' | 'offline';
    performanceTime?: number; // performance.now() - time from session start in ms
}

/**
 * Performance entry data for performance bug reports
 */
export interface PerformanceEntryData {
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
    initiatorType?: string;
    transferSize?: number;
    encodedBodySize?: number;
    decodedBodySize?: number;
    // Navigation timing specific (only for entryType === 'navigation')
    domainLookupStart?: number;
    domainLookupEnd?: number;
    connectStart?: number;
    connectEnd?: number;
    requestStart?: number;
    responseStart?: number;
    responseEnd?: number;
    domInteractive?: number;
    domComplete?: number;
}

/**
 * User information associated with the report
 */
export interface ReportUserInfo {
    userId?: string;
    username?: string;
    email?: string;
}

/**
 * Browser/device information
 */
export interface ReportBrowserInfo {
    userAgent: string;
    viewport: {
        width: number;
        height: number;
    };
    language: string;
}

/**
 * Investigation status - outcome of automated or manual investigation
 */
export type InvestigationStatus =
    | 'needs_info'      // Bug understood but need more reproduction details
    | 'root_cause_found' // Found root cause + actionable fix steps
    | 'complex_fix'     // Root cause found but requires architectural discussion
    | 'not_a_bug'       // Feature request, already fixed, or invalid
    | 'inconclusive';   // Investigated thoroughly but couldn't determine cause

/**
 * Fix complexity estimate
 */
export type FixComplexity = 'low' | 'medium' | 'high';

/**
 * Confidence level of the investigation
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * A proposed file change in the fix
 */
export interface ProposedFileChange {
    path: string;
    changes: string; // High-level description of what to change
}

/**
 * Proposed fix for the bug
 */
export interface ProposedFix {
    description: string;
    files: ProposedFileChange[];
    complexity: FixComplexity;
}

/**
 * Investigation result from automated or manual analysis
 */
export interface Investigation {
    status: InvestigationStatus;
    headline: string;  // Single line for list view (max ~80 chars)
    summary: string;   // Full summary paragraph
    confidence: ConfidenceLevel;
    rootCause?: string;
    proposedFix?: ProposedFix;
    analysisNotes?: string;
    filesExamined: string[];  // Files the agent looked at during investigation
    investigatedAt: Date;
    investigatedBy: 'agent' | 'human';
}

/**
 * Client-friendly investigation with string dates
 */
export interface InvestigationClient {
    status: InvestigationStatus;
    headline: string;
    summary: string;
    confidence: ConfidenceLevel;
    rootCause?: string;
    proposedFix?: ProposedFix;
    analysisNotes?: string;
    filesExamined: string[];
    investigatedAt: string;
    investigatedBy: 'agent' | 'human';
}

/**
 * Represents a bug/error report in the database
 */
export interface ReportDocument {
    _id: ObjectId;
    type: ReportType;
    status: ReportStatus;
    description?: string;
    screenshot?: string; // URL to Vercel Blob (or legacy base64 data)
    sessionLogs: SessionLogEntry[];
    userInfo?: ReportUserInfo;
    browserInfo: ReportBrowserInfo;
    route: string;
    networkStatus: 'online' | 'offline';
    stackTrace?: string;
    errorMessage?: string;
    category?: BugCategory;
    performanceEntries?: PerformanceEntryData[];
    investigation?: Investigation;
    duplicateOf?: ObjectId;  // ID of the original report this is a duplicate of

    // Deduplication tracking
    occurrenceCount: number;        // How many times this error occurred
    firstOccurrence: Date;          // When error first appeared
    lastOccurrence: Date;           // Most recent occurrence
    errorKey?: string;              // Dedup key: "api:apiName:errorMessage" or "runtime:errorMessage:stackFirst200"

    // GitHub integration fields (same as feature requests)
    githubIssueUrl?: string;
    githubIssueNumber?: number;
    githubProjectItemId?: string;
    githubIssueTitle?: string;        // Cached issue title for listItems() efficiency
    approvalToken?: string;

    // Workflow tracking (replaces GitHub Projects V2)
    workflowStatus?: string;          // 'Backlog', 'Product Design', 'Technical Design', etc.
    workflowReviewStatus?: string;    // 'Waiting for Review', 'Approved', 'Request Changes', etc.
    implementationPhase?: string;     // '1/3', '2/3', etc.

    // Source tracking
    source?: ReportSource;            // Where this was created from (ui, cli, auto)

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new report
 * Omits the _id field which is generated by MongoDB
 */
export type ReportCreate = Omit<ReportDocument, '_id'>;

/**
 * Type for updating a report
 */
export type ReportUpdate = Partial<Pick<ReportDocument,
    'status' |
    'investigation' |
    'duplicateOf' |
    'githubIssueUrl' |
    'githubIssueNumber' |
    'githubProjectItemId' |
    'githubIssueTitle' |
    'workflowStatus' |
    'workflowReviewStatus' |
    'implementationPhase' |
    'updatedAt'
>>;

/**
 * Client-friendly report with string IDs
 */
export interface ReportClient {
    _id: string;
    type: ReportType;
    status: ReportStatus;
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
    investigation?: InvestigationClient;
    duplicateOf?: string;  // ID of the original report this is a duplicate of

    // Deduplication tracking
    occurrenceCount: number;
    firstOccurrence: string;
    lastOccurrence: string;
    errorKey?: string;

    // GitHub integration fields
    githubIssueUrl?: string;
    githubIssueNumber?: number;
    githubProjectItemId?: string;
    githubIssueTitle?: string;

    // Workflow tracking
    workflowStatus?: string;
    workflowReviewStatus?: string;
    implementationPhase?: string;

    // Source tracking
    source?: ReportSource;

    createdAt: string;
    updatedAt: string;
}

/**
 * Filters for querying reports
 */
export interface ReportFilters {
    type?: ReportType;
    status?: ReportStatus;
    source?: ReportSource;
    startDate?: Date;
    endDate?: Date;
}

