import { NextApiRequest, NextApiResponse } from "next";
import { apiHandlers } from "@/apis/apis";
import { getUserContext } from "@/apis/getUserContext";
import type { BatchOperation, BatchOperationResult } from "@/apis/template/batch-updates/types";

/**
 * Batch updates API handler
 * 
 * Accepts an array of API operations and executes them sequentially server-side.
 * This is more efficient than making N separate API calls from the client,
 * especially for syncing offline queued mutations.
 * 
 * Request body:
 * {
 *   operations: [
 *     { id: "q_123", name: "todos/update", params: { todoId: "...", completed: true } },
 *     { id: "q_124", name: "todos/delete", params: { todoId: "..." } },
 *   ]
 * }
 * 
 * Response:
 * {
 *   results: [
 *     { id: "q_123", success: true, data: { todo: {...} } },
 *     { id: "q_124", success: true, data: { success: true } },
 *   ],
 *   successCount: 2,
 *   failureCount: 0
 * }
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // NOTE: Never return non-200 from API routes in this app; encode errors in the body.
    try {
        if (req.method !== 'POST') {
            return res.status(200).json({
                results: [],
                successCount: 0,
                failureCount: 0,
                error: 'Method not allowed'
            });
        }

        const { operations } = req.body as { operations: BatchOperation[] };

        if (!operations || !Array.isArray(operations)) {
            return res.status(200).json({
                results: [],
                successCount: 0,
                failureCount: 0,
                error: 'Invalid request: operations array required'
            });
        }

        if (operations.length === 0) {
            return res.status(200).json({ results: [], successCount: 0, failureCount: 0 });
        }

        // Get user context once for all operations
        const userContext = getUserContext(req, res);

        const results: BatchOperationResult[] = [];
        let successCount = 0;
        let failureCount = 0;

        // Execute operations sequentially to maintain order and avoid race conditions
        for (const operation of operations) {
            const { id, name, params } = operation;

            try {
                // Validate operation name
                const apiHandler = apiHandlers[name as keyof typeof apiHandlers];
                if (!apiHandler) {
                    results.push({
                        id,
                        success: false,
                        error: `Unknown API: ${name}`
                    });
                    failureCount++;
                    continue;
                }

                // Centralized admin gating: any API under `admin/*` is admin-only.
                if (name.startsWith('admin/') && !userContext.isAdmin) {
                    results.push({
                        id,
                        success: false,
                        error: 'Forbidden'
                    });
                    failureCount++;
                    continue;
                }

                // Execute the API handler
                const processFunc = apiHandler.process;
                const data = await (processFunc as (params: unknown, context: unknown) => Promise<unknown>)(
                    params,
                    userContext
                );

                results.push({
                    id,
                    success: true,
                    data
                });
                successCount++;
            } catch (error) {
                console.error(`Batch operation ${id} (${name}) failed:`, error);
                results.push({
                    id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                failureCount++;
                // Continue processing remaining operations even if one fails
            }
        }

        return res.status(200).json({
            results,
            successCount,
            failureCount
        });
    } catch (error) {
        console.error('Error in batch-updates API handler:', error);
        return res.status(200).json({
            results: [],
            successCount: 0,
            failureCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

export const config = {
    maxDuration: 60,
};

