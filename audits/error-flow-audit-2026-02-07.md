# Error Flow Audit Report

**Generated**: 2026-02-07
**Scope**: Template only (`*/template/**`, `*.template.ts`, `src/pages/`, shared infrastructure)
**Total Error Flows Found**: 42
**Compliant**: 8
**Non-Compliant**: 34
**Compliance Rate**: 19%

**Resolution Status** (updated 2026-02-07):
- **Critical fixes**: 2/2 done
- **High priority fixes**: 5/5 done
- **Medium priority fixes**: 2/3 done
- **Low priority fixes**: 0/2 remaining
- **Remaining gaps**: 7 items (Profile toasts, Settings snackbar, silent failures, server infra errors)

---

## Executive Summary

The application has **solid error infrastructure** already in place:
- An `ErrorBoundary` component that catches React crashes, shows a user-friendly card, and auto-reports to the server
- A `useGlobalErrorHandler` hook that captures uncaught errors and unhandled rejections
- A `toast` system for inline error notifications
- An `apiClient` with automatic retry logic for network errors (3 retries with backoff) and auto-error-reporting in production
- A `BatchSyncAlert` component for offline queue sync failures with expandable details

However, the **biggest gaps** are:
1. **No copy button or expandable technical details** on most error displays (only the Reports page and DecisionPage have this)
2. **Network errors are NOT distinguished** from other errors in most error displays (only LoginForm and BugReportDialog attempt this)
3. **Most route-level error states** show raw `error.message` text with no copy/details/retry capabilities
4. **Mutation error toasts** show generic messages like "Failed to update status" with no way to see or copy the actual error
5. **Server API responses never include stack traces** - errors are just `{ error: "message string" }` with no details/errorCode

**Priority recommendation**: Create a shared `ErrorDisplay` component and a `useErrorToast` hook that standardize error presentation across the app.

---

## Error Flow Inventory

### Server-Side Error Flows

| # | File:Line | Error Type | Message | Has Stack? | User-Friendly? | Status |
|---|-----------|------------|---------|------------|-----------------|--------|
| S1 | `src/apis/processApiCall.ts:71` | API catch-all | `error.message` or "Unknown error" | No | Partially - raw error message | GAP |
| S2 | `src/pages/api/process/[name].ts:14` | Route catch-all | `error.message` or "Unknown error" | No | Partially - raw error message | GAP |
| S3 | `src/apis/processApiCall.ts:28` | Unknown API | "Unknown API: {name}" | No | No - technical message | GAP |
| S4 | `src/apis/processApiCall.ts:35` | Admin gate | "Forbidden" | No | Partially | GAP |
| S5 | `src/server/ai/adapters/gemini.ts:18` | Missing API key | "Gemini API key not found..." | No | No - technical | GAP |
| S6 | `src/server/ai/adapters/anthropic.ts:17` | Missing API key | "Anthropic API key not found..." | No | No - technical | GAP |
| S7 | `src/server/ai/adapters/openai.ts:17` | Missing API key | "OpenAI API key not found..." | No | No - technical | GAP |
| S8 | `src/server/ai/adapters/gemini.ts:80` | JSON parse fail | "Failed to parse JSON response..." | No | No - technical | GAP |
| S9 | `src/server/database/connection.ts:20` | Missing env var | "MONGO_URI environment variable is not set" | No | No - technical | GAP |
| S10 | `src/server/database/collections/template/users/users.ts:63-117` | Duplicate user | "User with username/email already exists" | No | Yes | OK |
| S11 | `src/server/database/collections/template/feature-requests/feature-requests.ts:114` | Create failure | "Failed to create feature request" | No | Partially | GAP |
| S12 | `src/server/database/collections/template/reports/reports.ts:93` | Create failure | "Failed to create report" | No | Partially | GAP |
| S13 | `src/server/database/collections/template/workflow-items/workflow-items.ts:23` | Create failure | "Failed to create workflow item" | No | Partially | GAP |

### Client-Side Error Flows

