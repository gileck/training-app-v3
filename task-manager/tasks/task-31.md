---
number: 31
title: Remove Legacy MongoDB Design Fields (productDesign/techDesign)
priority: Medium
size: M
complexity: Low
status: Done
dateAdded: 2026-01-28
dateUpdated: 2026-01-28
dateCompleted: 2026-01-28
---

# Task 31: Remove Legacy MongoDB Design Fields (productDesign/techDesign)

**Summary:** Remove unused productDesign and techDesign fields from FeatureRequestDocument - designs are now stored in files and tracked via GitHub Projects

## Details

### Background

The `productDesign` and `techDesign` fields in MongoDB's `FeatureRequestDocument` are legacy code that is no longer used:

**Current System (Active):**
- Design content → stored in files: `design-docs/issue-N/*.md`
- Workflow status → tracked in GitHub Projects: `item.status`, `item.reviewStatus`

**Legacy System (Unused):**
- `productDesign` and `techDesign` MongoDB fields
- Related API endpoints and database functions
- UI components displaying this data

**Evidence:**
1. Agents read from files: `readDesignDoc(issueNumber, 'tech')`
2. Database function has deprecation comment (line 229)
3. No callers for `updateDesignContent` API

### Note: What to KEEP

The following use `productDesign`/`techDesign` as **local variables** (not MongoDB fields) and should NOT be removed:
- `src/agents/*` - Local variables for design content read from files
- `src/server/template/project-management/config.ts` - GitHub Projects status names
- `STATUSES.productDesign`/`STATUSES.techDesign` - GitHub Projects statuses

## Implementation Notes

### Files to Delete

1. `scripts/design-features.ts` - Entire legacy script
2. `src/apis/feature-requests/handlers/updateDesignContent.ts` - Entire file
3. `src/apis/feature-requests/handlers/updateDesignReviewStatus.ts` - Entire file

### Database Layer

**`src/server/database/collections/feature-requests/types.ts`:**
- Remove `productDesign?: DesignPhase` from `FeatureRequestDocument`
- Remove `techDesign?: DesignPhase` from `FeatureRequestDocument`
- Remove `productDesign?: DesignPhaseClient` from `FeatureRequestClient`
- Remove `techDesign?: DesignPhaseClient` from `FeatureRequestClient`
- Remove `DesignPhase` interface
- Remove `DesignPhaseClient` interface
- Remove `DesignReviewStatus` type
- Remove `DesignPhaseType` type (keep if used elsewhere)

**`src/server/database/collections/feature-requests/feature-requests.ts`:**
- Remove `updateDesignContent()` function
- Remove `setDesignReviewStatus()` function
- Remove `findPendingDesignWork()` function
- Remove `markDesignInProgress()` function

### API Layer

**`src/apis/feature-requests/types.ts`:**
- Remove `UpdateDesignContentRequest`/`Response`
- Remove `UpdateDesignReviewStatusRequest`/`Response`
- Remove re-exports of `DesignReviewStatus`, `DesignPhaseType`, `DesignPhaseClient`

**`src/apis/feature-requests/index.ts`:**
- Remove `API_UPDATE_DESIGN_CONTENT`
- Remove `API_UPDATE_DESIGN_REVIEW_STATUS`

**`src/apis/feature-requests/client.ts`:**
- Remove `updateDesignContent()` function
- Remove `updateDesignReviewStatus()` function
- Remove related imports

**`src/apis/feature-requests/server.ts`:**
- Remove handler imports and registrations

**`src/apis/feature-requests/handlers/utils.ts`:**
- Remove `toDesignPhaseClient()` function
- Remove `productDesign`/`techDesign` mapping in `toFeatureRequestClient()`

### UI Layer

**`src/client/routes/FeatureRequests/FeatureRequestDetail.tsx`:**
- Remove `hasProductDesign`/`hasTechDesign` variables (lines 91-92)
- Remove design display sections (lines 314-354)

**`src/client/routes/FeatureRequests/components/FeatureRequestCard.tsx`:**
- Remove `currentDesignPhase` logic (lines 88-93)

**`src/client/routes/FeatureRequests/hooks.ts`:**
- Remove design update logic (line 145)

### Package.json

- Remove `"design-features"` script

## Files to Modify

- `scripts/design-features.ts` - DELETE entire file
- `src/apis/feature-requests/handlers/updateDesignContent.ts` - DELETE entire file
- `src/apis/feature-requests/handlers/updateDesignReviewStatus.ts` - DELETE entire file
- `src/server/database/collections/feature-requests/types.ts` - Remove design types
- `src/server/database/collections/feature-requests/feature-requests.ts` - Remove design functions
- `src/apis/feature-requests/types.ts` - Remove design request/response types
- `src/apis/feature-requests/index.ts` - Remove API exports
- `src/apis/feature-requests/client.ts` - Remove client functions
- `src/apis/feature-requests/server.ts` - Remove handler registrations
- `src/apis/feature-requests/handlers/utils.ts` - Remove toDesignPhaseClient
- `src/client/routes/FeatureRequests/FeatureRequestDetail.tsx` - Remove design display
- `src/client/routes/FeatureRequests/components/FeatureRequestCard.tsx` - Remove design logic
- `src/client/routes/FeatureRequests/hooks.ts` - Remove design update hook
- `package.json` - Remove design-features script

## Risks

- Verify no hidden callers to the removed API endpoints
- Ensure agents are not affected (they use local variables, not MongoDB)

## Notes

This cleanup was identified during investigation of why productDesign/techDesign are stored in MongoDB when designs are tracked in GitHub files and Projects.
