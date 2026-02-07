/**
 * Shared CLI Factory
 *
 * Creates Commander.js CLI programs with standard options for all agents.
 * Handles option parsing, header printing, and returns parsed options.
 */

import { Command } from 'commander';
import { agentConfig } from './config';
import type { CommonCLIOptions } from './types';

interface CLIOption {
    /** Commander flag string, e.g., '--skip-push' or '--skip-checkout' */
    flag: string;
    /** Description for help text */
    description: string;
    /** Default value, e.g., false */
    defaultValue?: unknown;
    /** Parser function, e.g., parseInt */
    parser?: (value: string) => unknown;
}

interface CLIConfig {
    /** Commander program name, e.g., 'product-design' */
    name: string;
    /** Human-readable name for header banner, e.g., 'Product Design Agent' */
    displayName: string;
    /** Description for help text */
    description: string;
    /** Additional options beyond the standard 6 */
    additionalOptions?: CLIOption[];
    /** Extra header lines to display after the agent name */
    extraHeaderLines?: string[];
}

interface ParsedCLI {
    /** Standard CLI options */
    options: CommonCLIOptions;
    /** Extra options from additionalOptions, keyed by camelCase flag name */
    extra: Record<string, unknown>;
}

/**
 * Create CLI program, parse args, print header, return parsed options.
 *
 * Standard options: --id, --limit, --timeout, --dry-run, --stream, --verbose
 */
export function createCLI(config: CLIConfig): ParsedCLI {
    const program = new Command();

    program
        .name(config.name)
        .description(config.description)
        .option('--id <itemId>', 'Process a specific project item by ID')
        .option('--limit <number>', 'Limit number of items to process', parseInt)
        .option('--timeout <seconds>', 'Timeout per item in seconds', parseInt)
        .option('--dry-run', 'Preview without saving changes', false)
        .option('--stream', "Stream Claude's output in real-time", false)
        .option('--verbose', 'Show additional debug output', false);

    // Add any additional options
    if (config.additionalOptions) {
        for (const opt of config.additionalOptions) {
            if (opt.parser) {
                program.option(opt.flag, opt.description, opt.parser);
            } else if (opt.defaultValue !== undefined) {
                program.option(opt.flag, opt.description, opt.defaultValue as string | boolean);
            } else {
                program.option(opt.flag, opt.description);
            }
        }
    }

    program.parse(process.argv);

    const opts = program.opts();

    // Build standard options
    const options: CommonCLIOptions = {
        id: opts.id as string | undefined,
        limit: opts.limit as number | undefined,
        timeout: (opts.timeout as number | undefined) ?? agentConfig.claude.timeoutSeconds,
        dryRun: Boolean(opts.dryRun),
        verbose: Boolean(opts.verbose),
        stream: Boolean(opts.stream),
    };

    // Build extra options (camelCase conversion from flag names)
    const extra: Record<string, unknown> = {};
    if (config.additionalOptions) {
        for (const opt of config.additionalOptions) {
            // Convert --skip-push to skipPush
            const flagName = opt.flag
                .replace(/^--/, '')
                .split(' ')[0] // Remove value placeholder like '<value>'
                .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
            extra[flagName] = opts[flagName];
        }
    }

    // Print header banner
    console.log('\n========================================');
    console.log(`  ${config.displayName}`);
    if (config.extraHeaderLines) {
        for (const line of config.extraHeaderLines) {
            console.log(`  ${line}`);
        }
    }
    console.log('========================================');
    console.log(`  Timeout: ${options.timeout}s per item`);
    if (options.dryRun) {
        console.log('  Mode: DRY RUN (no changes will be saved)');
    }
    console.log('');

    return { options, extra };
}