| # | File:Line | Error Source | User Sees | Copy Button? | Details View? | Retry? | Status |
|---|-----------|-------------|-----------|--------------|---------------|--------|--------|
| C1 | `ErrorBoundary.tsx:62-104` | React crash | "Something went wrong" card + Try Again/Reload | No | Dev only (error.message) | Yes (Try Again + Reload) | GAP |
| C2 | `useGlobalErrorHandler.ts:31-55` | Uncaught error | Nothing visible to user (auto-reports) | No | No | No | GAP |
| C3 | `useGlobalErrorHandler.ts:58-87` | Unhandled rejection | Nothing visible to user (auto-reports) | No | No | No | GAP |
| C4 | `LoginForm.tsx:92-97` | Auth error | Cleaned error message in alert banner | No | No | No (form re-submit) | GAP |
| C5 | `FeatureRequestDialog.tsx:68-71` | Submit failure | Toast: "Failed to submit: {raw error}" | No | No | No | GAP |
| C6 | `BugReportDialog.tsx:156-168` | Submit failure | Context-aware toast (413/network/timeout/generic) | No | No | No | PARTIAL |
| C7 | `Reports.tsx:110-152` | Query error | Full error card with message + stack + copy button | Yes | Yes (stack trace) | No | OK |
| C8 | `ItemDetailPage.tsx:46-58` | Query error | "Error loading item: {error.message}" + Go Back | No | No | No (Go Back) | GAP |
| C9 | `FeatureRequestDetail.tsx:54-70` | Query error | Raw error.message + Back button | No | No | No (Back) | GAP |
| C10 | `MyFeatureRequests.tsx:21-28` | Query error | "Failed to load..." + raw error.message | No | No | No | GAP |
| C11 | `WorkflowItems.tsx:194-203` | Query error | "Failed to load workflow items: {error.message}" | No | No | No | GAP |
| C12 | `GitHubIssueSection.tsx:142-150` | Query error | "Failed to load issue details: {error.message}" | No | No | No | GAP |
| C13 | `FeatureRequests/hooks.ts:101` | Mutation error | Toast: "Failed to update status" | No | No | No | GAP |
| C14 | `FeatureRequests/hooks.ts:143` | Mutation error | Toast: "Failed to update priority" | No | No | No | GAP |
| C15 | `FeatureRequests/hooks.ts:177` | Mutation error | Toast: "Failed to delete feature request" | No | No | No | GAP |
| C16 | `FeatureRequests/hooks.ts:227` | Mutation error | Toast: "Failed to add comment" | No | No | No | GAP |
| C17 | `FeatureRequests/hooks.ts:266` | Mutation error | Toast: "Failed to approve feature request" | No | No | No | GAP |
| C18 | `FeatureRequests/hooks.ts:394` | Mutation error | Toast: "Failed to update GitHub status" | No | No | No | GAP |
| C19 | `FeatureRequests/hooks.ts:433` | Mutation error | Toast: "Failed to update GitHub review status" | No | No | No | GAP |
| C20 | `FeatureRequests/hooks.ts:476` | Mutation error | Toast: "Failed to clear GitHub review status" | No | No | No | GAP |
| C21 | `FeatureRequests/hooks.ts:536` | Mutation error | Toast: "Failed to create feature request" | No | No | No | GAP |
| C22 | `Reports/hooks.ts:92` | Mutation error | Toast: "Failed to delete report" | No | No | No | GAP |
| C23 | `Reports/hooks.ts:161` | Mutation error | Toast: "Failed to update reports" | No | No | No | GAP |
| C24 | `Reports/hooks.ts:197` | Mutation error | Toast: "Failed to delete reports" | No | No | No | GAP |
| C25 | `Profile.tsx:87-93` | Profile update | Toast: response error or raw error.message | No | No | No | GAP |
| C26 | `Profile.tsx:111-116` | Profile pic | Toast: response error or raw error.message | No | No | No | GAP |
| C27 | `Profile.tsx:156-159` | Clipboard paste | Toast: "Failed to paste image from clipboard" | No | No | No | GAP |
| C28 | `Settings/CacheSection.tsx:89-97` | Cache clear | Snackbar with raw error.message | No | No | No | GAP |
| C29 | `ItemDetailPage.tsx:101-103` | Approve action | Toast: raw error.message or "Failed to approve" | No | No | No | GAP |
| C30 | `ItemDetailPage.tsx:116-118` | Delete action | Toast: raw error.message or "Failed to delete" | No | No | No | GAP |
| C31 | `DecisionPage.tsx:311-334` | Submit decision | Alert with error.message + Copy Error button | Yes | No | No | PARTIAL |
| C32 | `FeatureRequests.tsx:175-179` | Create feature | Console error only (toast from mutation onError) | No | No | No | GAP |

