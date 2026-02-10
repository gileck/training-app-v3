---
title: Agent Workflow CLI
description: CLI for managing feature requests and bug reports. Use this when working with `yarn agent-workflow` commands.
summary: "Commands: `start` (interactive), `create` (new item), `list` (filter items), `get` (details + live pipeline status), `update` (change status/priority). Supports `--auto-approve` and `--route` for automated workflows."
priority: 3
key_points:
  - "list command: filter by --type, --status, --source"
  - "get command: shows live pipeline status"
  - "update command: change status/priority with --dry-run"
  - "ID prefix matching supported (first 8 chars of ObjectId)"
related_docs:
  - overview.md
  - workflow-e2e.md
---

# Agent Workflow CLI

Command-line interface for managing feature requests and bug reports that feed into the GitHub agents workflow.

## Quick Start

```bash
# Interactive mode - guided prompts
yarn agent-workflow start

# List all items
yarn agent-workflow list

# Get details of a specific item (supports ID prefix)
yarn agent-workflow get 697f15ce

# Create and wait for approval via Telegram
yarn agent-workflow create --type feature --title "Add dark mode" --description "User can toggle theme"

# Auto-approve and sync to GitHub immediately
yarn agent-workflow create --type feature --title "Add dark mode" --description "User can toggle theme" --auto-approve

# Update item status
yarn agent-workflow update 697f15ce --status in_progress
```

## Commands

### `start` - Interactive Mode

Launches an interactive prompt that guides you through all options:

```bash
yarn agent-workflow start
```

Prompts for:
- Type (feature or bug)
- Title
- Description
- Priority (features only)
- Auto-approve vs wait for Telegram approval
- Route to phase (if auto-approving)

### `create` - Direct Creation

Create a feature request or bug report with named arguments:

```bash
yarn agent-workflow create [options]
```

**Required options:**
| Option | Description |
|--------|-------------|
| `--type <type>` | `feature` or `bug` |
| `--title <title>` | Title of the request |
| `--description <desc>` | Detailed description |

**Optional options:**
| Option | Description |
|--------|-------------|
| `--auto-approve` | Skip approval notification, sync to GitHub immediately |
| `--route <phase>` | Auto-route to phase (implies `--auto-approve`): `product-dev`, `product-design`, `tech-design`, `implementation`, `backlog` |
| `--priority <level>` | Priority: `low`, `medium`, `high`, `critical` (features only) |
| `--dry-run` | Preview without creating |

### `list` - List Items

List feature requests and bug reports with optional filters:

```bash
yarn agent-workflow list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--type <type>` | Filter by type: `feature` or `bug` |
| `--status <status>` | Filter by status: `new`, `in_progress`, `done`, `resolved`, `rejected` |
| `--source <source>` | Filter by source: `ui`, `cli`, `auto` |

**Examples:**
```bash
# List all items
yarn agent-workflow list

# List only features
yarn agent-workflow list --type feature

# List new bug reports
yarn agent-workflow list --type bug --status new

# List items created via CLI
yarn agent-workflow list --source cli
```

### `get` - Get Item Details

Get full details of a specific item by ID or ID prefix:

```bash
yarn agent-workflow get <id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--type <type>` | Hint which collection to search: `feature` or `bug` |

**Features:**
- Supports ID prefix matching (e.g., `697f15ce` matches full ObjectId)
- Displays pipeline status and review status from workflow-items collection
- Shows all item details including comments, admin notes, investigation info

**Examples:**
```bash
# Get item by full ID
yarn agent-workflow get 697f15cee8f23c43f4208adb

# Get item by ID prefix (first 8 chars)
yarn agent-workflow get 697f15ce

# Get feature by ID (faster lookup)
yarn agent-workflow get 697f15ce --type feature
```

**Output includes:**
- Basic info: ID, title, status, priority, source, dates
- GitHub Issue link and number (if synced)
- Pipeline status (from workflow-items collection)
- Description and admin notes
- Comments with timestamps and authors
- For bugs: error message, browser info, investigation details

### `update` - Update Item

Update status, priority, or other fields of an item:

```bash
yarn agent-workflow update <id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--status <status>` | New status: `new`, `in_progress`, `done`, `resolved`, `rejected` |
| `--priority <level>` | New priority: `low`, `medium`, `high`, `critical` (features only) |
| `--type <type>` | Hint which collection to search: `feature` or `bug` |
| `--dry-run` | Preview changes without applying |

**Examples:**
```bash
# Update status
yarn agent-workflow update 697f15ce --status in_progress

# Update priority
yarn agent-workflow update 697f15ce --priority high

# Preview changes without applying
yarn agent-workflow update 697f15ce --status done --dry-run
```

### `approve` - Approve Item

Approve a pending workflow item (creates GitHub issue and optionally routes):

```bash
yarn agent-workflow approve <id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--route <destination>` | Route immediately after approval: `product-dev`, `product-design`, `tech-design`, `implementation`, `backlog` |

**Examples:**
```bash
# Approve and wait for routing via Telegram
yarn agent-workflow approve 697f15ce

# Approve and route directly to tech design
yarn agent-workflow approve 697f15ce --route tech-design

# Approve and route to implementation (skip all design)
yarn agent-workflow approve 697f15ce --route implementation
```

### `route` - Route Item

Route an already-approved item to a workflow phase:

```bash
yarn agent-workflow route <id> --destination <destination>
```

**Required options:**
| Option | Description |
|--------|-------------|
| `--destination <dest>` | Target phase: `product-dev`, `product-design`, `tech-design`, `implementation`, `backlog` |

