# Bug Fix: Extremely slow loading of the app

## Root Cause Analysis

**The Bug:** The app experiences extremely slow initial load times, particularly on mobile devices with slower internet connections. The user reported slow loading of the login modal, then the plan, and seeing "no plan found" errors before eventually loading successfully.

**Root Cause:** Analysis of the session logs reveals multiple performance bottlenecks:

1. **Massive Exercise Library Payload (Primary Issue)**
   - The `exercise-definitions/list` API returns 208KB of data in a single response
   - This API is called on initial load and fetches ALL system exercises plus custom exercises
   - According to industry standards, fitness exercise databases typically contain 800-11,000+ exercises
   - The current implementation has no pagination, filtering, or lazy loading
   - On slow mobile connections (as reported - iPhone on mobile network), downloading 208KB takes 1.4+ seconds
   - This blocks rendering and creates a poor user experience

2. **Race Condition with Plan Loading (Secondary Issue)**
   - Session logs show 8 consecutive "Plan not found" errors for planId `69595f259c7f329fccd06bc3`
   - The wrong plan ID was being used initially, then later the correct plan ID `694a4983067f2aea033f4ec0` succeeded
   - This suggests timing/race condition in how the active plan is selected from React Query cache
   - The `useSyncActivePlan` hook depends on `usePlans()` query data, but if the component renders before the query completes, it may use a stale/wrong plan ID from the store

3. **No Progressive Enhancement**
   - The app doesn't show any meaningful UI until all data is loaded
   - No skeleton states or progressive loading
   - Users see a blank screen during the multi-second load time

4. **Inefficient Data Fetching**
   - Exercise definitions are fetched on every page load even though they rarely change
   - No server-side caching (disabled with `disableCache: true` in processApiCall.ts)
   - React Query stale time defaults mean exercises are re-fetched frequently

**Trigger Condition:** 
- Initial app load on slow network connections (especially mobile)
- Large exercise library (likely 1000+ exercises with images/metadata)
- Multiple parallel API calls competing for bandwidth

## Scope Assessment

**Similar patterns found:**

**Exercise Library Loading Pattern:**
- `src/client/routes/project/TrainingPlans/hooks.ts` - calls `listExercises()` with no filters
- `src/client/routes/project/ManagePlan/hooks.ts` - calls `listExercises()` with no filters
- Both load the entire 208KB exercise library upfront

**Plan Loading Race Conditions:**
- `src/client/features/project/workout/hooks.ts` - `useSyncActivePlan()` depends on query data timing
- `src/client/routes/project/Home/Home.tsx` - uses `useSyncActivePlan()` which can race with data loading

**Missing Progressive Enhancement:**
- Multiple pages render nothing while waiting for data
- No skeleton loaders during initial load

## Fix Approach

### Primary Fixes (Performance)

**1. Implement Lazy Loading for Exercise Definitions**

Create a new optimized API endpoint that returns minimal exercise data needed for the initial view:

- **Add `exercise-definitions/list-minimal` endpoint** that returns only essential fields (id, name, primaryMuscle, type) without images/descriptions
- **Add pagination support** to `exercise-definitions/list` (limit, offset parameters)
- **Add filtering support** by muscle group, equipment, type to reduce payload size
- **Load full exercise details on-demand** when user selects an exercise

Estimated payload reduction: 208KB → 10-20KB for minimal list, ~2KB per full exercise detail

**2. Implement Server-Side Caching for Exercise Definitions**

- Re-enable server-side caching for `exercise-definitions/list` (currently disabled)
- Set long cache TTL (1 hour+) since exercise definitions are mostly static
- Add cache invalidation on exercise create/update/delete
- This prevents repeated 208KB transfers for the same data

**3. Optimize Query Defaults for Static Data**

- Set longer `staleTime` (5-10 minutes) for exercise definitions query
- This prevents unnecessary refetches of rarely-changing data
- Current default is 5 minutes which is reasonable, but could be increased to 10 minutes for exercises

**4. Add Database Indexes**

- Ensure MongoDB has indexes on `exerciseDefinitions` collection:
  - `{ isSystem: 1, name: 1 }` for findSystemExercises()
  - `{ userId: 1, isSystem: 1, name: 1 }` for findAllExercises()
- This speeds up exercise queries significantly with large datasets

### Secondary Fixes (Race Conditions)

**5. Fix Plan Selection Race Condition**

In `useSyncActivePlan()`, add proper loading/ready state checks:

- Don't attempt to use plan data until query has completed at least once
- Add explicit check: `if (isLoading && !plansData) return { activePlan: undefined, plans: [], isLoading: true }`
- Ensure the store's `activePlanId` is only set after plans data is available
- This prevents using stale/wrong plan IDs from localStorage before fresh data loads

**6. Add Retry Logic for Plan Not Found**

When plan APIs fail with "Plan not found":

- Check if the plan ID in the request matches what's in React Query cache
- If mismatch detected, retry with the correct plan ID from cache
- This prevents the cascade of 8 failed requests seen in the logs

### Secondary Improvements (UX/Observability)

**7. Add Progressive Loading States**

- Show skeleton loaders immediately while data is fetching
- Load critical data first (user, active plan) before loading exercise library
- Make exercise library load non-blocking (defer until user needs it)

**8. Add Performance Monitoring**

- Log timing metrics for critical API calls
- Track "time to interactive" metric
- Alert when API responses exceed thresholds (e.g., >500ms, >100KB)

## Files to Modify

