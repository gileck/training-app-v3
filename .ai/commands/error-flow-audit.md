# Error Flow Audit

You are performing a comprehensive audit of **every error flow** in the application. The goal is to ensure that every place an error can occur provides:

1. A **user-friendly error message** (not raw stack traces or cryptic messages)
2. A way to **view full technical details** (error message + stack trace)
3. A **copy button** to copy the full error details (for bug reports / developer debugging)
4. Appropriate **contextual actions** (retry, go back, reload, etc.)
5. For **network errors** specifically: clear indication that it's a connectivity issue with retry option
6. For **server errors**: the server must return structured error info including stack traces (in non-production) or error IDs

---

## Audit Scope Selection

Before starting the audit, determine the scope. The user may have specified a scope when invoking the command (e.g. `/error-flow-audit project only`). If not, ask the user which scope to audit:

| Scope | What to scan | What to skip |
|-------|-------------|--------------|
| **Project only** | `*/project/**`, `*.project.ts`, `src/pages/` | All `*/template/**` and `*.template.ts` paths |
| **Template only** | `*/template/**`, `*.template.ts`, `src/pages/` | All `*/project/**` and `*.project.ts` paths |
| **Project + Template** | Everything in `src/` | Nothing |

The ownership model is defined in `docs/template/project-structure-guidelines.md`. In short:
- **Template-owned**: `src/client/features/template/`, `src/client/routes/template/`, `src/client/components/template/`, `src/apis/template/`, `src/server/database/collections/template/`, `*.template.ts`
- **Project-owned**: `src/client/features/project/`, `src/client/routes/project/`, `src/client/components/project/`, `src/apis/project/`, `src/server/database/collections/project/`, `*.project.ts`
- **Shared infrastructure** (`src/pages/`, `src/server/template/utils/`, `src/client/utils/`, `src/client/stores/`, `src/client/query/`) is included in all scopes.

When searching, filter results to only include files within the selected scope.

---

## Audit Approach: Dynamic Discovery

**This audit does NOT use a hardcoded checklist.** Instead, you will scan the codebase dynamically to discover all error flows. This means the audit stays accurate as the codebase evolves.

---

## Phase 1: Discovery - Find ALL Error Flows

Scan the entire codebase to discover every place where errors are produced, caught, displayed, or handled. Use grep/glob to search for the patterns below. Let the project structure guide you to where these patterns exist — don't assume locations.

### How to Find Error Flows

Search for these **code patterns** across the entire `src/` directory. Each pattern reveals a different category of error flow:

#### Error Production Patterns (where errors originate)
- `throw` / `throw new Error` — explicit error throwing
- `{ error:` / `error:` in return statements — structured error responses from APIs
- `new Error(` — error construction
- `console.error` — logged errors (may or may not be surfaced to user)
- `reject(` — promise rejections

#### Error Catching Patterns (where errors are intercepted)
- `catch` / `.catch(` — try/catch blocks and promise catch handlers
- `onError` — React Query mutation/query error callbacks
- `componentDidCatch` — React error boundaries
- `addEventListener('error'` / `addEventListener('unhandledrejection'` — global error handlers

#### Error Display Patterns (what the user sees)
- `isError` / `error)` / `if (error` — conditional error rendering in components
- `toast` / `alert` / `dialog` — notification/popup error display
- Components with "Error" in name — dedicated error UI components
- `error.message` / `err.message` — places where error text is rendered

#### Network Error Patterns (connectivity-specific)
- `navigator.onLine` — online/offline detection
- `TypeError` in catch blocks — fetch network failures throw TypeError
- `offline` / `isOffline` — offline mode handling
- `retry` / `retries` / `backoff` — retry logic after failures
- `timeout` / `AbortController` — request timeout handling

#### Notification/External Service Patterns
- `telegram` / `sendMessage` / `sendNotification` — notification system errors
- `webhook` — webhook delivery failures
- External API calls and their error handling

#### Error Infrastructure Patterns
- `clipboard` / `navigator.clipboard` / `copy` — copy-to-clipboard for error details
- `ErrorBoundary` / `ErrorDialog` — reusable error components
- `submitErrorReport` / `reportError` — error reporting utilities
- `stack` / `stackTrace` — stack trace handling

### What to Document for Each Error Flow

For each error flow discovered, answer these questions:

