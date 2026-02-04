# Bug Fix: Extremely slow loading of the app

## Root Cause Analysis

**The Bug:** The app loads extremely slowly on iPhone (Chrome), showing "Plan not found" errors initially, then eventually loading the plan after navigation.

**Root Causes Identified:**

1. **Large Exercise Library Response (208KB)**
   - The `exercise-definitions/list` API returns 208KB of data
   - This data is fetched on multiple pages (Home, TrainingPlans, ManagePlan)
   - The response takes 1486ms to load according to session logs
   - On slow mobile networks (especially iPhone), this creates significant delay

2. **Query Execution Race Condition**
   - Session logs show repeated "Plan not found" errors for plan ID `69595f259c7f329fccd06bc3`
   - The errors occur because plan-dependent queries (training-plans/get, plan-workouts/list) execute before the plans list has loaded
   - Multiple routes load plan data independently without coordination
   - Each query has `enabled: !!planId` but doesn't check if the planId is actually valid yet

3. **React Query Cache May Be Disabled**
   - User asked "What about caching?" suggesting cache might not be working
   - Default cache settings: staleTime=30s, gcTime=30min, persist=7days
   - If user disabled "staleWhileRevalidate" in Settings, all caching is disabled (staleTime=0, gcTime=0)
   - With caching disabled, every page navigation refetches all data, causing slow load times

4. **No Query Deduplication Across Routes**
   - Multiple components fetch the same data independently
   - Home, TrainingPlans, and ManagePlan all call `useExerciseLibrary()`
   - Each route loads plans independently without sharing cached data effectively

**Trigger Conditions:**
- Slow network connection (mobile data, weak WiFi)
- First app load or after cache expiry
- User disabled cache via Settings → "Use Cache" toggle
- iPhone with Chrome browser on iOS (as reported)

## Scope Assessment

**Similar Performance Patterns Found:**

The following areas have similar performance characteristics that could benefit from the same optimizations:

1. **Exercise Library Loading** (3 locations):
   - `src/client/routes/project/Home/Home.tsx` - calls `useExerciseLibrary()` via hooks
   - `src/client/routes/project/TrainingPlans/hooks.ts` - defines `useExerciseLibrary()`
   - `src/client/routes/project/ManagePlan/hooks.ts` - defines duplicate `useExerciseLibrary()`

2. **Plans List Loading** (2 locations):
   - `src/client/features/project/workout/hooks.ts` - defines `usePlans()` 
   - `src/client/routes/project/TrainingPlans/hooks.ts` - defines duplicate `usePlans()`

3. **Plan-Dependent Queries** (multiple locations):
   - All queries that depend on `planId` without validating it exists first
   - Home page loads plan data via `useLoadPlan()` and `useLoadWeekProgress()`
   - ManagePlan loads plan via `usePlan(planId)`

**Impact:** This is a systemic architecture issue affecting all pages that load exercise or plan data.

## Fix Approach

### Primary Fixes (Root Cause)

**Fix 1: Reduce Exercise Library Payload Size**
- Add pagination or filtering to `exercise-definitions/list` API
- Allow clients to request only fields they need (e.g., just name/ID for dropdowns)
- Consider splitting into system exercises (rarely change) vs custom exercises (user-specific)
- Alternative: Add `includeImages: false` option to exclude image URLs when not needed

**Fix 2: Implement Proper Query Dependency Chain**
- Ensure plan-dependent queries wait for plans list to load successfully
- Add validation in queries: `enabled: !!planId && plansAreLoaded`
- Prevent "Plan not found" errors by checking plan exists in cache before querying

**Fix 3: Add Longer Cache Times for Static Data**
- Exercise library changes rarely - increase staleTime to 5 minutes (300s) instead of 30s
- Plan list changes infrequently - increase staleTime to 2 minutes (120s)
- Make this independent of user's global cache setting

**Fix 4: Consolidate Duplicate Query Hooks**
- Move `useExerciseLibrary()` to a shared location (e.g., `src/client/features/project/exercises/`)
- Move `usePlans()` to a shared location (already exists in workout/hooks.ts)
- Remove duplicate definitions to ensure all components share the same cached data

### Secondary Improvements (Observability)

**Improvement 1: Add Loading Performance Metrics**
- Track time from app mount to first meaningful paint
- Log cache hit/miss rates for debugging
- Add performance markers for slow queries (>1s)

**Improvement 2: Add User Guidance for Cache Settings**
- If cache is disabled and network is slow, show tip: "Enable cache in Settings for faster loading"
- Add info tooltip in Settings explaining cache benefits

**Improvement 3: Add Query Status Debugging**
- Log when plan-dependent queries fail due to missing plan
- Better error messages: "Plan loading..." vs "Plan not found"

## Files to Modify

