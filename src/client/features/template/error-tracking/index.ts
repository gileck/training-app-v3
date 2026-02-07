/**
 * Error Tracking Feature
 * 
 * Provides global error handling and reporting.
 */

export { useGlobalErrorHandler, clearReportedErrors } from './useGlobalErrorHandler';
export { ErrorBoundary } from './ErrorBoundary';
export { ErrorDisplay } from './ErrorDisplay';
export { isNetworkError, cleanErrorMessage, getUserFriendlyMessage, formatErrorForCopy } from './errorUtils';
export { errorToast, errorToastAuto } from './errorToast';
export type { TrackedError } from './types';

