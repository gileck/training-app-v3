# Task 45: Fix Template Audit Issues - Implementation Plan

## Objective

Fix all 20+ template audit issues identified in `audits/audit-2026-02-07.md`, organized into 8 implementation phases. The goal is to bring template-owned code to full compliance with the project's mutation, caching, database, and component-size guidelines.

## Approach

The implementation follows the phased approach from the audit report, with critical mutation violations addressed first (Phases 1-3), followed by cache standardization (Phase 4), server/database fixes (Phases 5-6), component refactoring (Phase 7), and documentation cleanup (Phase 8). Each phase can be implemented and tested independently, with `yarn checks` run after every phase.

Key architectural principles guiding the fixes:
- **Optimistic-only mutation pattern**: `onMutate` for immediate UI, `onError` for rollback, empty `onSuccess`/`onSettled`
- **Client-generated stable IDs**: `generateId()` from `@/client/utils/id` instead of `temp-${Date.now()}`
- **Centralized cache config**: `useQueryDefaults()` instead of hardcoded `staleTime` values
- **Database abstraction**: Use collection functions via `@/server/database`, not direct `getDb()` calls
- **ID utilities**: `toQueryId()`/`toDocumentId()`/`toStringId()` from `@/server/utils`

## Sub-tasks

### Phase 1: Critical Mutation Fixes - ItemDetail (1 file)

- [ ] **1.1** In `src/client/routes/template/ItemDetail/hooks.ts`, add optimistic update to `approveFeatureMutation` (lines 70-81). Add `onMutate` that cancels queries for `['item-detail-feature', requestId]`, snapshots the previous data, and sets status to `'product_design'` optimistically. Add `onError` with rollback and toast. Replace `onSettled: () => { queryClient.invalidateQueries(...) }` with empty `onSettled: () => {}`. Note: The current `mutateAsync` return pattern used in `ItemDetailPage.tsx` means the component calls `await approveFeature(mongoId)` and then calls `navigateBack()`. Since the component navigates away after the mutation, the optimistic update primarily prevents UI flicker during the approval flow and enables offline queuing.

- [ ] **1.2** In the same file, add optimistic update to `approveBugMutation` (lines 83-97). Same pattern as 1.1 but targeting `['item-detail-report', reportId]` query key. The optimistic status for a bug report approval should be `'investigating'` (based on the server-side `approveBugReportService` behavior). Add `onError` rollback with toast. Remove `invalidateQueries` from `onSettled`.

- [ ] **1.3** In the same file, add optimistic update to `deleteFeatureMutation` (lines 109-120). In `onMutate`, cancel queries for `['item-detail-feature', requestId]`, snapshot the previous data, and set the query data to `null` (simulating deletion). Add `onError` with rollback. Replace `onSettled` body with empty. The component already navigates away after deletion, so the optimistic update just prevents flicker.

- [ ] **1.4** In the same file, add optimistic update to `deleteReportMutation` (lines 122-133). Same pattern as 1.3 but targeting `['item-detail-report', reportId]` query key.

- [ ] **1.5** Verify that the `useApproveItem` and `useDeleteItem` hook return types remain compatible. Currently both hooks expose `mutateAsync` directly (e.g., `approveFeature: approveFeatureMutation.mutateAsync`). The `onMutate` context type needs to include `previous` and the ID for proper rollback. Also verify the `isPending` aggregation still works.

### Phase 2: Critical Mutation Fixes - FeatureRequests (1 file)

- [ ] **2.1** In `src/client/routes/template/FeatureRequests/hooks.ts`, fix `useApproveFeatureRequest` `onSuccess` (lines 268-283). Remove the `queryClient.setQueriesData` call that overwrites optimistic data with `data.featureRequest`. Keep only the toast notifications. The `onMutate` at lines 245-259 is already correct (optimistic status change to `product_design`). After fix, `onSuccess` should only contain the toast logic (checking `data?.githubIssueUrl` for the toast message).

