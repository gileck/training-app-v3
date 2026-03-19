/**
 * Dev server management for local testing with Playwright MCP.
 *
 * Handles starting the dev server, health checks, and stopping.
 */

import {
    agentConfig,
} from '../../shared';
import {
    isPlaywrightMCPAvailable,
    startDevServer,
    stopDevServer,
    type DevServerState,
} from '../../lib';
import {
    logError,
    type LogContext,
} from '../../lib/logging';
import { appendLocalTestingContext } from './promptBuilder';

export interface DevServerResult {
    devServer: DevServerState | null;
    prompt: string;
}

/**
 * Check if local testing should be enabled and start the dev server if so.
 * Returns the dev server state and updated prompt with testing context.
 */
export async function setupDevServer(
    mode: string,
    prompt: string,
    options: { skipLocalTest?: boolean; dryRun?: boolean },
    logCtx: LogContext,
): Promise<DevServerResult> {
    const playwrightAvailable = isPlaywrightMCPAvailable();
    const enableLocalTesting = agentConfig.localTesting.enabled &&
        !options.skipLocalTest &&
        mode === 'new' &&
        playwrightAvailable;

    if (agentConfig.localTesting.enabled && !options.skipLocalTest && mode === 'new' && !playwrightAvailable) {
        const mcpWarning = 'Local testing disabled: @playwright/mcp not installed. To enable: yarn add -D @playwright/mcp';
        console.log(`  \u26A0\uFE0F ${mcpWarning}`);
        logError(logCtx, mcpWarning, false);
    }

    if (!enableLocalTesting || options.dryRun) {
        return { devServer: null, prompt };
    }

    console.log('\n  \uD83E\uDDEA Starting dev server for local testing...');
    let devServer: DevServerState | null = null;

    try {
        devServer = await startDevServer({
            cwd: process.cwd(),
            startupTimeout: agentConfig.localTesting.devServerStartupTimeout,
        });

        // Health check: verify dev server isn't serving error pages
        try {
            const healthResponse = await fetch(devServer.url);
            const body = await healthResponse.text();
            const buildErrorPatterns = [
                'Module not found',
                'Cannot find module',
                'Build Error',
                'Compilation Error',
                'SyntaxError',
                'Internal Server Error',
            ];
            const hasError = buildErrorPatterns.some(pattern => body.includes(pattern));
            if (hasError) {
                console.log('  \u26A0\uFE0F Dev server has build errors \u2014 skipping visual verification');
                stopDevServer(devServer);
                devServer = null;
            }
        } catch {
            console.log('  \u26A0\uFE0F Dev server health check failed \u2014 skipping visual verification');
            if (devServer) {
                stopDevServer(devServer);
                devServer = null;
            }
        }

        // Only add local testing context if dev server is healthy
        if (devServer) {
            prompt = appendLocalTestingContext(prompt, devServer.url);
        }
    } catch (error) {
        const devServerError = `Failed to start dev server: ${error instanceof Error ? error.message : String(error)}`;
        console.log(`  \u26A0\uFE0F ${devServerError}`);
        console.log('  Continuing without local testing...');
        logError(logCtx, `Local testing skipped: ${devServerError}`, false);
    }

    return { devServer, prompt };
}

export { stopDevServer };