**Examples:**
```bash
# Route to tech design
yarn agent-workflow route 697f15ce --destination tech-design

# Route to implementation
yarn agent-workflow route 697f15ce --destination implementation

# Move back to backlog
yarn agent-workflow route 697f15ce --destination backlog
```

**Valid destinations:**

| Destination | Description | Best For |
|-------------|-------------|----------|
| `product-dev` | Product development phase (features only) | Vague ideas needing product spec |
| `product-design` | UX/UI design phase | Features needing visual design |
| `tech-design` | Technical architecture phase | Complex bugs, architectural changes |
| `implementation` | Skip design, go to coding | Simple fixes, clear requirements |
| `backlog` | Keep in backlog | Not ready to start |

### `delete` - Delete Item

Delete a workflow item from the system:

```bash
yarn agent-workflow delete <id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--force` | Delete even if already synced to GitHub (source doc only -- GitHub issue remains) |

**Examples:**
```bash
# Delete a pending item (not yet synced to GitHub)
yarn agent-workflow delete 697f15ce

# Force delete an item that was already synced to GitHub
yarn agent-workflow delete 697f15ce --force
```

**Notes:**
- By default, items that have already been synced to GitHub cannot be deleted. Use `--force` to override.
- Deleting removes the source document (feature-request or report) and the workflow-items entry.
- The GitHub issue (if any) is not affected by deletion.
- A Telegram notification is sent confirming the deletion.

---

## Workflow Modes

### Default (no flags)
Creates item and waits for Telegram approval:
1. Creates MongoDB document with `status: 'new'`
2. Sends approval notification to Telegram with "Approve" button
3. Item stays in MongoDB until admin approves via Telegram
4. On approval: syncs to GitHub and sends routing notification

### With `--auto-approve`
Immediately syncs to GitHub and asks for routing:
1. Creates MongoDB document with `status: 'in_progress'`
2. Syncs to GitHub (creates issue on Projects board in Backlog)
3. Sends routing notification to Telegram (asks where to route)

### With `--route <phase>` (implies `--auto-approve`)
Immediately syncs and routes without any notifications:
1. Creates MongoDB document with `status: 'in_progress'`
2. Syncs to GitHub (creates issue on Projects board)
3. Auto-moves to specified phase (no Telegram notifications)

## Examples

### Feature Requests

```bash
# Create and wait for approval via Telegram
yarn agent-workflow create \
  --type feature \
  --title "Add dark mode toggle" \
  --description "User should be able to toggle between light and dark themes"

# Auto-approve and sync (sends routing notification)
yarn agent-workflow create \
  --type feature \
  --title "Add dark mode toggle" \
  --description "User should be able to toggle themes" \
  --auto-approve

# High priority feature with auto-approve
yarn agent-workflow create \
  --type feature \
  --title "Security fix" \
  --description "XSS vulnerability in comments" \
  --priority critical \
  --auto-approve

# Skip all notifications - route directly to implementation
yarn agent-workflow create \
  --type feature \
  --title "Fix typo in header" \
  --description "Header says 'Welcom' instead of 'Welcome'" \
  --route implementation
```

### Bug Reports

```bash
# Create and wait for approval via Telegram
yarn agent-workflow create \
  --type bug \
  --title "Login button not working" \
  --description "Button doesn't respond to taps on iOS Safari"

# Auto-approve and sync (sends routing notification)
yarn agent-workflow create \
  --type bug \
  --title "Login button not working" \
  --description "Details here" \
  --auto-approve

# Route directly to tech design (recommended for complex bugs)
yarn agent-workflow create \
  --type bug \
  --title "API timeout on large requests" \
  --description "Requests over 1MB fail after 30 seconds" \
  --route tech-design
```

## Routing Options

| Route | Description | Best For |
|-------|-------------|----------|
| `product-dev` | Product development phase (vague ideas) | Needs product spec |
| `product-design` | UX/UI design phase | Features needing visual design |
| `tech-design` | Technical architecture phase | Complex bugs, architectural changes |
| `implementation` | Skip design, go to coding | Simple fixes, clear requirements |
| `backlog` | Keep in backlog | Not ready to start |

## Flow Diagram

```
yarn agent-workflow create --type <type> --title "..." --description "..."
    │
    ▼
┌─────────────────────────────────┐
│ Parse command & options         │
│ - --type: feature | bug         │
│ - --title, --description        │
│ - --auto-approve (optional)     │
│ - --route, --priority (optional)│
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ --auto-approve specified?       │
│ (or --route which implies it)   │
└─────────────┬───────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
   NO                  YES
    │                   │
    ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ Create with   │   │ Create with   │
│ status: 'new' │   │ status:       │
│               │   │ 'in_progress' │
└───────┬───────┘   └───────┬───────┘
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ Send approval │   │ Sync to       │
│ notification  │   │ GitHub        │
│ to Telegram   │   └───────┬───────┘
└───────────────┘           │
                            ▼
                  ┌─────────────────────┐
                  │ --route specified?  │
                  └─────────┬───────────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
                  ▼                   ▼
                 NO                  YES
                  │                   │
                  ▼                   ▼
          ┌───────────────┐   ┌───────────────┐
          │ Send routing  │   │ Auto-route    │
          │ notification  │   │ to phase      │
          │ to Telegram   │   │ (no notif)    │
          └───────────────┘   └───────────────┘
```

## See Also

- [Workflow Overview](./overview.md)
- [Running Agents](./running-agents.md)
- [Telegram Integration](./telegram-integration.md)
