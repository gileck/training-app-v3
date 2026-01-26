# MongoDB Status vs GitHub Project Status

The system uses a **two-tier status tracking** approach to eliminate duplication while providing both high-level lifecycle tracking and detailed workflow visibility.

## MongoDB Statuses (4 values)

MongoDB tracks the high-level lifecycle state of each submission and stores rich diagnostic data for bugs.

### Feature Requests
| Status | Meaning |
|--------|---------|
| `new` | Feature request submitted, not yet synced to GitHub |
| `in_progress` | Synced to GitHub (detailed status tracked in GitHub Projects) |
| `done` | Completed and merged |
| `rejected` | Not going to implement |

### Bug Reports
| Status | Meaning |
|--------|---------|
| `new` | Bug report submitted, not yet synced to GitHub |
| `investigating` | Synced to GitHub (detailed status tracked in GitHub Projects) |
| `resolved` | Fixed and merged |
| `closed` | Won't fix, duplicate, or not a bug |

## GitHub Project Statuses (6 values)

GitHub Projects tracks the detailed workflow steps through the development pipeline.

| Status | Meaning |
|--------|---------|
| `Backlog` | New items, not yet started |
| `Product Design` | AI generates product design, human reviews |
| `Technical Design` | AI generates tech design, human reviews |
| `Ready for development` | AI implements feature (picked up by implement agent) |
| `PR Review` | PR created, waiting for human review/merge |
| `Done` | Completed and merged |

## Why This Split?

This two-tier approach provides clear separation of concerns:

### MongoDB's Role
- **Tracks approval state and lifecycle**: new → in progress → done
- **Stores rich diagnostics for bugs**: Session logs, screenshots, stack traces, browser info
- **Separate collections**: `feature-requests` and `reports` (bugs need different data)
- **Provides user-facing API**: App UI displays MongoDB status for new/done/rejected items

### GitHub Projects' Role
- **Tracks detailed workflow steps**: Product Design → Tech Design → Ready for development → etc.
- **Enables agent coordination**: Each agent knows what phase to process
- **Review Status sub-tracking**: Within each phase (empty → Waiting for Review → Approved/etc.)
- **Provides admin workflow visibility**: Kanban board view of all items in progress

### No Duplication
When an item is `in_progress`/`investigating` in MongoDB, you check GitHub Projects for the detailed status. The app UI automatically shows GitHub Project status for synced items.

### Benefits

1. **Clean separation**: MongoDB = approval & diagnostics, GitHub = workflow
2. **No sync conflicts**: MongoDB status only changes at major lifecycle events (new → in_progress, in_progress → done)
3. **Flexible workflow**: Can change GitHub workflow columns without touching MongoDB schema
4. **Rich bug data**: Bug reports store session logs and diagnostics that features don't need
5. **Simple app UI**: Shows MongoDB status for new/done items, GitHub status for in-progress items

## Status Transitions

### Feature Request Lifecycle
```
new → (admin approves) → in_progress → (PR merges) → done
                              ↓
                      (admin rejects) → rejected
```

### Bug Report Lifecycle
```
new → (admin approves) → investigating → (fix merges) → resolved
                               ↓
                      (admin closes) → closed
```

### GitHub Workflow (while in_progress/investigating)
```
Backlog → Product Design → Technical Design → Ready for development → PR Review → Done
     ↓         ↓                  ↓                   ↓                    ↓
   (can skip phases based on admin routing decision)
```

## Related Documentation

- **[overview.md](./overview.md)** - Complete system overview
- **[setup-guide.md](./setup-guide.md)** - Setup instructions
