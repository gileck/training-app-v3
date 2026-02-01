# Agent Workflow CLI

Command-line interface for creating feature requests and bug reports that feed into the GitHub agents workflow.

## Quick Start

```bash
# Interactive mode - guided prompts
yarn agent-workflow start

# Create and wait for approval via Telegram
yarn agent-workflow create --type feature --title "Add dark mode" --description "User can toggle theme"

# Auto-approve and sync to GitHub immediately
yarn agent-workflow create --type feature --title "Add dark mode" --description "User can toggle theme" --auto-approve

# Auto-approve and route directly to implementation (no notifications)
yarn agent-workflow create --type feature --title "Fix typo" --description "..." --route implementation
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
