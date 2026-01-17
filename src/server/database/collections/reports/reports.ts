import { Collection, ObjectId, Filter, Sort } from 'mongodb';
import { getDb } from '@/server/database';
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

