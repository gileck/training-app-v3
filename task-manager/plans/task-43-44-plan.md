# Tasks 43 & 44: Telegram Delete Button + Item Detail Page - Combined Implementation Plan

## Objective

Two related changes to the Telegram approval workflow:

1. **Task #43 (S):** Add a "Delete" button alongside "Approve" on Telegram approval messages. Clicking Delete removes the item from MongoDB and confirms in the message.
2. **Task #44 (M):** Create a new `/admin/item/:id` page showing full item details (markdown-rendered description) with Approve/Delete action buttons. Update the Telegram "View Details" link to point to this page.

Both tasks modify `src/server/telegram/index.ts`, so they are combined to avoid conflicts.

## Approach

### Shared Work (Telegram message changes)
The Telegram notification functions (`sendFeatureRequestNotification`, `sendBugReportNotification`) need three changes each:
1. Add a "Delete" callback button alongside "Approve" (Task #43)
2. Update the "View Full Details" URL to `/admin/item/:id` (Task #44)

These are done in a single pass over the file.

### Task #43 - Delete Button
- **Callback data format**: `delete_request:<requestId>` and `delete_bug:<reportId>` (39 chars max, within Telegram's 64-byte limit)
- **No confirmation step**: Consistent with existing Approve button behavior
- **Reuse existing DB functions**: `featureRequests.deleteFeatureRequest()` and `reports.deleteReport()` already exist
- **Guard against already-approved items**: Refuse deletion if item has `githubIssueUrl`
- **Guard against already-deleted items**: Show graceful "Already deleted" message

### Task #44 - Item Detail Page
- **Unified page for both types**: Tries feature request first, then bug report (mirrors CLI `get` behavior)
- **Template admin route**: `/admin/item/:id` with automatic admin protection via `/admin/` prefix
- **No new server APIs**: Reuses existing get/approve/delete APIs for both types
- **Markdown rendering**: Uses `react-markdown` + `remark-gfm` (already installed, pattern in `BugFixPage.tsx`)

## Sub-tasks

### Phase 1: Telegram Delete Button (Task #43)

- [ ] **1.1 Add Delete button to feature request notification** -- In `src/server/telegram/index.ts`, `sendFeatureRequestNotification`: add Delete callback button on same row as Approve. Shorten Approve text to fit both buttons. Callback data: `delete_request:<request._id>`.

- [ ] **1.2 Add Delete button to bug report notification** -- Same in `sendBugReportNotification`. Callback data: `delete_bug:<report._id>`.

- [ ] **1.3 Implement delete handlers** -- In `src/pages/api/telegram-webhook/handlers/approval.ts`, add:
  - `handleFeatureRequestDeletion(botToken, callbackQuery, requestId)` -- checks not already approved, deletes from MongoDB, updates Telegram message with "Deleted" status
  - `handleBugReportDeletion(botToken, callbackQuery, reportId)` -- same for bug reports

- [ ] **1.4 Export new handlers** -- Add exports to `src/pages/api/telegram-webhook/handlers/index.ts`.

- [ ] **1.5 Add webhook routing** -- In `src/pages/api/telegram-webhook/index.ts`, add routing blocks for `delete_request` and `delete_bug` actions, following exact pattern of `approve_request`/`approve_bug`.

### Phase 2: Item Detail Page (Task #44)

- [ ] **2.1 Create ItemDetail route files** -- `src/client/routes/template/ItemDetail/`:
  - `index.ts` - barrel export
  - `ItemDetail.tsx` - route wrapper (extracts `routeParams.id`)
  - `ItemDetailPage.tsx` - full UI with markdown rendering and action buttons
  - `hooks.ts` - `useItemDetail(id)`, `useApproveItem()`, `useDeleteItem()` hooks

- [ ] **2.2 Register the route** -- Add `/admin/item/:id` to `src/client/routes/index.template.ts`.

- [ ] **2.3 Update Telegram "View Details" URLs** -- In `src/server/telegram/index.ts`:
  - Feature requests: change from `/admin/feature-requests/${request._id}` to `/admin/item/${request._id}`
  - Bug reports: change from `/admin/reports` to `/admin/item/${report._id}`

### Phase 3: Validation

- [ ] **3.1 Run `yarn checks`** -- TypeScript, ESLint, circular dependencies, unused dependencies must all pass.

## Files to Create

- `src/client/routes/template/ItemDetail/index.ts` - Route barrel export
- `src/client/routes/template/ItemDetail/ItemDetail.tsx` - Route wrapper component
- `src/client/routes/template/ItemDetail/ItemDetailPage.tsx` - Detail page UI
- `src/client/routes/template/ItemDetail/hooks.ts` - React Query hooks

## Files to Modify

- `src/server/telegram/index.ts` - Add Delete buttons + update View Details URLs (Tasks #43 & #44)
- `src/pages/api/telegram-webhook/handlers/approval.ts` - Add delete handler functions (Task #43)
- `src/pages/api/telegram-webhook/handlers/index.ts` - Export new handlers (Task #43)
- `src/pages/api/telegram-webhook/index.ts` - Route delete callbacks (Task #43)
- `src/client/routes/index.template.ts` - Register `/admin/item/:id` route (Task #44)

## Component Design (Task #44)

### ItemDetailPage.tsx Layout
1. **Back button** - navigates to `/admin/feature-requests` or `/admin/reports` based on type
2. **Header:** type badge (Feature/Bug), title, status/priority/source badges, dates
3. **Description:** rendered with `<ReactMarkdown remarkPlugins={[remarkGfm]}>` inside `.markdown-body` wrapper. For bugs, also show route, error message, stack trace.
4. **Action buttons (fixed bottom bar on mobile):**
   - Approve (green, only when status is `new`)
   - Delete (red/destructive, with AlertDialog confirmation)
   - After action: navigate back to list

### hooks.ts
- `useItemDetail(id)`: fires both getFeatureRequest and getReport in parallel, returns `{ type: 'feature' | 'bug', item, isLoading, error }`
- `useApproveItem()`: calls approveFeatureRequest or approveBugReport based on type
- `useDeleteItem()`: calls deleteFeatureRequest or deleteReport based on type

## Pattern References

- `src/client/routes/template/FeatureRequests/FeatureRequestDetail.tsx` - Detail page layout, loading/error/not-found states
- `src/client/routes/template/BugFix/BugFixPage.tsx` - ReactMarkdown rendering with `remarkGfm`
- `src/apis/template/feature-requests/client.ts` - Client API functions to reuse

## Notes

- **Template ownership**: All modified files are template-owned. This project is the template itself.
- **Existing pages unaffected**: `/admin/feature-requests/:requestId` continues to work with full GitHub integration.
- **Bug report titles**: Bug reports lack a `title` field. Show first line of description as title.
- **Local development**: Delete button only shows when callback_data is available (HTTPS/webhook mode). In local dev, use the new web UI page instead.
- **No undo for deletion**: Intentional - item hasn't synced to GitHub yet, so no external state to clean up.
- **Mobile-first**: All UI targets ~400px width. Action buttons in fixed bottom bar.