| Question | Why It Matters |
|----------|---------------|
| **Where does the error originate?** (file:line) | Traceability |
| **What error message does the user see?** | Is it user-friendly? |
| **Can the user view full technical details?** | Expandable error info |
| **Can the user copy the error?** | For bug reports |
| **Is there a retry/recovery action?** | Helpful next step |
| **Is network error distinguished?** | Connectivity vs other errors |
| **Is the error silently swallowed?** | Hidden failures |
| **Does the server include stack/details?** | Debugging capability |

---

## Phase 2: Define the Standard

Based on the discovery, define what EVERY error flow should look like. The standard is:

### For Client-Displayed Errors (API errors, runtime errors):

```
+------------------------------------------+
|  [Error Icon]  Something went wrong       |
|                                           |
|  A friendly description of what happened  |
|  (e.g. "Failed to save your changes")    |
|                                           |
|  [View Details]  [Copy Error]  [Retry]   |
+------------------------------------------+

When "View Details" is clicked:
+------------------------------------------+
|  Error: <original error message>          |
|  Stack: <stack trace if available>        |
|  API: <api name if applicable>            |
|  Time: <timestamp>                        |
|                                           |
|  [Copy All]  [Close]                     |
+------------------------------------------+
```

### For Network Errors:

```
+------------------------------------------+
|  [Wifi-Off Icon]  Connection Problem      |
|                                           |
|  Unable to reach the server.              |
|  Check your internet connection.          |
|                                           |
|  [Retry]  [Work Offline]                 |
+------------------------------------------+
```

### For Server API Responses:

Every API error response should include:
```typescript
{
  error: string;           // User-friendly message
  errorCode?: string;      // Machine-readable error code
  details?: string;        // Technical details (stack in dev, error ID in prod)
}
```

### For Telegram/Notification Errors:

Telegram is a "client" of the server - errors should be logged with full context:
```
- Error message with the operation that failed
- The payload that failed to send
- The Telegram API response/error
- Retry information
```

---

## Phase 3: Gap Analysis

Compare every discovered error flow against the standard. Create a findings table:

### Finding Categories:

| Category | Description |
|----------|-------------|
| **MISSING_USER_MESSAGE** | Error caught but no user-friendly message shown |
| **NO_COPY_BUTTON** | Error displayed but no way to copy details |
| **NO_DETAILS_VIEW** | Error shown but no expandable technical details |
| **NO_RETRY_ACTION** | Error shown but no retry/recovery action |
| **NETWORK_NOT_DISTINGUISHED** | Network error treated same as other errors |
| **SILENT_FAILURE** | Error caught and silently swallowed |
| **RAW_ERROR_SHOWN** | Raw error message/stack shown to user |
| **NO_STACK_IN_RESPONSE** | Server error response missing stack/details |
| **GENERIC_MESSAGE** | Error message too generic ("Something went wrong") |
| **NO_ERROR_HANDLING** | No try/catch or error handling at all |
| **INCONSISTENT_PATTERN** | Error handling differs from the established pattern |

---

## Phase 4: Generate Audit Report

Save the report to:
```
audits/error-flow-audit-YYYY-MM-DD.md
```

If the `audits/` folder doesn't exist, create it.

### Report Structure:

