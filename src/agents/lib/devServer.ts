/**
 * Dev Server Management Utility
 *
 * Handles starting, stopping, and waiting for the local development server.
 * Used by the implementor agent for local testing with Playwright MCP.
 */

import { spawn, ChildProcess } from 'child_process';

export interface DevServerState {
    process: ChildProcess;
    port: number;
    url: string;
}

export interface StartDevServerOptions {
    /** Working directory to run the server in */
    cwd: string;
    /** Timeout in seconds to wait for server startup (default: 90) */
    startupTimeout?: number;
    /** Specific port to use. If not provided, uses a random available port */
    port?: number;
}

/**
 * Get a random port in a safe range (3001-3999)
 * Avoids 3000 which is commonly used
 */
export function getRandomPort(): number {
    return Math.floor(Math.random() * 999) + 3001;
}

/**
 * Start the dev server on a specific or random port
 *
 * @param options Start options including cwd, timeout, and optional port
 * @returns DevServerState with process, port, and URL
 */
export async function startDevServer(options: StartDevServerOptions): Promise<DevServerState>;
/**
 * @deprecated Use options object instead
 */
export async function startDevServer(cwd: string, startupTimeout?: number): Promise<DevServerState>;
export async function startDevServer(
    cwdOrOptions: string | StartDevServerOptions,
    startupTimeoutArg?: number
): Promise<DevServerState> {
    // Handle both old and new signatures
    const options: StartDevServerOptions = typeof cwdOrOptions === 'string'
        ? { cwd: cwdOrOptions, startupTimeout: startupTimeoutArg }
        : cwdOrOptions;

    const { cwd, startupTimeout = 90, port: requestedPort } = options;

    // Use requested port or generate a random one
    const targetPort = requestedPort ?? getRandomPort();

    console.log(`  📦 Starting dev server on port ${targetPort}...`);

    const devServer = spawn('yarn', ['dev', '--port', String(targetPort)], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
    });

    let detectedPort: number | null = null;
    let serverOutput = '';

    // Listen for port detection from stdout
    devServer.stdout?.on('data', (data) => {
        serverOutput += data.toString();
        const output = data.toString();

        // Detect port from Next.js output (e.g., "- Local: http://localhost:3001")
        const portMatch = output.match(/localhost:(\d+)/);
        if (portMatch && !detectedPort) {
            detectedPort = parseInt(portMatch[1], 10);
            console.log(`  📍 Detected port: ${detectedPort}`);
        }

        if (output.includes('Ready') || output.includes('started') || output.includes('Local:')) {
            console.log(`  ✓ ${output.trim()}`);
        }
    });

    devServer.stderr?.on('data', (data) => {
        const output = data.toString();
        // Only show non-warning errors
        if (!output.includes('WARN') && !output.includes('warn') && output.trim()) {
            if (output.includes('Error') || output.includes('error')) {
                console.log(`  ❌ ${output.trim()}`);
            }
        }
    });

    // Wait for port detection
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Use detected port or the target port we requested
    const port = detectedPort || targetPort;
    console.log(`  Checking server on port ${port}...`);

    // Wait for server to be ready
    const isReady = await waitForServer(port, startupTimeout * 1000);

    if (!isReady) {
        // Kill the server if it didn't start
        stopDevServer({ process: devServer, port, url: '' });
        console.log('  Server output:', serverOutput);
        throw new Error(`Dev server failed to start within ${startupTimeout} seconds on port ${port}`);
    }

    const url = `http://localhost:${port}`;
    console.log(`  ✅ Dev server is ready on ${url}`);

    return {
        process: devServer,
        port,
        url,
    };
}

/**
 * Wait for the server to respond on the given port
 *
 * @param port Port to check
 * @param timeoutMs Timeout in milliseconds
 * @returns true if server is ready, false if timeout
 */
export async function waitForServer(port: number, timeoutMs: number = 90000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        try {
            const response = await fetch(`http://localhost:${port}`);
            // Accept OK, 404, or redirect (307) as signs the server is running
            if (response.ok || response.status === 404 || response.status === 307) {
                return true;
            }
        } catch {
            // Server not ready yet
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        process.stdout.write(`\r  Waiting... ${elapsed}s`);
    }

    console.log(''); // New line after progress
    return false;
}

/**
 * Stop the dev server process
 *
 * @param state DevServerState from startDevServer
 */
export function stopDevServer(state: DevServerState): void {
    if (state.process.pid) {
        try {
            // Kill the entire process group
            process.kill(-state.process.pid, 'SIGTERM');
            console.log('  🛑 Dev server stopped');
        } catch (error) {
            // Try regular kill if process group kill fails
            try {
                state.process.kill('SIGTERM');
            } catch {
                console.log('  ⚠ Could not stop dev server:', error);
            }
        }
    }
}
