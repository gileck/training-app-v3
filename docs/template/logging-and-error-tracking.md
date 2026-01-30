# Logging, Bug Reporting, and Error Tracking

This document describes the application's logging system, bug reporting feature, and automatic error tracking.

## Table of Contents

1. [Overview](#overview)
2. [Session Logger](#session-logger)
3. [Bug Reporting](#bug-reporting)
4. [Error Tracking](#error-tracking)
5. [Reports Dashboard](#reports-dashboard)
6. [Debugging Reports](#debugging-reports)

---

## Overview

The application includes a comprehensive logging and reporting system:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Application                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐                                       │
│  │   Session Logger     │ ← All events logged here              │
│  │   (Zustand store)    │                                       │
│  │   • API calls        │                                       │
│  │   • User actions     │                                       │
│  │   • Network changes  │                                       │
│  │   • Component events │                                       │
│  └──────────┬───────────┘                                       │
│             │                                                    │
│   ┌─────────┴─────────┬─────────────────┐                       │
│   │                   │                 │                        │
│   ▼                   ▼                 ▼                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │Bug Report  │  │Error Track │  │Performance │                 │
│  │(user init) │  │(automatic) │  │(user init) │                 │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                 │
│        │               │               │                         │
│        └───────────────┴───────────────┘                         │
│                        │                                         │
│                        ▼                                         │
│              ┌──────────────────┐                                │
│              │  Reports API     │                                │
│              │  + MongoDB       │                                │
│              └──────────────────┘                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Session Logger

### What is Logged

The session logger captures all significant events during a user session:

| Category | Events |
|----------|--------|
| **API Calls** | Request start, response (with duration, cache status) |
| **User Actions** | Page views, button clicks, form submissions |
| **Network** | Online/offline status changes |
| **Errors** | Unhandled exceptions, promise rejections |
| **Performance** | `performance.now()` timestamps on all logs |

### Log Format

```typescript
interface SessionLog {
    id: string;
    timestamp: string;           // ISO timestamp
    performanceTime: number;     // ms since page load
    level: 'info' | 'warn' | 'error' | 'debug';
    feature: string;             // e.g., 'todos', 'api', 'network'
    message: string;
    meta?: Record<string, unknown>;
    route?: string;              // Current route
    networkStatus: 'online' | 'offline';
}
```

### Using the Logger

```typescript
import { logger } from '@/client/features/session-logs';

// Basic logging
logger.info('todos', 'Todo created successfully', { meta: { title: 'My Todo' } });
logger.warn('network', 'Connection lost');
logger.error('auth', 'Login failed', { meta: { error: 'Invalid credentials' } });

// API logging (automatic via apiClient)
logger.apiRequest('todos/create', { title: 'My Todo' });
logger.apiResponse('todos/create', response, { duration: 150, cached: false });
```

### Console Output Control

By default, only `warn` and `error` logs print to console. Use browser console to control output:

```javascript
// Enable all console logs
enableLogs();

// Enable logs for specific features
enableLogs('api');
enableLogs(['api', 'todos']);

// Disable console logs (back to warn/error only)
disableLogs();

// Print existing logs
printLogs();                    // All logs
printLogs('api');               // Filter by feature
printLogs('api', 10);           // Last 10 API logs

// Get raw log data
getSessionLogs();               // Returns array
getLogConfig();                 // Current config
```

### Log Storage

- **In-memory**: Zustand store (`useSessionLogsStore`)
- **Capacity**: Last 500 entries (oldest removed when full)
- **Not persisted**: Cleared on page refresh

---

## Bug Reporting

Users can report bugs via a dialog accessible from the menu.

### Opening the Bug Report Dialog

```typescript
import { useBugReportStore, BugReportDialog } from '@/client/features/bug-report';

// In your component
const openBugReport = useBugReportStore((s) => s.openDialog);

// Trigger the dialog
<Button onClick={() => openBugReport()}>Report Bug</Button>

// The dialog component (in Layout.tsx)
<BugReportDialog />
```

### Report Types

| Type | Description | Extra Data |
|------|-------------|------------|
| **Bug** | General bug report | Description, screenshot |
| **Performance** | Slow loading or interactions | `performance.getEntries()` |

### Data Collected

When a bug is reported, the following is captured:

```typescript
interface BugReport {
    type: 'bug' | 'performance';
    description: string;          // User-provided
    screenshot?: string;          // Base64 (optional)
    route: string;                // Current page
    networkStatus: 'online' | 'offline';
    sessionLogs: SessionLog[];    // All session logs
    userInfo: {
        userId?: string;
        username?: string;
    };
    browserInfo: {
        userAgent: string;
        viewport: { width, height };
        language: string;
    };
    performanceEntries?: PerformanceEntry[];  // For performance bugs
}
```

### Toast Notifications

After submission:
- ✅ Success: "Bug report submitted successfully"
- ❌ Error: "Failed to submit bug report"

---

## Error Tracking

Unhandled errors are automatically captured and reported.

### Global Error Handler

```typescript
// src/client/features/error-tracking/useGlobalErrorHandler.ts
useEffect(() => {
    const handleError = (event: ErrorEvent) => {
        // Capture and report error
        submitErrorReport(event.error);
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleRejection);
    };
}, []);
```

### Error Boundary

React component errors are caught by `ErrorBoundary`:

```typescript
// src/client/features/error-tracking/ErrorBoundary.tsx
<ErrorBoundary>
    {children}
</ErrorBoundary>
```

### Error Report Data

```typescript
interface ErrorReport {
    type: 'error';
    errorMessage: string;
    stackTrace: string;
    route: string;
    networkStatus: 'online' | 'offline';
    sessionLogs: SessionLog[];
    userInfo: { userId?, username? };
    browserInfo: { userAgent, viewport, language };
}
```

---

## Reports Dashboard

View all bugs and errors at `/reports`.

### Features

- **List View**: All reports sorted by date (newest first)
- **Grouped View**: Group by error message with count
- **Filtering**: Filter by type (bug, error, performance), status
- **Status Management**: new → investigating → resolved → closed
- **Copy Details**: Copy full report for debugging (AI-friendly format)
- **Copy ID**: Copy report ID for script-based retrieval

### Report Statuses

| Status | Description |
|--------|-------------|
| `new` | Just reported, not yet reviewed |
| `investigating` | Being looked into |
| `resolved` | Fixed |
| `closed` | Won't fix or duplicate |

### Accessing Reports

The dashboard is a public route (no auth required for viewing).

---

## Debugging Reports

### Using the Debug Script

Fetch a report directly from MongoDB:

```bash
node scripts/get-report.mjs <report-id>
```

Output includes:
- Full report metadata
- User and browser info
- All session logs (formatted)
- Performance entries (for performance bugs)
- Stack trace (for errors)

### Cursor Command for Debugging

Use the `/debug-bug-report` command in Cursor:

```
/debug-bug-report

Paste the report details and I'll help debug the root cause.
```

The command provides:
1. Report context analysis
2. Session log timeline review
3. Error identification
4. Suggested fixes

### Copy Details Format

The "Copy Details" button produces an AI-friendly format:

```
================================================================================
BUG/ERROR REPORT
================================================================================

REPORT METADATA
---------------
- Report ID: 692f08157586bdebbe6f3042
- Type: BUG (performance)
- Status: new
- Created: 12/2/2025, 5:39:01 PM

CONTEXT
-------
- Route/Page: /todos
- Network Status: online

DESCRIPTION
-----------
User's description of the bug...

SESSION LOGS (16 entries)
--------------------------------------------------
[2025-12-02T15:38:30.590Z] [+294ms] [INFO] [todos] Todos page viewed
[2025-12-02T15:38:32.227Z] [+1931ms] [INFO] [api] API Request: todos/getTodos
...

================================================================================
END OF REPORT
================================================================================
```

---

## GitHub Integration (Bug Workflow)

Bug reports and error reports can be approved and synced to GitHub Issues for tracking in the development workflow.

### Workflow Overview

1. **User submits bug** (via Bug Report dialog) OR **Runtime error captured** (automatic)
2. **MongoDB storage** → Report stored with status 'new', includes session logs, screenshot, stack trace
3. **Telegram notification** → Admin receives notification with "Approve" button
4. **Admin approves** → GitHub issue created with 'bug' label, added to GitHub Projects (Backlog)
5. **Admin routes** → Via Telegram buttons: Tech Design, Ready for development, or Backlog
6. **AI agents process** → Tech Design analyzes root cause, Implementation agent creates fix and PR
7. **PR merged** → GitHub Action automatically marks issue as Done

### What Gets Synced to GitHub

When a bug report is approved:
- **GitHub Issue**: Created with bug label
- **Session Logs**: Included in issue description for debugging context
- **Stack Trace**: For error reports
- **Screenshot**: Attached to issue (if provided)
- **User Info**: Reporter details and browser environment

### Agent Processing

The Tech Design and Implementation agents have bug-aware prompts that:
- Load diagnostics from MongoDB (session logs, stack trace, browser info)
- Generate root cause analysis for bugs
- Create fix branches (`fix/issue-#-title`)
- Include bug context in PR descriptions

### Complete Documentation

For the full bug workflow including:
- Setup and configuration
- Telegram approval flow
- Admin routing options
- Agent prompts and behavior
- PR creation and merge automation

See **[GitHub Projects Integration](./github-projects-integration.md)** → "Bug Reports" section.

---

## File Structure

```
src/client/features/
├── session-logs/
│   ├── store.ts          # Zustand store for logs
│   ├── logger.ts         # Logger utility
│   ├── types.ts          # SessionLog, LogLevel types
│   ├── useNetworkLogger.ts  # Network status change logger
│   └── index.ts
│
├── bug-report/
│   ├── store.ts          # Dialog state
│   ├── hooks.ts          # useSubmitBugReport
│   ├── BugReportDialog.tsx
│   ├── types.ts
│   └── index.ts
│
├── error-tracking/
│   ├── useGlobalErrorHandler.ts
│   ├── ErrorBoundary.tsx
│   ├── types.ts
│   └── index.ts
│
src/apis/reports/
├── handlers/
│   ├── createReport.ts
│   ├── getReports.ts
│   ├── getReport.ts
│   └── updateReportStatus.ts
├── types.ts
├── client.ts
├── server.ts
└── index.ts

src/server/database/collections/reports/
├── reports.ts            # MongoDB operations
├── types.ts              # ReportDocument type
└── index.ts

src/client/routes/Reports/
├── Reports.tsx           # Dashboard component
├── hooks.ts              # useReports, useUpdateReportStatus
└── index.ts

scripts/
└── get-report.mjs        # CLI script to fetch report

.cursor/commands/
└── debug-bug-report.md   # Cursor command for debugging
```

---

## Best Practices

### Adding Logs to Components

```typescript
import { logger } from '@/client/features/session-logs';

function MyComponent() {
    useEffect(() => {
        logger.info('my-feature', 'Component mounted', { meta: { someContext } });
    }, []);
    
    const handleClick = () => {
        logger.info('my-feature', 'Button clicked', { meta: { buttonId } });
        // ... action
    };
}
```

### Log Levels

| Level | Use For |
|-------|---------|
| `debug` | Detailed debugging info (not shown by default) |
| `info` | Normal operations, user actions |
| `warn` | Recoverable issues, network problems |
| `error` | Exceptions, failed operations |

### Feature Names

Use consistent feature names for filtering:

| Feature | Description |
|---------|-------------|
| `api` | API requests/responses |
| `network` | Network status changes |
| `cache` | Cache operations |
| `todos` | Todo-specific actions |
| `auth` | Authentication events |
| `error-tracking` | Caught errors |

---

## Related Documentation

- [Architecture](./architecture.md) - Overall system design
- [Caching Strategy](./caching-strategy.md) - How caching works
- [Offline PWA Support](./offline-pwa-support.md) - Offline behavior

