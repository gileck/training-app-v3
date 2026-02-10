/**
 * Argument Parsing Utilities
 *
 * Simple argument parsing for CLI commands.
 */

export interface ParsedArgs {
    type?: string;
    title?: string;
    description?: string;
    workflowRoute?: string;    // Workflow routing (product-dev, tech-design, etc.)
    clientPageRoute?: string;  // Affected client page route (e.g., "/settings") for bugs
    priority?: string;
    dryRun?: boolean;
    autoApprove?: boolean;
    // Fields for list/get/update commands
    id?: string;
    status?: string;
    source?: string;
    // Fields for log command
    issue?: string;
    output?: string;
    // Fields for route/delete commands
    destination?: string;
    force?: boolean;
}

/**
 * Parse CLI arguments into an options object
 *
 * Supports:
 *   --type <value>
 *   --title <value>
 *   --description <value>
 *   --route <value>
 *   --priority <value>
 *   --id <value>
 *   --status <value>
 *   --source <value>
 *   --dry-run (flag)
 *   --auto-approve (flag)
 */
export function parseArgs(args: string[]): ParsedArgs {
    const result: ParsedArgs = {};
    let i = 0;

    while (i < args.length) {
        const arg = args[i];

        if (arg === '--type' && args[i + 1]) {
            result.type = args[i + 1];
            i += 2;
        } else if (arg === '--title' && args[i + 1]) {
            result.title = args[i + 1];
            i += 2;
        } else if (arg === '--description' && args[i + 1]) {
            result.description = args[i + 1];
            i += 2;
        } else if (arg === '--workflow-route' && args[i + 1]) {
            result.workflowRoute = args[i + 1];
            i += 2;
        } else if (arg === '--priority' && args[i + 1]) {
            result.priority = args[i + 1];
            i += 2;
        } else if (arg === '--client-page-route' && args[i + 1]) {
            result.clientPageRoute = args[i + 1];
            i += 2;
        } else if (arg === '--dry-run') {
            result.dryRun = true;
            i += 1;
        } else if (arg === '--auto-approve') {
            result.autoApprove = true;
            i += 1;
        } else if (arg === '--id' && args[i + 1]) {
            result.id = args[i + 1];
            i += 2;
        } else if (arg === '--status' && args[i + 1]) {
            result.status = args[i + 1];
            i += 2;
        } else if (arg === '--source' && args[i + 1]) {
            result.source = args[i + 1];
            i += 2;
        } else if (arg === '--issue' && args[i + 1]) {
            result.issue = args[i + 1];
            i += 2;
        } else if (arg === '--output' && args[i + 1]) {
            result.output = args[i + 1];
            i += 2;
        } else if (arg === '--destination' && args[i + 1]) {
            result.destination = args[i + 1];
            i += 2;
        } else if (arg === '--route' && args[i + 1]) {
            result.workflowRoute = args[i + 1];
            i += 2;
        } else if (arg === '--force') {
            result.force = true;
            i += 1;
        } else {
            // Unknown argument, skip
            i += 1;
        }
    }

    return result;
}

/**
 * Validate that all required fields are present
 */
export function validateCreateArgs(args: ParsedArgs): { valid: boolean; error?: string } {
    if (!args.type) {
        return { valid: false, error: 'Missing required argument: --type' };
    }
    if (!['feature', 'bug'].includes(args.type)) {
        return { valid: false, error: 'Invalid type. Use: feature | bug' };
    }
    if (!args.title) {
        return { valid: false, error: 'Missing required argument: --title' };
    }
    if (!args.description) {
        return { valid: false, error: 'Missing required argument: --description' };
    }
    if (args.workflowRoute && !['product-dev', 'product-design', 'tech-design', 'implementation', 'backlog'].includes(args.workflowRoute)) {
        return { valid: false, error: 'Invalid --workflow-route. Use: product-dev | product-design | tech-design | implementation | backlog' };
    }
    if (args.priority && !['low', 'medium', 'high', 'critical'].includes(args.priority)) {
        return { valid: false, error: 'Invalid priority. Use: low | medium | high | critical' };
    }
    return { valid: true };
}