- [ ] **2.2** In the same file, fix `useUpdateGitHubStatus` (lines 377-397). Currently has no `onMutate` and uses `invalidateQueries` in `onSuccess`. Add `onMutate` that: (a) cancels queries for `['github-status', requestId]`, (b) snapshots previous data, (c) optimistically sets the status on the github-status query data. Add `onError` with rollback and toast. Change `onSuccess` to only contain the toast. Add empty `onSettled`.

### Phase 3: Temp ID Resolution (3 client files + 2 server handlers)

- [ ] **3.1** In `src/client/routes/template/FeatureRequests/hooks.ts`, fix `useCreateFeatureRequest` (line 511). Replace `` _id: `temp-${Date.now()}` `` with `_id: generateId()`. Add `import { generateId } from '@/client/utils/id'` at the top.

- [ ] **3.2** In the same file, fix `useAddAdminComment` (line 203). Replace `` id: `temp-${Date.now()}` `` with `id: generateId()`. The `generateId` import from task 3.1 covers this.

- [ ] **3.3** In `src/client/routes/template/MyFeatureRequests/hooks.ts`, fix `useAddComment` (line 47). Replace `` id: `temp-${Date.now()}` `` with `id: generateId()`. Add `import { generateId } from '@/client/utils/id'` at the top.

- [ ] **3.4** In `src/apis/template/feature-requests/handlers/addAdminComment.ts`, update the server handler to accept an optional client-provided comment ID. Currently line 36 generates `id: new ObjectId().toString()`. Change to: accept `request.commentId` if provided, otherwise fall back to `new ObjectId().toString()`. This requires updating the `AddAdminCommentRequest` type to include an optional `commentId?: string` field.

- [ ] **3.5** In `src/apis/template/feature-requests/handlers/addUserComment.ts`, same change as 3.4: accept `request.commentId` if provided, fall back to `new ObjectId().toString()`. Update `AddUserCommentRequest` type similarly.

- [ ] **3.6** In `src/apis/template/feature-requests/types.ts`, add optional `commentId?: string` field to `AddAdminCommentRequest` and `AddUserCommentRequest` interfaces.

- [ ] **3.7** In the client hooks for `useAddAdminComment` and `useAddComment`, pass the generated ID to the server via the mutation request body (add `commentId: newComment.id` to the mutation parameters). This ensures the client-generated ID matches what the server persists.

- [ ] **3.8** For `useCreateFeatureRequest`, evaluate whether the server handler (`createFeatureRequest.ts`) needs changes. Currently (line 57) it calls `featureRequests.createFeatureRequest(requestData)` which lets MongoDB generate the `_id`. The server handler would need to accept an optional `_id` from the client and use `toDocumentId()` if provided. Update `CreateFeatureRequestRequest` type to include optional `_id?: string`. The simplest correct approach is to accept the client `_id` in the server handler for idempotency. Add `_id` to request type, use `toDocumentId(request._id)` in the server if provided.

### Phase 4: Hardcoded Cache Values (3 files)

- [ ] **4.1** In `src/client/routes/template/FeatureRequests/hooks.ts`, replace hardcoded `staleTime: 30000` at line 304 (`useGitHubStatus`) with `...queryDefaults` from `useQueryDefaults()`. This hook intentionally uses a shorter stale time (30s) for frequently-changing data. **Decision**: Keep the custom stale time but define it as a named constant at the top of the file (e.g., `const GITHUB_STATUS_STALE_TIME = 30_000`) and add a comment explaining why. The key violation is bypassing the cache-off setting -- when `staleWhileRevalidate` is false, staleTime should be 0. Wrap in a conditional: use `queryDefaults` as the base, but override `staleTime` only when SWR is enabled.

- [ ] **4.2** In the same file, replace `staleTime: 30000` at line 344 (`useBatchGitHubStatuses`) with the same approach as 4.1.

- [ ] **4.3** In the same file, replace `staleTime: 5 * 60 * 1000` at line 370 (`useGitHubStatuses`) with `...queryDefaults`. Since 5 minutes is close to the default, `queryDefaults` may be sufficient here.