```markdown
# Error Flow Audit Report

**Generated**: YYYY-MM-DD
**Total Error Flows Found**: X
**Compliant**: X
**Non-Compliant**: X
**Compliance Rate**: XX%

---

## Executive Summary

Brief overview of findings, biggest gaps, and recommended priorities.

---

## Error Flow Inventory

Complete inventory of every error flow discovered, organized by layer:

### Server-Side Error Flows
| # | File:Line | Error Type | Message | Has Stack? | User-Friendly? | Status |
|---|-----------|------------|---------|------------|-----------------|--------|

### Client-Side Error Flows
| # | File:Line | Error Source | User Sees | Copy Button? | Details View? | Retry? | Status |
|---|-----------|-------------|-----------|--------------|---------------|--------|--------|

### Network Error Flows
| # | File:Line | Scenario | User Message | Network-Specific? | Retry? | Status |
|---|-----------|----------|--------------|-------------------|--------|--------|

### Notification/Telegram Error Flows
| # | File:Line | Error Type | Logged? | Details Included? | Status |
|---|-----------|------------|---------|-------------------|--------|

---

## Findings by Category

### CRITICAL: Silent Failures
Errors that are caught and swallowed without user notification.
[List each finding with file, line, description, and recommended fix]

### CRITICAL: Missing Error Handling
Code paths that can throw but have no try/catch or error boundary.
[List each finding]

### HIGH: No Copy/Details Capability
Errors displayed to users with no way to copy or view technical details.
[List each finding]

### HIGH: Network Errors Not Distinguished
Network failures shown as generic errors instead of connectivity messages.
[List each finding]

### MEDIUM: Inconsistent Error Patterns
Error handling that works but doesn't follow the standard pattern.
[List each finding]

### LOW: Improvement Opportunities
Working error flows that could be enhanced.
[List each finding]

---

## Recommended Error Infrastructure

Based on the gaps found, recommend any shared components or utilities needed:

1. **ErrorDialog component** - If missing: a reusable dialog that shows friendly message + expandable details + copy button
2. **useErrorHandler hook** - If missing: a hook that categorizes errors (network vs runtime vs API) and shows appropriate UI
3. **Server error response format** - If inconsistent: standardize error response shape across all APIs
4. **Network error detection utility** - If missing: utility to detect and classify network errors
5. **Error copy utility** - If missing: utility to format error + stack for clipboard

---

## Fix Plan

Prioritized list of fixes, each with:
- [ ] **Fix description** in `file:line`
  - **Current behavior**: What happens now
  - **Required behavior**: What should happen
  - **Effort**: S/M/L

---

## Shared Component Recommendations

If the audit reveals missing shared infrastructure, describe what needs to be built:

### ErrorDialog Component (if needed)
- Props: `error`, `friendlyMessage`, `onRetry?`, `onDismiss`
- Shows friendly message by default
- "View Details" expands to show full error + stack
- "Copy Error" copies formatted error to clipboard
- "Retry" button if onRetry provided

### API Error Response Standard (if needed)
- All APIs should return consistent error shape
- Include stack trace in development
- Include error ID in production
- Include user-friendly message always

---
```

---

## Rules for This Audit

1. **DO NOT make any code changes** - This is a report-only audit
2. **Be exhaustive** - Find EVERY error flow, not just the obvious ones
3. **Be specific** - Include exact file paths and line numbers
4. **Show actual code** - Copy the real code from the codebase, don't make up examples
5. **Categorize by impact** - Critical (silent failures, missing handling) > High (bad UX) > Medium (inconsistent) > Low (improvements)
6. **Recommend, don't prescribe** - Suggest the shared components needed, don't dictate exact implementation
7. **Track progress** - Use a TODO list to track which areas you've scanned
8. **Consider ALL error sources**: API failures, network failures, runtime exceptions, validation errors, auth errors, permission errors, timeout errors, offline mode errors, webhook errors, notification errors, database errors, third-party service errors

---

## How to Search for Error Flows

Use these grep patterns to discover error flows. These are starting points — follow each result to understand the full error flow from origin to user visibility.

```bash
# Error production (server & shared)
grep -rn "throw " src/apis/ src/server/ --include="*.ts"
grep -rn "{ error:" src/apis/ src/server/ --include="*.ts"
grep -rn "new Error(" src/apis/ src/server/ --include="*.ts"
grep -rn "console.error" src/apis/ src/server/ --include="*.ts"

# Error catching (client)
grep -rn "catch" src/client/ --include="*.ts" --include="*.tsx"
grep -rn "\.catch(" src/client/ --include="*.ts" --include="*.tsx"
grep -rn "onError" src/client/ --include="*.ts" --include="*.tsx"

# Error display (client UI)
grep -rn "isError\|if (error\|error)" src/client/ --include="*.tsx"
grep -rn "toast\|alert\|snackbar" src/client/ --include="*.tsx" -l
grep -rn "Error" src/client/components/ --include="*.tsx" -l

# Network errors
grep -rn "navigator.onLine\|TypeError\|offline\|isOffline" src/client/ --include="*.ts" --include="*.tsx"
grep -rn "retry\|retries\|backoff" src/client/ --include="*.ts"

# Notification/external service errors
grep -rn "telegram\|sendMessage\|sendNotification\|webhook" src/server/ --include="*.ts"

# Error infrastructure
grep -rn "clipboard\|navigator.clipboard\|copyToClipboard" src/client/ --include="*.ts" --include="*.tsx"
grep -rn "ErrorBoundary\|ErrorDialog\|submitErrorReport" src/ --include="*.ts" --include="*.tsx"
grep -rn "stack\|stackTrace" src/ --include="*.ts" --include="*.tsx"
```

### Discovery Tips

- For each match, **follow the error flow end-to-end**: from where it's thrown → where it's caught → what the user sees
- A single grep match is just a starting point — read the surrounding code to understand the full flow
- Don't stop at the first layer — if a catch block re-throws or calls another function, follow it
- Check both `.ts` and `.tsx` files
