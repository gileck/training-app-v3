import {
    runAgent,
} from '../../shared';
import { runYarnChecks } from './gitUtils';
import type { ImplementOptions } from './types';

/**
 * Run post-work yarn checks and auto-fix any issues via Claude agent.
 * Re-verifies after fixing.
 */
export async function validateAndFixChanges(options: ImplementOptions): Promise<void> {
    console.log('  Running post-work yarn checks...');
    const postChecks = runYarnChecks();
    if (!postChecks.success) {
        console.log('  ⚠️ Issues found - asking Claude to fix...');

        // Run Claude to fix the issues (skip plan mode - this is a simple fix task)
        const fixResult = await runAgent({
            prompt: `The following yarn checks errors need to be fixed:\n\n${postChecks.output}\n\nFix these issues in the codebase. Only fix the issues shown above, do not make any other changes.`,
            stream: options.stream,
            verbose: options.verbose,
            timeout: options.timeout,
            progressLabel: 'Fixing yarn checks issues',
            allowWrite: true,
            workflow: 'implementation',
            shouldUsePlanMode: false,
        });

        if (!fixResult.success) {
            console.error('  ⚠️ Could not auto-fix issues - continuing anyway');
        } else {
            // Re-run checks to verify
            const recheck = runYarnChecks();
            if (recheck.success) {
                console.log('  ✅ Issues fixed');
            } else {
                console.log('  ⚠️ Some issues may remain - continuing anyway');
            }
        }
    } else {
        console.log('  ✅ No new issues introduced');
    }
}