- [ ] **4.4** In `src/client/features/template/auth/hooks.ts`, address hardcoded `staleTime: 5 * 60 * 1000` and `gcTime: 60 * 60 * 1000` at lines 47-48 and 213-214. Auth queries are special -- they need longer stale times by design (user identity rarely changes). **Decision**: Define named constants at module scope (`AUTH_STALE_TIME = 5 * 60 * 1000` and `AUTH_GC_TIME = 60 * 60 * 1000`) with comments explaining the intentional deviation. Auth hooks do NOT use `useQueryDefaults()` because auth queries must work regardless of the user's SWR toggle.

- [ ] **4.5** In `src/client/components/template/clarify/ClarifyPage.tsx`, address `staleTime: Infinity` at line 46. This is intentionally correct: clarification data is static once loaded and never changes. **Decision**: Add a justification comment on the line: `// Intentional: clarification data is immutable once created`.

### Phase 5: Server/Client Separation (2 files)

- [ ] **5.1** In `src/apis/template/reports/handlers/batchUpdateStatus.ts`, replace the direct `getDb()` call and manual collection access (lines 18-19) with the reports collection abstraction. Currently uses `const db = await getDb(); const collection = db.collection('reports');`. The `reports` collection module does not currently export a `batchUpdateStatus` function, so one needs to be added. Add a new `batchUpdateReportStatuses` function to `src/server/database/collections/template/reports/reports.ts` that accepts `reportIds: string[]` and `status: ReportStatus`, performs the `updateMany` using `toQueryId()`, and returns the modified count. Then update the handler to import and call this new function.

- [ ] **5.2** In `src/apis/template/reports/handlers/batchDeleteReports.ts`, replace direct `getDb()` call (lines 19-20) with collection functions. This is more complex because it also queries for screenshots before deletion. Add a new `batchDeleteReports` function (or `findReportsByIds` + `batchDeleteByIds`) to the reports collection module. The handler would then call `findReportsByIds(reportIds)` for screenshot cleanup and `batchDeleteByIds(reportIds)` for the actual deletion. The `fileStorageAPI` usage stays in the handler since it is not database logic.

### Phase 6: Database ID Utilities (2 collection files)

- [ ] **6.1** In `src/server/database/collections/template/feature-requests/feature-requests.ts`, replace all instances of the pattern `typeof id === 'string' ? new ObjectId(id) : id` with `toQueryId(id)`. Add `import { toQueryId } from '@/server/utils';`. This affects approximately 12 instances across functions: `findFeatureRequestsByUser`, `findFeatureRequestById`, `updateFeatureRequestStatus`, `addComment`, `updateAdminNotes`, `updatePriority`, `setNeedsUserInput`, `deleteFeatureRequest`, `updateGitHubFields`, `updateApprovalToken`, `updateWorkflowFields`. Also handle `findFeatureRequests` line 42 where `filters.requestedBy` uses the same pattern.

- [ ] **6.2** In `src/server/database/collections/template/reports/reports.ts`, replace all instances of `typeof id === 'string' ? new ObjectId(id) : id` with `toQueryId(id)`. Add the import. This affects approximately 9 instances across: `findReportById`, `updateReportStatus`, `updateReport`, `updateReportInvestigation`, `deleteReport`, `updateApprovalToken`, `incrementReportOccurrence`, `markReportAsDuplicate` (2 calls), `updateWorkflowFields`. Also `findReportsInTimeRange` at line 274-275 uses `typeof id === 'string' ? new ObjectId(id) : id` in a map.

### Phase 7: Component Size Reduction (9 components)

Each component over 200 lines needs to be split into smaller sub-components. The general strategy is to extract logical sections into their own files within the same directory.

- [ ] **7.1** Split `FeatureRequests.tsx` (417 lines). Extract: (a) `FeatureRequestsHeader` (title, create button), (b) `FeatureRequestsContent` (list rendering, empty states), (c) filter/search logic into a custom hook if not already separate.