### Network Error Flows

| # | File:Line | Scenario | User Message | Network-Specific? | Retry? | Status |
|---|-----------|----------|--------------|-------------------|--------|--------|
| N1 | `apiClient.ts:67-80` | GET while offline | Returns `{ error: 'Network unavailable while offline' }` | Yes | No | PARTIAL |
| N2 | `apiClient.ts:110-147` | GET network failure | Auto-retry 3x then returns `{ error: 'Network request failed after retries' }` | Yes (auto-retry) | Yes (automatic) | OK |
| N3 | `apiClient.ts:190-213` | POST while offline | Queued for later sync (empty {} return) | Yes (queued) | Yes (auto-sync) | OK |
| N4 | `apiClient.ts:257-265` | POST network failure | Throws - propagates to caller | No | No | GAP |
| N5 | `LoginForm.tsx:234-235` | Login offline | "You're offline. Please connect to sign in." | Yes | No | OK |
| N6 | `LoginForm.tsx:243-244` | Login network error | "Connection error. Please try again." | Yes | No | OK |
| N7 | `BugReportDialog.tsx:162-163` | Bug report network | "Network error. Please check your connection..." | Yes | No | PARTIAL |
| N8 | `offlinePostQueue.ts:134-137` | Batch sync failure | Returns silently (queue kept for retry) | Partially | Yes (keeps queue) | PARTIAL |
| N9 | `BatchSyncAlert.tsx:100-107` | Offline sync errors | "X calls failed to sync" with expandable details | Partially | No | PARTIAL |

### Notification/Telegram Error Flows

| # | File:Line | Error Type | Logged? | Details Included? | Status |
|---|-----------|------------|---------|-------------------|--------|
| T1 | `telegram/index.ts:150-154` | API error response | Yes (console.error + response text) | Yes (response body) | OK |
| T2 | `telegram/index.ts:158-161` | Send failure exception | Yes (console.error) | Yes (error string) | OK |
| T3 | `telegram/index.ts:176-177` | No chat ID | Returned as error object | Yes | OK |
| T4 | `telegram/index.ts:181-184` | User lookup failure | Yes (console.error) | Yes (error string) | OK |

---

## Findings by Category

### CRITICAL: Silent Failures

| # | File:Line | Description | Recommended Fix |
|---|-----------|-------------|-----------------|
| F1 | `useGlobalErrorHandler.ts:52-54` | `submitErrorReport` failure is silently caught with `// Silently fail` - if error reporting breaks, nobody knows | Log warning to console when error report submission fails |
| F2 | `ErrorBoundary.tsx:48-50` | Same: `submitErrorReport` catch with `// Silently fail` | Log warning to console |
| F3 | `apiClient.ts:24-26` | Settings read failure silently ignored (`catch { // ignore }`) | Acceptable - defensive initialization code |
| F4 | `offlinePostQueue.ts:134-137` | Non-200 batch sync returns silently without notifying user | Show toast indicating sync failed and will be retried |
| F5 | `offlinePostQueue.ts:184-186` | Network-level batch sync error caught with `console.error` only - no user notification | Show toast or alert |

### CRITICAL: Missing Error Handling

