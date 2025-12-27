import { Collection, ObjectId, Filter, Sort } from 'mongodb';
import { getDb } from '@/server/database';
import { ReportDocument, ReportCreate, ReportUpdate, ReportFilters, ReportStatus } from './types';

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

