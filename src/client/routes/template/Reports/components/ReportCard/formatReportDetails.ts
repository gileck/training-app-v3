/**
 * Format report details for clipboard copy
 */

import type { ReportClient, InvestigationStatus } from '@/apis/template/reports/types';
import { formatDate, generatePerformanceSummary } from '../../utils';

const INVESTIGATION_STATUS_LABELS: Record<InvestigationStatus, string> = {
    needs_info: 'Needs More Info',
    root_cause_found: 'Root Cause Found',
    complex_fix: 'Complex Fix Required',
    not_a_bug: 'Not a Bug',
    inconclusive: 'Inconclusive',
};

export function formatReportDetails(report: ReportClient): string {
    const sessionLogsFormatted = report.sessionLogs.length > 0
        ? report.sessionLogs.map(log =>
            `  [${log.timestamp}]${log.performanceTime !== undefined ? ` [+${log.performanceTime}ms]` : ''} [${log.level.toUpperCase()}] [${log.feature}] ${log.message}${log.meta ? ` | Meta: ${JSON.stringify(log.meta)}` : ''}${log.route ? ` | Route: ${log.route}` : ''} | Network: ${log.networkStatus}`
        ).join('\n')
        : '  No session logs';

    const performanceEntriesFormatted = report.performanceEntries && report.performanceEntries.length > 0
        ? report.performanceEntries.map(entry =>
            `  [${entry.entryType}] ${entry.name} | Start: ${entry.startTime}ms | Duration: ${entry.duration}ms${entry.transferSize ? ` | Size: ${entry.transferSize}B` : ''}`
        ).join('\n')
        : null;

    const perfSummary = generatePerformanceSummary(report);

    const details = `
================================================================================
BUG/ERROR REPORT
================================================================================

REPORT METADATA
---------------
- Report ID: ${report._id}
- Type: ${report.type.toUpperCase()}${report.category ? ` (${report.category})` : ''}
- Status: ${report.status}
- Created: ${formatDate(report.createdAt)}
- Updated: ${formatDate(report.updatedAt)}

CONTEXT
-------
- Route/Page: ${report.route}
- Network Status: ${report.networkStatus}

${report.description ? `DESCRIPTION
-----------
${report.description}
` : ''}
${perfSummary ? `PERFORMANCE SUMMARY
-------------------
${perfSummary}
` : ''}
${report.errorMessage ? `ERROR MESSAGE
-------------
${report.errorMessage}
` : ''}
${report.stackTrace ? `STACK TRACE
-----------
${report.stackTrace}
` : ''}
${report.investigation ? `INVESTIGATION SUMMARY
---------------------
- Status: ${INVESTIGATION_STATUS_LABELS[report.investigation.status]}
- Confidence: ${report.investigation.confidence}
- Headline: ${report.investigation.headline}

Summary:
${report.investigation.summary}
${report.investigation.rootCause ? `
Root Cause:
${report.investigation.rootCause}
` : ''}${report.investigation.proposedFix ? `
Proposed Fix (${report.investigation.proposedFix.complexity} complexity):
${report.investigation.proposedFix.description}

Files to change:
${report.investigation.proposedFix.files.map(f => `  - ${f.path}: ${f.changes}`).join('\n')}
` : ''}${report.investigation.analysisNotes ? `
Analysis Notes:
${report.investigation.analysisNotes}
` : ''}
Files Examined: ${report.investigation.filesExamined.length > 0 ? report.investigation.filesExamined.join(', ') : 'None'}
Investigated: ${formatDate(report.investigation.investigatedAt)} by ${report.investigation.investigatedBy}
` : ''}
USER INFORMATION
----------------
${report.userInfo ? `- User ID: ${report.userInfo.userId || 'N/A'}
- Username: ${report.userInfo.username || 'N/A'}
- Email: ${report.userInfo.email || 'N/A'}` : '- User: Anonymous (not logged in)'}

BROWSER/DEVICE INFORMATION
--------------------------
- User Agent: ${report.browserInfo.userAgent}
- Viewport: ${report.browserInfo.viewport.width}x${report.browserInfo.viewport.height}
- Language: ${report.browserInfo.language}

${report.screenshot ? `SCREENSHOT
----------
${report.screenshot.startsWith('data:')
            ? `[Base64 image data - ${Math.round(report.screenshot.length / 1024)}KB]`
            : report.screenshot}
` : ''}
${performanceEntriesFormatted ? `PERFORMANCE ENTRIES (${report.performanceEntries?.length || 0} entries)
--------------------------------------------------------
${performanceEntriesFormatted}
` : ''}
SESSION LOGS (${report.sessionLogs.length} entries)
--------------------------------------------------
${sessionLogsFormatted}

================================================================================
END OF REPORT
================================================================================
    `.trim();

    return details;
}