| # | File:Line | Description | Recommended Fix |
|---|-----------|-------------|-----------------|
| F6 | `apiClient.ts:257-265` | POST network errors (TypeError from fetch) are NOT retried like GET requests are. POST throws directly to caller. | Consider adding retry logic for POST or at least wrapping the error with context |

### HIGH: No Copy/Details Capability

| # | File:Line | Description | Recommended Fix |
|---|-----------|-------------|-----------------|
| F7 | `ErrorBoundary.tsx:67-104` | ErrorBoundary shows "Something went wrong" but has NO copy button and only shows error.message in dev mode | Add "View Details" expandable and "Copy Error" button |
| F8 | All mutation `onError` toast calls (C13-C24) | 12 mutation hooks show generic toast like "Failed to update status" with NO way to copy or view the actual error | Pass error details to toast actions or use an error toast utility |
| F9 | Route error states (C8-C12) | 5 route pages show `error.message` text but no copy button or expandable details | Use a shared ErrorDisplay component |
| F10 | `LoginForm.tsx:92-97` | Auth error shown in banner with cleaned message - no way to see or copy the raw error | Add small "details" link for raw error |
| F11 | `FeatureRequestDialog.tsx:70` | Toast shows raw error: "Failed to submit: {errorMessage}" - no copy capability | Use error toast with copy action |
| F12 | `Profile.tsx:87-93,111-116` | Toast shows raw error message - no copy capability | Use error toast with copy action |
| F13 | `Settings/CacheSection.tsx:94-97` | Snackbar shows raw error.message - no copy capability | Use error toast with copy action |

### HIGH: Network Errors Not Distinguished

| # | File:Line | Description | Recommended Fix |
|---|-----------|-------------|-----------------|
| F14 | All mutation `onError` toast calls | Mutations show "Failed to X" whether the error was a network failure or a server error - no distinction | Check if error is a TypeError/network error and show "Connection error" instead |
| F15 | Route error states (C8-C12) | All show raw error.message - no indication of whether it's a network issue | Use ErrorDisplay that checks error type |
| F16 | `FeatureRequestDialog.tsx:68-71` | Catches error but doesn't distinguish network vs server errors | Check error type like BugReportDialog does |
| F17 | `ItemDetailPage.tsx:101-103,116-118` | Catches error but doesn't distinguish network vs server | Differentiate error messages |

### HIGH: Server API Response Missing Stack/Details

| # | File:Line | Description | Recommended Fix |
|---|-----------|-------------|-----------------|
| F18 | `processApiCall.ts:71-74` | API catch-all returns `{ error: error.message }` - no stack trace, no errorCode, no details field | Include `details` (stack in dev) and `errorCode` |
| F19 | `[name].ts:14-19` | Route catch-all returns `{ error: error.message }` - no stack trace | Include `details` (stack in dev) |
| F20 | All database collection throw statements (S10-S13) | throw `new Error('message')` - the error message propagates but stack is lost at API boundary | Structured error objects |

### MEDIUM: Inconsistent Error Patterns

| # | File:Line | Description | Recommended Fix |
|---|-----------|-------------|-----------------|
| F21 | `Reports.tsx:110-152` vs all other route error states | Reports page has full error display with stack trace + copy button, but all other routes just show `error.message` text | Standardize all routes to use the same ErrorDisplay component |
| F22 | `DecisionPage.tsx:311-334` vs other error UIs | DecisionPage has a copy button on submission error, but most pages don't | Standardize |
| F23 | `BugReportDialog.tsx:156-168` vs `FeatureRequestDialog.tsx:68-71` | BugReportDialog distinguishes network/413/timeout errors; FeatureRequestDialog doesn't | Use shared error categorization |
| F24 | `LoginForm.tsx:231-249` vs everything else | LoginForm has a `cleanErrorMessage` function that humanizes errors; nothing else does | Extract shared utility |
| F25 | `Settings/CacheSection.tsx:89-97` uses snackbar/Alert pattern while everything else uses toast | Inconsistent notification mechanism | Standardize on toast |
| F26 | Mutation hooks: some show user-friendly messages ("Failed to update status") while others show raw error ("Failed to submit: {raw error}") | Inconsistent error message quality | Standardize |

