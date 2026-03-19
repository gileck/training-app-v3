/**
 * Shared entry-point boilerplate for agent scripts.
 *
 * Every agent has the same main().then/catch/process.exit pattern.
 * This factory eliminates that duplication.
 */

/**
 * Run an agent's main function with standard process lifecycle handling.
 *
 * Calls `mainFn()`, then exits with code 0 on success or logs the
 * fatal error and exits with code 1 on failure.
 *
 * @param mainFn - The agent's async main function
 * @param options.skipInTest - If true, skip execution when VITEST env is set (default: false)
 */
export function runAgentMain(
    mainFn: () => Promise<void>,
    options?: { skipInTest?: boolean }
): void {
    if (options?.skipInTest && process.env.VITEST) {
        return;
    }

    mainFn()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}
