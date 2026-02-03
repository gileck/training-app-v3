/**
 * Bug Report Feature
 *
 * Provides bug reporting functionality with dialog and hooks.
 */

export {
    useBugReportStore,
    useBugReportDialogOpen,
    useOpenBugReportDialog,
    useCloseBugReportDialog
} from './store';
export { useSubmitBugReport, useSubmitErrorReport, submitErrorReport } from './hooks';
export { submitApiErrorReport } from './apiErrorReporter';
export { BugReportDialog } from './BugReportDialog';
export type { BugReportData, BrowserInfo, UserInfo, BugCategory, PerformanceEntryData } from './types';