### LOW: Improvement Opportunities

| # | File:Line | Description | Recommended Fix |
|---|-----------|-------------|-----------------|
| F27 | `ErrorBoundary.tsx:73` | "Something went wrong" is too generic - could say "This section encountered an error" | More specific message |
| F28 | `ErrorBoundary.tsx:78-79` | "This has been automatically reported" - good but could add "In the meantime, try refreshing" | Better guidance text |
| F29 | All route error states | None have a "Retry" button that refetches the query - only "Go Back" or nothing | Add retry button using `queryClient.invalidateQueries` |
| F30 | Toast system supports `actions` parameter but no error toast ever uses it | Add "Copy" and "Retry" action buttons to error toasts |
| F31 | `apiErrorReporter.ts` only reports in production - dev errors get no automatic tracking | Consider logging all errors to session log in dev too (already happening via logger) |

---

## Recommended Error Infrastructure

Based on the gaps found, the following shared components/utilities are needed:

### 1. ErrorDisplay Component (NEEDED)

A shared component for route-level error states. Only `Reports.tsx` currently has a proper one. All other routes show minimal text.

```
Props: error, title?, onRetry?, onBack?
Features:
- User-friendly title ("Failed to load feature requests")
- Expandable technical details (error.message + stack)
- Copy Error button
- Retry button (if onRetry provided)
- Go Back button (if onBack provided)
```

### 2. Error Toast Utility (NEEDED)

The toast system already supports `actions` but no code uses it for errors. A utility that wraps `toast.error()` with a "Copy" action:

```
errorToast('Failed to update status', error)
→ Shows: "Failed to update status" toast with [Copy Error] action button
```

### 3. Server Error Response Format (NEEDS UPDATE)

Current: `{ error: "message string" }`
Needed: `{ error: "user-friendly message", errorCode?: string, details?: string }`

The `details` field should include stack trace in development and error ID in production.

### 4. Network Error Detection Utility (NEEDED)

`BugReportDialog` and `LoginForm` each have their own network error detection. Extract a shared utility:

```
isNetworkError(error) → boolean
getErrorCategory(error) → 'network' | 'timeout' | 'payload-too-large' | 'auth' | 'server' | 'unknown'
getUserFriendlyMessage(error, context) → string
```

### 5. ErrorBoundary Enhancement (NEEDS UPDATE)

Current ErrorBoundary shows "Something went wrong" with Try Again/Reload but no copy button and no technical details (except in dev). Add:
- Copy Error button
- Expandable details section (always, not just dev)

---

## Fix Plan

### Critical Priority

- [x] **Add `details` field to server API error response** in `src/apis/processApiCall.ts:71`
  - **Fixed in**: `8a5cd04`, `d9de489`
  - Added `errorCode` (`UNKNOWN_API`, `FORBIDDEN`, `SERVER_ERROR`) and `errorDetails` (stack trace in dev or for admin users in production) to `processApiCall.ts`, `[name].ts`, `[...name].ts`. Client `apiClient.ts` propagates `errorCode`/`errorDetails` onto thrown Error objects.

- [x] **Add copy button and details view to ErrorBoundary** in `src/client/features/template/error-tracking/ErrorBoundary.tsx`
  - **Fixed in**: `8a5cd04`
  - ErrorBoundary now uses shared `ErrorDisplay` component with collapsible details, copy button, and admin-only stack traces.

### High Priority

- [x] **Create shared `ErrorDisplay` component** in `src/client/features/template/error-tracking/ErrorDisplay.tsx`
  - **Fixed in**: `8a5cd04`
  - Props: `error`, `title?`, `onRetry?`, `onBack?`, `backLabel?`, `variant?` (`card` | `inline`). Features: network-aware icon (WifiOff vs AlertCircle), collapsible details, admin-only stack traces via `useIsAdmin()`, Copy Error button, optional Retry/Back buttons.

