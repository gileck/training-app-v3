/**
 * Error Tracking Types
 */

export interface TrackedError {
    message: string;
    stack?: string;
    timestamp: string;
    route: string;
    type: 'error' | 'unhandledrejection';
}

