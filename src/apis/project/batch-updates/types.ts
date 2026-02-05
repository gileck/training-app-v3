/**
 * Batch operation request item
 */
export interface BatchOperation {
    id: string;
    name: string;
    params?: Record<string, unknown>;
}

/**
 * Batch operation result item
 */
export interface BatchOperationResult {
    id: string;
    success: boolean;
    data?: unknown;
    error?: string;
}

/**
 * Batch sync response from the server
 */
export interface BatchSyncResponse {
    results: BatchOperationResult[];
    successCount: number;
    failureCount: number;
    /**
     * Optional top-level error for cases where the batch request itself was invalid
     * (e.g., wrong method, invalid payload) and no per-operation results are available.
     */
    error?: string;
}

