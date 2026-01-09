// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_CREATE_REPORT,
    API_GET_REPORTS,
    API_GET_REPORT,
    API_UPDATE_REPORT_STATUS,
    API_DELETE_REPORT,
    API_DELETE_ALL_REPORTS,
    API_UPDATE_INVESTIGATION
} from './index';

// Import handlers
import { createReport } from './handlers/createReport';
import { getReports } from './handlers/getReports';
import { getReport } from './handlers/getReport';
import { updateReportStatus } from './handlers/updateReportStatus';
import { deleteReport } from './handlers/deleteReport';
import { deleteAllReports } from './handlers/deleteAllReports';
import { updateInvestigation } from './handlers/updateInvestigation';

// Export consolidated handlers object
export const reportsApiHandlers = {
    [API_CREATE_REPORT]: { process: createReport },
    [API_GET_REPORTS]: { process: getReports },
    [API_GET_REPORT]: { process: getReport },
    [API_UPDATE_REPORT_STATUS]: { process: updateReportStatus },
    [API_DELETE_REPORT]: { process: deleteReport },
    [API_DELETE_ALL_REPORTS]: { process: deleteAllReports },
    [API_UPDATE_INVESTIGATION]: { process: updateInvestigation },
};

