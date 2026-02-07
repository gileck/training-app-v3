import { Collection, ObjectId, Filter, Sort } from 'mongodb';
import { getDb } from '../../../connection';
import { ReportDocument, ReportCreate, ReportUpdate, ReportFilters, ReportStatus, Investigation } from './types';

/**
 * Get a reference to the reports collection
 */
const getReportsCollection = async (): Promise<Collection<ReportDocument>> => {
    const db = await getDb();
    return db.collection<ReportDocument>('reports');
};

/**
 * Find all reports with optional filters
 * @param filters - Optional filters for type, status, date range
 * @param sortBy - Sort field (default: createdAt)
 * @param sortOrder - Sort order (default: desc)
 * @returns Array of report documents
 */
export const findReports = async (
    filters?: ReportFilters,
    sortBy: keyof ReportDocument = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
): Promise<ReportDocument[]> => {
    const collection = await getReportsCollection();
    
    const query: Filter<ReportDocument> = {};
    
    if (filters?.type) {
        query.type = filters.type;
    }
    
    if (filters?.status) {
        query.status = filters.status;
    }

    if (filters?.source) {
        query.source = filters.source;
    }

    if (filters?.startDate || filters?.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
            query.createdAt.$gte = filters.startDate;
        }
        if (filters.endDate) {
            query.createdAt.$lte = filters.endDate;
        }
    }

    const sort: Sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    return collection.find(query).sort(sort).toArray();
};

/**
 * Find a report by ID
 * @param reportId - The ID of the report
 * @returns The report document or null if not found
 */
export const findReportById = async (
    reportId: ObjectId | string
): Promise<ReportDocument | null> => {
    const collection = await getReportsCollection();
    const reportIdObj = typeof reportId === 'string' ? new ObjectId(reportId) : reportId;

    return collection.findOne({ _id: reportIdObj });
};

/**
 * Find a report by GitHub issue number
 * @param issueNumber - The GitHub issue number
 * @returns The report document or null if not found
 */
export const findByGitHubIssueNumber = async (
    issueNumber: number
): Promise<ReportDocument | null> => {
    const collection = await getReportsCollection();
    return collection.findOne({ githubIssueNumber: issueNumber });
};

/**
 * Create a new report
 * @param report - The report data to create
 * @returns The created report document
 */
export const createReport = async (report: ReportCreate): Promise<ReportDocument> => {
    const collection = await getReportsCollection();

    const result = await collection.insertOne(report as ReportDocument);

    if (!result.insertedId) {
        throw new Error('Failed to create report');
    }

    return { ...report, _id: result.insertedId } as ReportDocument;
};

/**
 * Update a report's status
 * @param reportId - The ID of the report to update
 * @param status - The new status
 * @returns The updated report document or null if not found
 */