- [ ] **7.2** Split `FeatureRequestCard.tsx` (374 lines). Extract: (a) `CardHeader` section, (b) `CardActions` (approve, delete, status buttons), (c) `CardMetadata` (dates, status badges).

- [ ] **7.3** Split `DecisionPage.tsx` (368 lines). Extract: (a) `DecisionOptions` (option selection UI), (b) `DecisionMetadata` (issue info display), (c) `DecisionSubmitSection`.

- [ ] **7.4** Split `MobileFilterSheet.tsx` (324 lines). Extract individual filter section components: `StatusFilterSection`, `PriorityFilterSection`, `SortFilterSection`.

- [ ] **7.5** Split `FeatureRequestDetail.tsx` (321 lines). Extract: (a) detail header, (b) comments section, (c) action buttons, (d) GitHub status section.

- [ ] **7.6** Split `Profile.tsx` (302 lines). Extract: (a) `ProfileHeader`, (b) `ProfileDetails` (user info fields), (c) `ProfileActions` (logout, etc.).

- [ ] **7.7** Split `FilterChipBar.tsx` (300 lines). Extract chip group rendering into `ChipGroup` sub-component, which renders a category label plus its chip items.

- [ ] **7.8** Split `ItemDetailPage.tsx` (281 lines). Extract: (a) `ItemDetailHeader` (badges, title, metadata), (b) `ItemDetailActions` (approve/delete buttons with confirm dialogs), (c) `ItemDetailBody` (description/content section).

- [ ] **7.9** Split `CacheSection.tsx` (248 lines). Extract: (a) `CacheBreakdownTable` (individual cache store list), (b) `CacheControls` (toggle, clear buttons).

### Phase 8: Documentation and Config (2 files)

- [ ] **8.1** In `docs/template/offline-pwa-support.md`, update lines 215-232 ("Temporary IDs for Create Operations"). Replace the `temp-${Date.now()}` code example with a reference to `generateId()` from `@/client/utils/id`, and update the explanation to align with the guidance in `docs/template/react-query-mutations.md`. The section should recommend `generateId()` for stable client-generated IDs and link to the mutations doc for the full pattern.

- [ ] **8.2** In `.template-sync.template.json`, review lines 23-24 which include `src/client/components/NavLinks.tsx` and `src/client/components/GlobalDialogs.tsx` in `templatePaths`. These are combiner files (they import from both `*.template.ts` and `*.project.ts`). Since combiner files follow the three-file pattern where the template controls the merge logic, they should likely remain in `templatePaths`. Verify this is correct by checking if they import project files.

### Final Verification

- [ ] Run `yarn checks` and confirm 0 errors
- [ ] Verify all mutations in the audit appendix table are now COMPLIANT
- [ ] Verify no `temp-${Date.now()}` patterns remain in template code
- [ ] Verify all components are under 200 lines
- [ ] Verify no hardcoded `staleTime` without either `useQueryDefaults()` or a named constant with comment

## Files to Modify

**Phase 1 (1 file):**
- `src/client/routes/template/ItemDetail/hooks.ts` - Add `onMutate`/`onError` to all 4 mutations, remove `invalidateQueries`

**Phase 2 (1 file):**
- `src/client/routes/template/FeatureRequests/hooks.ts` - Fix `onSuccess` in `useApproveFeatureRequest`, add optimistic to `useUpdateGitHubStatus`

**Phase 3 (5 files):**
- `src/client/routes/template/FeatureRequests/hooks.ts` - Replace `temp-${Date.now()}` with `generateId()` (2 locations)
- `src/client/routes/template/MyFeatureRequests/hooks.ts` - Replace `temp-${Date.now()}` with `generateId()` (1 location)
- `src/apis/template/feature-requests/types.ts` - Add `commentId?: string` to comment request types, `_id?: string` to create request
- `src/apis/template/feature-requests/handlers/addAdminComment.ts` - Accept client comment ID
- `src/apis/template/feature-requests/handlers/addUserComment.ts` - Accept client comment ID
- `src/apis/template/feature-requests/handlers/createFeatureRequest.ts` - Accept client `_id` for idempotency

