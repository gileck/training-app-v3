#!/usr/bin/env npx ts-node
/**
 * Agent Workflow CLI
 *
 * CLI tool for creating feature requests and bug reports that feed
 * into the GitHub agents workflow.
 *
 * Usage:
 *   yarn agent-workflow start
 *   yarn agent-workflow create --type feature --title "..." --description "..."
 */

import '../shared/loadEnv';
import { handleStart, handleCreate, handleList, handleGet, handleUpdate, handleLog } from './commands';

type CommandHandler = (args: string[]) => Promise<void>;

const COMMANDS: Record<string, CommandHandler> = {
    start: handleStart,
    create: handleCreate,
    list: handleList,
    get: handleGet,
    update: handleUpdate,
    log: handleLog,
};

function printUsage(): void {
    console.log(`
Agent Workflow CLI

Usage: yarn agent-workflow <command> [options]

Commands:
  start     Interactive guided process (prompts for all options)
  create    Create with named arguments
  list      List feature requests and bug reports
  get       Get details of a specific item
  update    Update status or priority of an item
  log       Download issue log from S3

Create options:
  --type <type>           Required: feature | bug
  --title <title>         Required: Title of the request
  --description <desc>    Required: Description
  --auto-approve          Optional: Skip approval notification, sync to GitHub immediately
  --workflow-route <phase>  Optional: product-dev | product-design | tech-design | implementation | backlog
                          (implies --auto-approve)
  --client-page-route <route>  Optional: Affected client route for bugs (e.g., "/settings")
  --priority <level>      Optional: low | medium | high | critical (features only)
  --dry-run               Optional: Preview without creating

List options:
  --type <type>           Optional: feature | bug (filter by type)
  --status <status>       Optional: Filter by status
  --source <source>       Optional: ui | cli | auto (filter by source)

Get options:
  <id>                    Required: Item ID (full or first 8 chars)
  --type <type>           Optional: feature | bug (hint for faster lookup)

Update options:
  <id>                    Required: Item ID (full or first 8 chars)
  --status <status>       Optional: New status
                          Features: new | in_progress | done | rejected
                          Bugs: new | investigating | resolved | closed
  --priority <level>      Optional: low | medium | high | critical (features only)
  --dry-run               Optional: Preview without updating

Log options:
  <issue-number>          Required: GitHub issue number
  --output <path>         Optional: Output file path (default: temp-agent-logs/issue-{N}.md)

Workflow:
  Default (no flags):
    1. Creates item with status 'new'
    2. Sends approval notification to Telegram
    3. Waits for admin to approve before syncing to GitHub

  With --auto-approve:
    1. Creates item with status 'in_progress'
    2. Syncs to GitHub immediately
    3. Sends routing notification to Telegram (asks where to route)

  With --auto-approve --workflow-route <phase>:
    1. Creates item with status 'in_progress'
    2. Syncs to GitHub immediately
    3. Auto-routes to specified phase (no Telegram notifications)

Examples:
  # Interactive mode
  yarn agent-workflow start

  # Create feature request
  yarn agent-workflow create --type feature --title "Add dark mode" --description "Toggle theme"

  # List all items
  yarn agent-workflow list

  # List only features with status 'new'
  yarn agent-workflow list --type feature --status new

  # Get item details (using ID prefix)
  yarn agent-workflow get a1b2c3d4

  # Update item status
  yarn agent-workflow update a1b2c3d4 --status in_progress

  # Update feature priority
  yarn agent-workflow update a1b2c3d4 --priority high

  # Preview update without applying
  yarn agent-workflow update a1b2c3d4 --status done --dry-run

  # Download issue log from S3
  yarn agent-workflow log 42

  # Download log to custom path
  yarn agent-workflow log 42 --output ./my-logs/issue-42.md
`);
}

async function main(): Promise<void> {
    const [command, ...args] = process.argv.slice(2);

    if (!command || command === '--help' || command === '-h') {
        printUsage();
        process.exit(0);
    }

    const handler = COMMANDS[command];
    if (!handler) {
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }

    try {
        await handler(args);
        process.exit(0);
    } catch (error) {
        console.error('\nError:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