export const updateReportStatus = async (
    reportId: ObjectId | string,
    status: ReportStatus
): Promise<ReportDocument | null> => {
    const collection = await getReportsCollection();
    const reportIdObj = typeof reportId === 'string' ? new ObjectId(reportId) : reportId;

    const update: ReportUpdate = {
        status,
        updatedAt: new Date(),
    };

    const result = await collection.findOneAndUpdate(
        { _id: reportIdObj },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Update a report with partial data
 * @param reportId - The ID of the report to update
 * @param update - Partial report data to update
 * @returns The updated report document or null if not found
 */
export const updateReport = async (
    reportId: ObjectId | string,
    update: ReportUpdate
): Promise<ReportDocument | null> => {
    const collection = await getReportsCollection();
    const reportIdObj = typeof reportId === 'string' ? new ObjectId(reportId) : reportId;

    const updateWithTimestamp: ReportUpdate = {
        ...update,
        updatedAt: new Date(),
    };

    const result = await collection.findOneAndUpdate(
        { _id: reportIdObj },
        { $set: updateWithTimestamp },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Update a report's investigation results
 * @param reportId - The ID of the report to update
 * @param investigation - The investigation data
 * @returns The updated report document or null if not found
 */
export const updateReportInvestigation = async (
    reportId: ObjectId | string,
    investigation: Investigation
): Promise<ReportDocument | null> => {
    const collection = await getReportsCollection();
    const reportIdObj = typeof reportId === 'string' ? new ObjectId(reportId) : reportId;

    const update: ReportUpdate = {
        investigation,
        status: 'investigating', // Auto-update status when investigation is added
        updatedAt: new Date(),
    };

    const result = await collection.findOneAndUpdate(
        { _id: reportIdObj },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Delete a report
 * @param reportId - The ID of the report to delete
 * @returns True if the report was deleted, false otherwise
 */
export const deleteReport = async (
    reportId: ObjectId | string
): Promise<boolean> => {
    const collection = await getReportsCollection();
    const reportIdObj = typeof reportId === 'string' ? new ObjectId(reportId) : reportId;

    const result = await collection.deleteOne({ _id: reportIdObj });
    return result.deletedCount === 1;
};

/**
 * Delete all reports
 * @returns Number of reports deleted
 */
export const deleteAllReports = async (): Promise<number> => {
    const collection = await getReportsCollection();
    const result = await collection.deleteMany({});
    return result.deletedCount;
};

/**
 * Find reports that have not been investigated yet
 * @param limit - Maximum number of reports to return (default: no limit)
 * @returns Array of uninvestigated report documents
 */
export const findUninvestigatedReports = async (
    limit?: number
): Promise<ReportDocument[]> => {
    const collection = await getReportsCollection();

    const query: Filter<ReportDocument> = {
        investigation: { $exists: false },
        duplicateOf: { $exists: false },  // Exclude duplicates
        status: 'new',
    };

    let cursor = collection.find(query).sort({ createdAt: 1 }); // Oldest first

    if (limit) {
        cursor = cursor.limit(limit);
    }

    return cursor.toArray();
};

/**
 * Summary of a report for duplicate detection
 */
export interface ReportSummary {
    _id: ObjectId;
    description?: string;
    errorMessage?: string;
    route: string;
    createdAt: Date;
}

/**
 * Find reports in a time range for duplicate detection
 * @param centerDate - The date to center the search around
 * @param daysBefore - Number of days before centerDate to include
 * @param daysAfter - Number of days after centerDate to include
 * @param excludeIds - Report IDs to exclude from results
 * @returns Array of report summaries
 */
export const findReportsInTimeRange = async (
    centerDate: Date,
    daysBefore: number = 2,
    daysAfter: number = 2,
    excludeIds?: (ObjectId | string)[]
): Promise<ReportSummary[]> => {
    const collection = await getReportsCollection();

    const startDate = new Date(centerDate);
    startDate.setDate(startDate.getDate() - daysBefore);

    const endDate = new Date(centerDate);
    endDate.setDate(endDate.getDate() + daysAfter);

    const query: Filter<ReportDocument> = {
        createdAt: {
            $gte: startDate,
            $lte: endDate,
        },
        duplicateOf: { $exists: false },  // Exclude already-marked duplicates
    };

    // Exclude specified IDs
    // Note: Uses `new ObjectId()` instead of `toQueryId()` — $nin requires ObjectId[], see findReportsByIds
    if (excludeIds && excludeIds.length > 0) {
        const objectIds = excludeIds.map(id =>
            typeof id === 'string' ? new ObjectId(id) : id
        );
        query._id = { $nin: objectIds };
    }

    return collection
        .find(query)
        .project<ReportSummary>({
            _id: 1,
            description: 1,
            errorMessage: 1,
            route: 1,
            createdAt: 1,
        })
        .sort({ createdAt: 1 })
        .toArray();
};

/**
 * Mark a report as a duplicate of another report
 * @param reportId - The ID of the report to mark as duplicate
 * @param duplicateOfId - The ID of the original report
 * @returns True if the report was updated, false otherwise
 */
export const markReportAsDuplicate = async (
    reportId: ObjectId | string,
    duplicateOfId: ObjectId | string
): Promise<boolean> => {
    const collection = await getReportsCollection();
    const reportIdObj = typeof reportId === 'string' ? new ObjectId(reportId) : reportId;
    const duplicateOfIdObj = typeof duplicateOfId === 'string' ? new ObjectId(duplicateOfId) : duplicateOfId;

    const result = await collection.updateOne(
        { _id: reportIdObj },
        {
            $set: {
                duplicateOf: duplicateOfIdObj,
                status: 'closed' as ReportStatus,
                updatedAt: new Date(),
            },
        }
    );

    return result.modifiedCount === 1;
};

/**
 * Get report counts by status
 * @returns Object with counts for each status
 */
export const getReportCounts = async (): Promise<Record<ReportStatus, number>> => {
    const collection = await getReportsCollection();

    const pipeline = [
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ];

    const results = await collection.aggregate(pipeline).toArray();

    const counts: Record<ReportStatus, number> = {
        new: 0,
        investigating: 0,
        resolved: 0,
        closed: 0,
    };

    for (const result of results) {
        if (result._id in counts) {
            counts[result._id as ReportStatus] = result.count;
        }
    }

    return counts;
};

/**
 * Atomically claim (consume) the approval token.
 * Uses findOneAndUpdate with a condition so only the first caller succeeds.
 * Returns the document (with token) if claimed, null if already claimed or missing.
 */
export const claimApprovalToken = async (
    reportId: ObjectId | string
): Promise<ReportDocument | null> => {
    const collection = await getReportsCollection();
    const reportIdObj = typeof reportId === 'string' ? new ObjectId(reportId) : reportId;

    // $ne: null is valid MongoDB but conflicts with TypeScript's strict typing for optional string fields
    const filter = { _id: reportIdObj, approvalToken: { $exists: true, $ne: null } } as unknown as Filter<ReportDocument>;
    const result = await collection.findOneAndUpdate(
        filter,
        { $unset: { approvalToken: '' }, $set: { updatedAt: new Date() } },
        { returnDocument: 'before' }
    );

    return result || null;
};

/**
 * Update approval token (or remove it by passing null)
 * @param reportId - The ID of the report to update
 * @param token - The new token, or null to remove it
 * @returns True if updated successfully
 */
export const updateApprovalToken = async (
    reportId: ObjectId | string,
    token: string | null
): Promise<boolean> => {
    const collection = await getReportsCollection();
    const reportIdObj = typeof reportId === 'string' ? new ObjectId(reportId) : reportId;

    if (token === null) {
        // Remove the token field
        const result = await collection.updateOne(
            { _id: reportIdObj },
            {
                $unset: { approvalToken: '' },
                $set: { updatedAt: new Date() },
            }
        );
        return result.modifiedCount === 1;
    }

    // Set the token
    const result = await collection.updateOne(
        { _id: reportIdObj },
        {
            $set: {
                approvalToken: token,
                updatedAt: new Date(),
            },
        }
    );

    return result.modifiedCount === 1;
};

/**
 * Find an existing open report by error key (for deduplication)
 * @param errorKey - The error key to search for
 * @returns The report document or null if not found
 */
export const findOpenReportByErrorKey = async (
    errorKey: string
): Promise<ReportDocument | null> => {
    const collection = await getReportsCollection();

    return collection.findOne({
        errorKey,
        status: { $in: ['new', 'investigating'] as ReportStatus[] },
    });
};

/**
 * Increment occurrence count and update lastOccurrence timestamp
 * @param reportId - The ID of the report to update
 * @returns True if updated successfully
 */
export const incrementReportOccurrence = async (
    reportId: ObjectId | string
): Promise<boolean> => {
    const collection = await getReportsCollection();
    const reportIdObj = typeof reportId === 'string' ? new ObjectId(reportId) : reportId;

    const result = await collection.updateOne(
        { _id: reportIdObj },
        {
            $inc: { occurrenceCount: 1 },
            $set: {
                lastOccurrence: new Date(),
                updatedAt: new Date(),
            },
        }
    );

    return result.modifiedCount === 1;
};

/**
 * Find reports by workflow status (for AppProjectAdapter)
 */
export const findByWorkflowStatus = async (
    workflowStatus?: string,
    workflowReviewStatus?: string
): Promise<ReportDocument[]> => {
    const collection = await getReportsCollection();
    const query: Filter<ReportDocument> = {};

    if (workflowStatus) {
        query.workflowStatus = workflowStatus;
    }
    if (workflowReviewStatus) {
        query.workflowReviewStatus = workflowReviewStatus;
    }

    // Only return items that have been synced to GitHub (have a projectItemId)
    query.githubProjectItemId = { $exists: true, $ne: undefined };

    return collection.find(query).sort({ updatedAt: -1 }).toArray();
};

/**
 * Update workflow fields on a report
 */
export const updateWorkflowFields = async (
    reportId: ObjectId | string,
    fields: {
        workflowStatus?: string | null;
        workflowReviewStatus?: string | null;
        implementationPhase?: string | null;
    }
): Promise<void> => {
    const collection = await getReportsCollection();
    const reportIdObj = typeof reportId === 'string' ? new ObjectId(reportId) : reportId;

    const $set: Record<string, unknown> = { updatedAt: new Date() };
    const $unset: Record<string, string> = {};

    for (const [key, value] of Object.entries(fields)) {
        if (value === null) {
            $unset[key] = '';
        } else if (value !== undefined) {
            $set[key] = value;
        }
    }

    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length > 0) {
        update.$unset = $unset;
    }

    await collection.updateOne({ _id: reportIdObj }, update);
};

/**
 * Find multiple reports by their IDs
 *
 * Note: Uses `new ObjectId()` instead of `toQueryId()` because MongoDB's `$in`
 * operator requires `ObjectId[]`, but `toQueryId()` returns `ObjectId | string`
 * which is incompatible with that type constraint.
 */
export const findReportsByIds = async (reportIds: string[]): Promise<ReportDocument[]> => {
    const collection = await getReportsCollection();
    const objectIds = reportIds.map(id => new ObjectId(id));
    return collection.find({ _id: { $in: objectIds } }).toArray();
};

/**
 * Batch update status for multiple reports
 *
 * Note: Uses `new ObjectId()` instead of `toQueryId()` — see findReportsByIds.
 */
export const batchUpdateStatuses = async (
    reportIds: string[],
    status: ReportStatus
): Promise<number> => {
    const collection = await getReportsCollection();
    const objectIds = reportIds.map(id => new ObjectId(id));
    const result = await collection.updateMany(
        { _id: { $in: objectIds } },
        { $set: { status, updatedAt: new Date() } }
    );
    return result.modifiedCount;
};

/**
 * Batch delete reports by their IDs
 *
 * Note: Uses `new ObjectId()` instead of `toQueryId()` — see findReportsByIds.
 */
export const batchDeleteByIds = async (reportIds: string[]): Promise<number> => {
    const collection = await getReportsCollection();
    const objectIds = reportIds.map(id => new ObjectId(id));
    const result = await collection.deleteMany({ _id: { $in: objectIds } });
    return result.deletedCount;
};