**Phase 4 (3 files):**
- `src/client/routes/template/FeatureRequests/hooks.ts` - Replace hardcoded staleTime with constants or queryDefaults
- `src/client/features/template/auth/hooks.ts` - Extract cache times to named constants with comments
- `src/client/components/template/clarify/ClarifyPage.tsx` - Add justification comment for `staleTime: Infinity`

**Phase 5 (3 files):**
- `src/apis/template/reports/handlers/batchUpdateStatus.ts` - Replace `getDb()` with collection function
- `src/apis/template/reports/handlers/batchDeleteReports.ts` - Replace `getDb()` with collection functions
- `src/server/database/collections/template/reports/reports.ts` - Add `batchUpdateStatuses`, `findByIds`, `batchDeleteByIds`

**Phase 6 (2 files):**
- `src/server/database/collections/template/feature-requests/feature-requests.ts` - Replace ~12 `new ObjectId()` with `toQueryId()`
- `src/server/database/collections/template/reports/reports.ts` - Replace ~9 `new ObjectId()` with `toQueryId()`

**Phase 7 (9 component files, creating ~20 new sub-component files):**
- `src/client/routes/template/FeatureRequests/FeatureRequests.tsx`
- `src/client/routes/template/FeatureRequests/components/FeatureRequestCard.tsx`
- `src/client/routes/template/Decision/DecisionPage.tsx`
- `src/client/routes/template/FeatureRequests/components/MobileFilterSheet.tsx`
- `src/client/routes/template/FeatureRequests/FeatureRequestDetail.tsx`
- `src/client/routes/template/Profile/Profile.tsx`
- `src/client/routes/template/FeatureRequests/components/FilterChipBar.tsx`
- `src/client/routes/template/ItemDetail/ItemDetailPage.tsx`
- `src/client/routes/template/Settings/components/CacheSection.tsx`

**Phase 8 (2 files):**
- `docs/template/offline-pwa-support.md` - Fix temp ID documentation
- `.template-sync.template.json` - Review combiner file entries

## Notes

1. **Phases 1-3 are the highest impact** -- they fix all 7 critical violations and 2 high-priority temp ID issues. These should be implemented first and tested thoroughly.

2. **Phase 3 requires coordinated client+server changes**. The client must generate stable IDs and pass them to the server, and the server must accept and persist those IDs.

3. **Phase 4 requires judgment calls**. Auth hooks intentionally deviate from `useQueryDefaults()` because authentication must work regardless of the user's cache toggle. The fix is to make this intentional deviation explicit with named constants and comments, not to force them through `useQueryDefaults()`.

4. **Phase 5 batch handlers** both use direct `getDb()` while all other report handlers use the abstracted `reports` collection. New collection functions need to be added to the reports module for batch operations.

5. **Phase 6 is mechanical but high-volume**. Every `typeof id === 'string' ? new ObjectId(id) : id` pattern in both collection files needs to be replaced with `toQueryId(id)`. This is a straightforward find-and-replace but needs careful testing since it touches every database query.

6. **Phase 7 component splitting** should follow the project's existing pattern: sub-components go into a `components/` subfolder within the route directory, or as sibling files in the same directory for route-level components. Each new file should be under 200 lines. Props should be typed explicitly.

7. **The `useApproveItem` hook in ItemDetail uses `mutateAsync`**, meaning the component awaits the mutation result before navigating. After adding optimistic updates, the component code should be reviewed to potentially switch from `await approveFeature(mongoId)` + `navigateBack()` to a fire-and-forget pattern. However, since the current pattern catches errors to show a toast, keeping `mutateAsync` with try/catch is acceptable.

8. **Run `yarn build:claude`** after Phase 8 documentation changes to regenerate CLAUDE.md.