- [x] **Create `errorToast` utility** in `src/client/features/template/error-tracking/errorToast.ts`
  - **Fixed in**: `8a5cd04`
  - `errorToast(message, error?)` shows toast with "Copy Error" action button. `errorToastAuto(error, fallback?)` auto-classifies error type and shows appropriate message.

- [x] **Create shared `isNetworkError` / `getErrorCategory` utility** in `src/client/features/template/error-tracking/errorUtils.ts`
  - **Fixed in**: `8a5cd04`
  - `isNetworkError()`, `cleanErrorMessage()`, `getUserFriendlyMessage()`, `formatErrorForCopy()`. Consolidated from duplicated logic in BugReportDialog and LoginForm.

- [x] **Replace 5 route-level error states with `ErrorDisplay`** (C8-C12)
  - **Fixed in**: `8a5cd04`
  - Updated: ItemDetailPage, FeatureRequestDetail, MyFeatureRequests, WorkflowItems, GitHubIssueSection, DecisionPage, Reports.

- [x] **Update 12 mutation `onError` handlers to use `errorToast`** (C13-C24)
  - **Fixed in**: `8a5cd04`
  - Updated ~15 call sites across: FeatureRequests/hooks.ts, Reports/hooks.ts, Reports.tsx, ItemDetailPage.tsx, FeatureRequestDialog.tsx, BugReportDialog.tsx.

### Medium Priority

- [x] **Distinguish network errors in mutation toasts**
  - **Fixed in**: `8a5cd04`
  - `errorToastAuto()` uses `isNetworkError()` and `getUserFriendlyMessage()` to show "Connection error" for network failures. Used by BugReportDialog and available for all call sites.

- [x] **Add retry buttons to route error states**
  - **Fixed in**: `8a5cd04`
  - `ErrorDisplay` supports `onRetry` prop. Reports page passes it.

- [ ] **Standardize error notification pattern** - remove snackbar pattern in Settings, use toast everywhere
  - **Not fixed**: Settings/CacheSection still uses snackbar pattern.

### Low Priority

- [ ] **Improve ErrorBoundary messaging**
  - **Not fixed**: Still shows "Something went wrong" (default `ErrorDisplay` title).

- [ ] **Add console.warn when submitErrorReport fails** (F1, F2)
  - **Not fixed**: Still silently caught.

---

## Remaining Gaps

The following items from the audit were **not addressed** (medium/low priority):

| Finding | Description |
|---------|-------------|
| C25-C27 | Profile.tsx toast errors — no copy capability |
| C28 | Settings/CacheSection snackbar — inconsistent with toast pattern |
| F1-F2 | Silent `submitErrorReport` failures — no console.warn |
| F6 | POST network errors not retried in apiClient |
| F25 | Settings snackbar vs toast inconsistency |
| S5-S9 | Server infrastructure errors (missing API keys, DB connection) — no user-friendly messages |
| S11-S13 | Database create failure messages — no structured error objects |

---

## Shared Component Recommendations

### ErrorDisplay Component (DONE)
- Created at `src/client/features/template/error-tracking/ErrorDisplay.tsx`
- Props: `error`, `title?`, `onRetry?`, `onBack?`, `backLabel?`, `variant?`
- Used by: ErrorBoundary, ItemDetailPage, FeatureRequestDetail, MyFeatureRequests, WorkflowItems, GitHubIssueSection, DecisionPage, Reports

### Error Toast Utility (DONE)
- Created at `src/client/features/template/error-tracking/errorToast.ts`
- `errorToast(message, error?)` and `errorToastAuto(error, fallback?)`
- Used by: all mutation onError handlers, BugReportDialog, FeatureRequestDialog

### API Error Response Standard (DONE)
- `processApiCall.ts` returns `{ error, errorCode, errorDetails? }`
- `errorDetails` included in development mode or for admin users in production
- `apiClient.ts` attaches `errorCode`/`errorDetails` to thrown Error objects
