/**
 * Reports API Names
 * 
 * API name constants for bug/error reporting.
 * These are the single source of truth for API names.
 */

// Legacy name export for eslint compatibility
export const name = 'reports';

export const API_CREATE_REPORT = 'reports/create';
export const API_GET_REPORTS = 'admin/reports/list';
export const API_GET_REPORT = 'admin/reports/get';
export const API_UPDATE_REPORT_STATUS = 'admin/reports/updateStatus';
export const API_DELETE_REPORT = 'admin/reports/delete';
export const API_DELETE_ALL_REPORTS = 'admin/reports/deleteAll';
export const API_UPDATE_INVESTIGATION = 'admin/reports/updateInvestigation';
export const API_BATCH_UPDATE_STATUS = 'admin/reports/batchUpdateStatus';
export const API_BATCH_DELETE = 'admin/reports/batchDelete';
export const API_APPROVE_BUG_REPORT = 'admin/reports/approve';

