---
title: Agent Workflow CLI
description: CLI for managing workflow items. Use this when working with `yarn agent-workflow` commands.
summary: "Commands: `start` (interactive), `create` (new item), `list` (filter items), `get` (details + live pipeline status), `update` (change status/priority/size/complexity/domain). Supports `--auto-approve`, `--route`, and `--created-by` for automated workflows."
priority: 3
key_points:
  - "list command: filter by --type, --status, --domain"
  - "get command: shows workflow item details (artifacts, history, createdBy, description)"
  - "update command: change status/priority/size/complexity/domain with --dry-run"
  - "ID lookup: workflow-item ObjectId, ID prefix (first 8 chars), or GitHub issue number"
  - "create command: creates GitHub issue + workflow-item directly (no source docs)"
related_docs:
  - overview.md
  - workflow-e2e.md
---

# Agent Workflow CLI

Command-line interface for managing workflow items in the GitHub agents workflow pipeline.

All CLI commands operate directly on the **workflow-items** MongoDB collection. Source documents (feature-requests, reports) are used only by UI/Telegram intake flows.

## Quick Start

```bash
# Interactive mode - guided prompts
yarn agent-workflow start

# List all items
yarn agent-workflow list

# Get details of a specific item (supports ID prefix or issue number)
yarn agent-workflow get 697f15ce
yarn agent-workflow get 42

# Create a workflow item + GitHub issue
yarn agent-workflow create --type feature --title "Add dark mode" --description "User can toggle theme"

# Update item status
yarn agent-workflow update 697f15ce --status "Technical Design"
```

## ID Lookup

All commands that accept `<id>` support three lookup methods:

| Method | Example | Description |
|--------|---------|-------------|
| Full ObjectId | `697f15cee8f23c43f4208adb` | Exact 24-char workflow-item ID |
| ID prefix | `697f15ce` | First 6+ chars of workflow-item ID |
| Issue number | `42` | GitHub issue number |

## Commands

### `start` - Interactive Mode

Launches an interactive prompt that guides you through creating a workflow item:

```bash
yarn agent-workflow start
```

Prompts for:
- Type (feature or bug)
- Title
- Description
- Priority (features only)
- Route to phase

### `create` - Direct Creation

Create a workflow item and GitHub issue directly:

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
| `--route <phase>` | Initial status/phase: `product-dev`, `product-design`, `tech-design`, `implementation`, `backlog` |
| `--priority <level>` | Priority: `low`, `medium`, `high`, `critical` |
| `--size <size>` | Estimated size: `XS`, `S`, `M`, `L`, `XL` |
| `--complexity <level>` | Complexity level: `High`, `Medium`, `Low` |
| `--domain <domain>` | Domain classification (free-form, e.g., `ui`, `api`, `agents`) |
| `--created-by <agent>` | Agent attribution (e.g., `workflow-review`, `repo-commits-code-reviewer`) |
| `--auto-approve` | Accepted for backward compatibility (no-op, all CLI creates are direct) |
| `--dry-run` | Preview without creating |

**What create does:**
1. Creates a GitHub issue with title, description, and labels
2. Creates a workflow-item in MongoDB (no source doc)
3. Sets initial status from `--route` (defaults to Backlog)
4. Writes agent log header for the issue
5. Creates artifact comment on the GitHub issue

### `list` - List Items

List workflow items with optional filters:

```bash
yarn agent-workflow list [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--type <type>` | Filter by type: `feature` or `bug` |
| `--status <status>` | Filter by pipeline status: `Backlog`, `Product Design`, `Technical Design`, etc. |
| `--domain <domain>` | Filter by domain: `ui`, `api`, `agents`, etc. |

**Output columns:** ID (8-char prefix), TYPE, STATUS, TITLE, DOMAIN, ISSUE#, UPDATED

