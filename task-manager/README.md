# Task Manager

Centralized task management system for tracking and implementing project tasks.

## 📁 Contents

| File | Description |
|------|-------------|
| **tasks.md** | Main task list (project-specific, never syncs to child projects) |
| **TASK_FORMAT.md** | Task format specification - standardized structure |
| **tasks-cli.ts** | CLI tool for manual task management |
| **TASK_COMMANDS.md** | Quick reference for both slash commands and CLI |
| **SLASH_COMMANDS_README.md** | Complete guide for Claude Code slash commands |
| **task-management-cli.md** | Detailed documentation for CLI tools |
| **.sync-info.md** | Template sync behavior (all files sync except tasks.md) |

## 🚀 Quick Start

### Claude Code Slash Commands (Automated)

```bash
# Create a new task interactively
/add-task

# List all tasks
/task-list

# Claude implements the task
/start-task 1

# Claude implements in worktree
/start-task-worktree 3
```

### CLI Commands (Manual)

```bash
# List tasks
yarn task list

# Start working on task
yarn task work --task 1

# Create worktree
yarn task worktree --task 3

# Mark task as done
yarn task mark-done --task 1
```

## 📚 Documentation

- **Quick Start**: [TASK_COMMANDS.md](TASK_COMMANDS.md)
- **Slash Commands Guide**: [SLASH_COMMANDS_README.md](SLASH_COMMANDS_README.md)
- **CLI Tools Guide**: [task-management-cli.md](task-management-cli.md)

## 🎯 Workflow

1. **List tasks**: `/task-list` or `yarn task list`
2. **Implement**: `/start-task N` or `yarn task work --task N`
3. **Create PR**: Automated by slash command or manual
4. **After merge**: `yarn task mark-done --task N`

## 📝 Task Structure

Tasks in `tasks.md` follow this format:

```markdown
## 1. Task Title

| Priority | Complexity | Size |
|----------|------------|------|
| **Critical** | Low | XS |

**Summary:** One-line description

**Implementation Details:**
- What needs to be done
- Files to modify
- Code examples

**Files to Modify:**
- `path/to/file.ts` - What to change
```

## 🔧 For Developers

### Adding New Tasks

Edit `tasks.md` and add to the appropriate priority section:
- 🔴 Critical
- 🟠 High
- 🟡 Medium
- 🟢 Low

### Task Sizes

- **XS**: 1 file, < 50 lines
- **S**: 2-5 files, < 100 lines
- **M**: 5-15 files, < 500 lines
- **L**: 15-30 files, < 1000 lines
- **XL**: 30+ files, > 1000 lines

### Integration

The task system integrates with:
- **Git**: Automatic branch creation
- **GitHub PR Tool**: `yarn github-pr`
- **Validation**: `yarn checks`
- **Agent Workflows**: GitHub Projects integration

## 🎨 Features

### Slash Commands
- ✅ Automated implementation
- ✅ Built-in validation
- ✅ Auto PR creation
- ✅ Progress tracking

### CLI Tools
- ✅ Manual control
- ✅ Git branch management
- ✅ Worktree support
- ✅ Task completion tracking

## 🔗 Related

- Main documentation: [../CLAUDE.md](../CLAUDE.md)
- GitHub Projects: [../docs/github-projects-integration.md](../docs/github-projects-integration.md)
- GitHub PR Tool: [../CLAUDE.md#github-pr-cli-tool](../CLAUDE.md#github-pr-cli-tool)
