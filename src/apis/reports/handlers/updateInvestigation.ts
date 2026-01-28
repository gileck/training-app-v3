import { API_UPDATE_INVESTIGATION } from '../index';
import { UpdateInvestigationRequest, UpdateInvestigationResponse } from '../types';
import { reports } from '@/server/database';
import { toStringId } from '@/server/utils';
import { Investigation } from '@/server/database/collections/reports/types';

const validStatuses = ['needs_info', 'root_cause_found', 'complex_fix', 'not_a_bug', 'inconclusive'];
const validConfidenceLevels = ['low', 'medium', 'high'];
const validComplexityLevels = ['low', 'medium', 'high'];

export const updateInvestigation = async (
    request: UpdateInvestigationRequest
): Promise<UpdateInvestigationResponse> => {
    try {
        if (!request.reportId) {
            return { error: "Report ID is required" };
        }

        if (!request.investigation) {
            return { error: "Investigation data is required" };
        }

        const { investigation } = request;

        // Validate required fields
        if (!investigation.status || !validStatuses.includes(investigation.status)) {
            return { error: `Invalid investigation status. Must be one of: ${validStatuses.join(', ')}` };
        }

        if (!investigation.headline || investigation.headline.length > 100) {
            return { error: "Headline is required and must be under 100 characters" };
        }

        if (!investigation.summary) {
            return { error: "Summary is required" };
        }

        if (!investigation.confidence || !validConfidenceLevels.includes(investigation.confidence)) {
            return { error: `Invalid confidence level. Must be one of: ${validConfidenceLevels.join(', ')}` };
        }

        if (!Array.isArray(investigation.filesExamined)) {
            return { error: "filesExamined must be an array" };
        }

        if (!investigation.investigatedBy || !['agent', 'human'].includes(investigation.investigatedBy)) {
            return { error: "investigatedBy must be 'agent' or 'human'" };
        }

        // Validate proposedFix if present
        if (investigation.proposedFix) {
            if (!investigation.proposedFix.description) {
                return { error: "proposedFix.description is required when proposedFix is provided" };
            }
            if (!Array.isArray(investigation.proposedFix.files)) {
                return { error: "proposedFix.files must be an array" };
            }
            if (!validComplexityLevels.includes(investigation.proposedFix.complexity)) {
                return { error: `Invalid fix complexity. Must be one of: ${validComplexityLevels.join(', ')}` };
            }
        }

        // Build the investigation object with investigatedAt timestamp
        const investigationDoc: Investigation = {
            status: investigation.status,
            headline: investigation.headline,
            summary: investigation.summary,
            confidence: investigation.confidence,
            rootCause: investigation.rootCause,
            proposedFix: investigation.proposedFix,
            analysisNotes: investigation.analysisNotes,
            filesExamined: investigation.filesExamined,
            investigatedAt: new Date(),
            investigatedBy: investigation.investigatedBy,
        };

        const reportDoc = await reports.updateReportInvestigation(request.reportId, investigationDoc);

        if (!reportDoc) {
            return { error: "Report not found" };
        }

        // Convert to client format
        // Handle legacy reports that may not have all date fields
        const createdAt = reportDoc.createdAt?.toISOString() ?? new Date().toISOString();
        const updatedAt = reportDoc.updatedAt?.toISOString() ?? createdAt;
        const firstOccurrence = reportDoc.firstOccurrence?.toISOString() ?? createdAt;
        const lastOccurrence = reportDoc.lastOccurrence?.toISOString() ?? firstOccurrence;

        const reportClient = {
            _id: toStringId(reportDoc._id),
            type: reportDoc.type,
            status: reportDoc.status,
            description: reportDoc.description,
            screenshot: reportDoc.screenshot,
            sessionLogs: reportDoc.sessionLogs,
            userInfo: reportDoc.userInfo,
            browserInfo: reportDoc.browserInfo,
            route: reportDoc.route,
            networkStatus: reportDoc.networkStatus,
            stackTrace: reportDoc.stackTrace,
            errorMessage: reportDoc.errorMessage,
            category: reportDoc.category,
            performanceEntries: reportDoc.performanceEntries,
            investigation: reportDoc.investigation ? {
                ...reportDoc.investigation,
                investigatedAt: reportDoc.investigation.investigatedAt?.toISOString() ?? createdAt,
            } : undefined,
            duplicateOf: reportDoc.duplicateOf ? toStringId(reportDoc.duplicateOf) : undefined,
            occurrenceCount: reportDoc.occurrenceCount ?? 1,
            firstOccurrence,
            lastOccurrence,
            errorKey: reportDoc.errorKey,
            githubIssueUrl: reportDoc.githubIssueUrl,
            githubIssueNumber: reportDoc.githubIssueNumber,
            githubProjectItemId: reportDoc.githubProjectItemId,
            createdAt,
            updatedAt,
        };

        return { report: reportClient };
    } catch (error: unknown) {
        console.error("Update investigation error:", error);
        return { error: error instanceof Error ? error.message : "Failed to update investigation" };
    }
};

export { API_UPDATE_INVESTIGATION };