**Examples:**
```bash
# List all items
yarn agent-workflow list

# List only features
yarn agent-workflow list --type feature

# List items in Backlog
yarn agent-workflow list --status Backlog

# List items in a specific domain
yarn agent-workflow list --domain api
```

### `get` - Get Item Details

Get full details of a workflow item:

```bash
yarn agent-workflow get <id>
```

**Features:**
- Supports ID prefix matching, full ObjectId, or GitHub issue number
- Displays all workflow-item fields including description
- Shows artifacts: designs, phases, task branch, commit messages, decisions
- Shows history timeline with timestamps and actors

**Examples:**
```bash
# Get item by full ID
yarn agent-workflow get 697f15cee8f23c43f4208adb

# Get item by ID prefix (first 8 chars)
yarn agent-workflow get 697f15ce

# Get item by GitHub issue number
yarn agent-workflow get 42
```

### `update` - Update Item

Update fields on a workflow item:

```bash
yarn agent-workflow update <id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--status <status>` | Pipeline status: `Backlog`, `Product Design`, `Technical Design`, `Ready for development`, etc. |
| `--priority <level>` | Priority: `low`, `medium`, `high`, `critical` |
| `--size <size>` | Estimated size: `XS`, `S`, `M`, `L`, `XL` |
| `--complexity <level>` | Complexity level: `High`, `Medium`, `Low` |
| `--domain <domain>` | Domain classification |
| `--dry-run` | Preview changes without applying |

**Examples:**
```bash
# Update status to a pipeline phase
yarn agent-workflow update 697f15ce --status "Technical Design"

# Update priority
yarn agent-workflow update 697f15ce --priority high

# Update multiple fields at once
yarn agent-workflow update 697f15ce --priority critical --size L --complexity High

# Preview changes without applying
yarn agent-workflow update 697f15ce --status Done --dry-run
```

### `approve` - Approve Item

Approve a pending workflow item (source-doc-based, for UI/Telegram submissions):

```bash
yarn agent-workflow approve <id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--route <destination>` | Route immediately after approval: `product-dev`, `product-design`, `tech-design`, `implementation`, `backlog` |

### `route` - Route Item

Route a workflow item to a specific pipeline phase:

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
yarn agent-workflow route 42 --destination implementation

# Move back to backlog
yarn agent-workflow route 697f15ce --destination backlog
```

### `delete` - Delete Item

Delete a workflow item:

```bash
yarn agent-workflow delete <id> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--force` | Delete even if synced to GitHub |

**Notes:**
- Items synced to GitHub cannot be deleted without `--force`
- Deleting removes the workflow-item from MongoDB
- If a GitHub issue exists, it is closed with a comment
- No source doc cleanup needed (CLI-created items have no source doc)

---

## Routing Options

| Route | Status | Best For |
|-------|--------|----------|
| `product-dev` | Product Development | Vague ideas needing product spec |
| `product-design` | Product Design | Features needing visual design |
| `tech-design` | Technical Design | Complex bugs, architectural changes |
| `implementation` | Ready for development | Simple fixes, clear requirements |
| `backlog` | Backlog | Not ready to start |

## Flow Diagram

```
yarn agent-workflow create --type <type> --title "..." --description "..."
    |
    v
+----------------------------------+
| 1. Create GitHub Issue           |
|    (title, description, labels)  |
+----------------------------------+
    |
    v
+----------------------------------+
| 2. Create workflow-item          |
|    (no source doc)               |
|    status = --route or Backlog   |
+----------------------------------+
    |
    v
+----------------------------------+
| 3. Set extra fields              |
|    (priority, size, complexity,  |
|     domain, createdBy)           |
+----------------------------------+
    |
    v
+----------------------------------+
| 4. Write log header              |
|    + create artifact comment     |
+----------------------------------+
```

## See Also

- [Workflow Overview](./overview.md)
- [Running Agents](./running-agents.md)
- [Telegram Integration](./telegram-integration.md)