**API Layer - New Exercise Loading:**
- `src/apis/exercise-definitions/handlers/listExercisesMinimal.ts` (NEW)
  - Create handler that returns minimal exercise data (id, name, muscle, type only)
  - Add pagination parameters (limit, offset)
  - Add filtering parameters (muscleGroup, equipment, type)

- `src/apis/exercise-definitions/handlers/listExercises.ts`
  - Add pagination support (limit, offset)
  - Add filtering support (muscleGroup, equipment, type)
  - Return filtered/paginated results

- `src/apis/exercise-definitions/index.ts`
  - Add `API_LIST_EXERCISES_MINIMAL` constant

- `src/apis/exercise-definitions/client.ts`
  - Add `listExercisesMinimal()` function
  - Update `listExercises()` to support new parameters

- `src/apis/exercise-definitions/server.ts`
  - Register new `listExercisesMinimal` handler

- `src/apis/exercise-definitions/types.ts`
  - Add `ListExercisesMinimalRequest` type
  - Add `ListExercisesMinimalResponse` type with minimal exercise fields
  - Update `ListExercisesRequest` to include pagination/filter options

**Database Layer:**
- `src/server/database/collections/exerciseDefinitions/exerciseDefinitions.ts`
  - Update `findSystemExercises()` to support pagination and filters
  - Update `findAllExercises()` to support pagination and filters
  - Add `findSystemExercisesMinimal()` that projects only minimal fields
  - Add `findAllExercisesMinimal()` that projects only minimal fields

- `src/server/database/collections/exerciseDefinitions/types.ts`
  - Add `ExerciseDefinitionMinimal` type (subset of fields)

**Server-Side Caching:**
- `src/apis/processApiCall.ts`
  - Change line 63: `disableCache: true` → `disableCache: false` for GET endpoints
  - Add cache TTL configuration per API endpoint
  - Set long TTL (1 hour) for exercise-definitions APIs

- `src/server/cache/cacheConfig.ts`
  - Add cache configuration for exercise endpoints
  - Define TTL values: 3600s (1 hour) for exercises

**Client Hooks - Exercise Loading:**
- `src/client/routes/project/ManagePlan/hooks.ts`
  - Update `useExerciseLibrary()` to use `listExercisesMinimal()` by default
  - Add `useFullExerciseDetails()` hook for loading full details on-demand
  - Implement infinite query pattern if showing long exercise lists

- `src/client/routes/project/TrainingPlans/hooks.ts`
  - Update `useExerciseLibrary()` to use `listExercisesMinimal()` by default
  - Add filtering/pagination support

**Client Hooks - Plan Race Condition:**
- `src/client/features/project/workout/hooks.ts`
  - Fix `useSyncActivePlan()` to check `isLoading && !plansData` before using data
  - Add guard: return early if query hasn't completed at least once
  - Prevent setting activePlanId from stale localStorage until fresh data loads

**Query Configuration:**
- `src/client/query/queryClient.ts`
  - Increase default staleTime for exercise queries to 10 minutes (600000ms)
  - Keep current defaults for plan/progress queries (5 minutes is reasonable)

**UI Components - Progressive Loading:**
- `src/client/routes/project/Home/Home.tsx`
  - Show skeleton immediately while `plansLoading` or `storeLoading`
  - Don't render main content until data is ready
  - Add loading indicator for exercise library

- `src/client/routes/project/ManagePlan/ManagePlan.tsx`
  - Defer loading exercise library until user opens exercise picker
  - Show loading state in exercise picker while fetching

## Testing Strategy

**Performance Testing:**
1. Measure initial load time before/after changes (target: <1s on 3G)
2. Measure exercise list API payload size (target: <20KB for minimal)
3. Test with slow network throttling (3G, 2G) in Chrome DevTools
4. Verify React Query cache hit rate increases with new settings

**Race Condition Testing:**
1. Test app load with cleared cache (cold start)
2. Test rapid navigation before queries complete
3. Verify no "Plan not found" errors during normal load
4. Test with multiple plans, ensure correct active plan is selected

**Data Correctness:**
1. Verify minimal exercise list has all required fields
2. Verify pagination returns correct results
3. Verify filtering works correctly
4. Verify full exercise details load on-demand

**Database Performance:**
1. Add indexes and verify query execution time <50ms
2. Test with 1000+ exercises in database
3. Monitor MongoDB slow query log

## Implementation Plan

**Phase 1: Quick Wins (Immediate Impact)**
1. Enable server-side caching for exercise endpoints
2. Fix plan race condition in useSyncActivePlan
3. Add loading skeletons to Home and ManagePlan pages
4. Add database indexes for exercise queries

**Phase 2: Lazy Loading (Major Impact)**
5. Implement exercise-definitions/list-minimal API
6. Update client hooks to use minimal list by default
7. Implement on-demand full details loading
8. Add pagination and filtering support

**Phase 3: Monitoring & Optimization**
9. Add performance monitoring
10. Tune cache TTLs based on usage patterns
11. Consider implementing service worker for offline caching

## Risk Assessment

**Low Risk:**
- Enabling server-side caching (easily reversible)
- Adding database indexes (only improves performance)
- Adding loading states (visual-only change)

**Medium Risk:**
- Changing exercise loading pattern (requires coordination between API and client)
- Must ensure backward compatibility if gradual rollout needed
- Minimal list might be missing fields needed by some components

**Mitigation:**
- Add feature flag for lazy loading to enable gradual rollout
- Keep existing list API working alongside new minimal API
- Thoroughly test exercise picker and plan creation flows
- Add error boundaries to catch any missing field errors