**API Layer:**
- `src/apis/exercise-definitions/handlers/listExercises.ts`
  - Add optional request parameters: `includeImages?: boolean`, `fields?: string[]`
  - Conditionally exclude imageUrl when `includeImages: false`
  - Consider pagination if library grows beyond 500 exercises

- `src/apis/exercise-definitions/types.ts`
  - Add new request parameters to `ListExercisesRequest` type

**Shared Query Hooks (Consolidation):**
- `src/client/features/project/exercises/hooks.ts` (create new)
  - Move `useExerciseLibrary()` here with optimized cache settings
  - Set `staleTime: 5 * 60 * 1000` (5 minutes) regardless of user settings
  - Add `enabled` parameter for conditional fetching

- `src/client/features/project/exercises/index.ts` (create new)
  - Export consolidated exercise hooks

**Route Hooks (Remove Duplicates):**
- `src/client/routes/project/TrainingPlans/hooks.ts`
  - Remove `useExerciseLibrary()` definition
  - Import from shared location instead
  - Keep plan-specific mutations

- `src/client/routes/project/ManagePlan/hooks.ts`
  - Remove `useExerciseLibrary()` definition
  - Import from shared location instead

**Query Configuration:**
- `src/client/query/defaults.ts`
  - Add `useQueryDefaultsForStatic()` hook that returns longer cache times
  - Document usage for static/rarely-changing data

**Plan Loading Logic:**
- `src/client/features/project/plan-data/hooks.ts`
  - Add validation in `useLoadPlan()`: check plan exists before loading
  - Add `enabled: plansLoaded && !!planId` to prevent premature queries

- `src/client/features/project/workout/hooks.ts`
  - Update `useSyncActivePlan()` to return `plansLoaded` flag
  - Ensure dependent queries wait for this flag

**Home Page:**
- `src/client/routes/project/Home/Home.tsx`
  - Update to use consolidated `useExerciseLibrary()` from shared location
  - Update loading state to check `plansLoaded` before loading plan data
  - Pass `includeImages: false` to exercise library query (images not shown on Home)

**ManagePlan Page:**
- `src/client/routes/project/ManagePlan/ManagePlan.tsx`
  - Update to use consolidated hooks
  - Add proper dependency chain: wait for plans to load before loading plan details

## Testing Strategy

**Manual Testing:**
1. Test on slow network connection (Chrome DevTools → Network → Slow 3G)
2. Test with cache disabled (Settings → Use Cache → OFF)
3. Test with cache enabled (Settings → Use Cache → ON)
4. Navigate between Home → TrainingPlans → ManagePlan and verify no "Plan not found" errors
5. Verify exercise library loads only once when navigating between pages
6. Test on iPhone with Chrome browser specifically

**Performance Verification:**
1. Measure time to first meaningful paint with DevTools Performance tab
2. Verify exercise library response size reduced (should be <50KB without images)
3. Verify no duplicate requests for same data in Network tab
4. Check React Query DevTools to confirm cache sharing across routes

**Regression Testing:**
1. Verify all exercise selection flows still work (AI chat, ManagePlan, CreatePlan)
2. Verify offline mode still works with mutations
3. Verify cache clear in Settings still works

## Implementation Priority

**High Priority (Must Fix):**
1. Fix query dependency chain to eliminate "Plan not found" errors
2. Consolidate duplicate query hooks to ensure cache sharing
3. Add `includeImages: false` option to reduce payload size on pages that don't show images

**Medium Priority (Should Fix):**
1. Increase cache times for static data (exercise library, plans list)
2. Add loading performance metrics

**Low Priority (Nice to Have):**
1. Add user guidance for cache settings
2. Add query status debugging
3. Implement full pagination for exercise library (only if library grows beyond 500 items)

## Expected Performance Improvement

**Before Fix:**
- Initial load: 3-5 seconds on slow connection
- "Plan not found" errors: 6-8 occurrences per load
- Exercise library payload: 208KB
- Cache effectiveness: Poor (duplicate queries, race conditions)

**After Fix:**
- Initial load: 1-2 seconds on slow connection
- "Plan not found" errors: 0 (eliminated via dependency chain)
- Exercise library payload: 30-50KB (without images)
- Cache effectiveness: Good (shared queries, proper dependencies)
- Subsequent navigation: <500ms (fully cached)

## Risk Assessment

**Low Risk:**
- Cache time adjustments (can be reverted easily)
- Adding optional API parameters (backward compatible)
- Consolidating query hooks (pure refactor, same behavior)

**Medium Risk:**
- Query dependency changes (must test thoroughly to avoid breaking flows)
- Adding `plansLoaded` flag (affects multiple components)

**Mitigation:**
- Test all user flows before deploying
- Monitor error rates after deployment
- Keep old query hooks temporarily for easy rollback