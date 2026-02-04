# Bug Fix: Extremely slow loading of the app

## Root Cause Analysis

**The Bug:** The app loads extremely slowly and shows repeated "Plan not found" errors before eventually showing a plan after navigation.

**Root Cause:** This is a multi-part performance and caching issue:

### 1. Stale Plan ID in Persistent Storage
The workout store (`workout-storage`) persists `activePlanId` in localStorage. When a user has a deleted or non-existent plan ID stored (like `69595f259c7f329fccd06bc3` from the logs), the app attempts to load data for that stale ID on every page load.

**Why this happens:**
- User deletes a plan or it becomes unavailable
- The `activePlanId` remains in localStorage
- On next app load, the Home component calls `useSyncActivePlan()` which fetches all plans
- Simultaneously, `useLoadPlan()` and `usePlanWorkouts()` try to fetch data for the stale plan ID
- These API calls fail with "Plan not found"

### 2. Excessive Retries on Non-Retriable Errors
React Query is configured with `retry: 3` and exponential backoff (up to 30 seconds). When API calls return "Plan not found" errors, React Query treats them as retriable network errors and retries multiple times:

**From the logs:**
- `plan-workouts/list` takes 3952ms before failing (with retries)
- `training-plans/get` takes 3963ms before failing (with retries)
- Multiple subsequent retries happen (09:09:11 → 09:09:12 → 09:09:14 → 09:09:15 → 09:09:19 → 09:09:20)

**Why retries are excessive:**
- "Plan not found" is a permanent 404-type error, not a transient network failure
- React Query's default retry logic retries ALL errors 3 times with exponential backoff
- This adds ~4 seconds per failed API call
- With multiple parallel API calls failing (training-plans/get, plan-workouts/list), the cumulative delay is 8+ seconds

### 3. Large Exercise Definitions Payload
The `exercise-definitions/list` API returns 208KB of data and takes 1486ms to load. This is loaded on every page load and blocks the UI from becoming interactive.

**From the logs:**
```
ℹ️ [2026-02-04T09:09:08.802Z] API Response: exercise-definitions/list | 
{"apiName":"exercise-definitions/list","type":"response","response":"[Data too large for logs - 208KB]","duration":1486,"cached":false}
```

**Why this is slow:**
- 208KB payload over mobile networks (user is on iPhone) takes significant time
- Exercise definitions rarely change but are fetched fresh every time
- No caching or pagination strategy for this large dataset

### 4. Race Condition Between Store and Server Data
The `useSyncActivePlan()` hook fetches all plans from the server and updates the store with the active plan. However, other hooks (`useLoadPlan`, `usePlanWorkouts`) use `activePlanId` from the store immediately, creating a race:

**Sequence:**
1. Component mounts, reads stale `activePlanId` from localStorage
2. `usePlanWorkouts(activePlanId)` fires immediately with stale ID → fails
3. `useSyncActivePlan()` fetches plans from server (slower)
4. After plans load, active plan ID is updated in store
5. User navigates away and back, new plan ID works

**Trigger Condition:** 
- Fresh app load with stale plan ID in localStorage
- Slow network connection (mobile, as indicated by iPhone user agent)
- Large exercise definitions payload further delays the fix

## Scope Assessment

**Similar patterns found:** This issue affects multiple performance-critical code paths:

### Files with Retry Configuration Issues:
- `src/client/query/queryClient.ts` (line 15) - Global retry configuration for all queries
- `src/client/utils/apiClient.ts` (lines 111-136) - Additional custom retry logic in `call()` method

### Files with Stale ID Usage:
- `src/client/routes/project/Home/Home.tsx` (line 64) - Uses `activePlanId` before sync completes
- `src/client/features/project/plan-data/hooks.ts` - `useLoadPlan()` uses activePlanId immediately
- `src/client/features/project/plan-workouts/hooks.ts` (line 61) - `usePlanWorkouts()` uses activePlanId immediately

### Files with Large Payload Issues:
- `src/apis/exercise-definitions/handlers/listExercises.ts` - Returns all exercise definitions at once
- All components that call `useExerciseLibrary()` trigger this 208KB fetch

**All locations need coordinated fixes** to resolve the performance issue.

## Fix Approach

### Primary Fix 1: Smart Retry Logic (Prevents 8+ seconds of wasted retries)

**Change:** Update React Query retry logic to distinguish between retriable and non-retriable errors.

**Implementation:**
- Modify `src/client/query/queryClient.ts` to add a custom `retry` function
- Parse error messages to detect permanent errors ("not found", "not authenticated", "unauthorized", etc.)
- Return `false` (no retry) for permanent errors
- Return `true` for network errors and transient failures
- Remove redundant retry logic from `src/client/utils/apiClient.ts` (let React Query handle it)

**Expected improvement:** Eliminates ~8 seconds of retry delays for "Plan not found" errors

### Primary Fix 2: Validate and Sync Plan ID on Mount (Prevents stale ID usage)

**Change:** Ensure `activePlanId` is validated against server data before other hooks use it.

**Implementation:**
- Modify `src/client/features/project/workout/hooks.ts` (`useSyncActivePlan`)
  - If stored `activePlanId` doesn't exist in fetched plans list, clear it immediately
  - Set the first available plan or null if no plans exist
- Update `src/client/routes/project/Home/Home.tsx`
  - Wait for `plansData !== undefined` before using `activePlanId` for data fetches
  - Show loading skeleton until sync completes
- Modify `src/client/features/project/plan-workouts/hooks.ts`
  - Add `enabled` check that waits for valid plan ID

**Expected improvement:** Prevents API calls with stale plan IDs, eliminates cascading failures

### Primary Fix 3: Add Pagination/Caching for Exercise Definitions (Reduces 208KB payload)

**Change:** Optimize exercise definitions loading to reduce initial payload size.

**Implementation Options:**

**Option A: Aggressive Client-Side Caching (Quickest fix)**
- Modify `src/client/routes/project/ManagePlan/hooks.ts` (`useExerciseLibrary`)
- Set `staleTime: Infinity` for exercise definitions query
- Exercise data only refreshes on manual user action or plan changes
- Reduces 208KB fetch from every page load to once per session

**Option B: Lazy Loading (Better UX)**
- Modify exercise library components to load exercises only when user opens the add exercise dialog
- Move `useExerciseLibrary()` call from Home component to ExerciseLibraryBrowser component
- Reduces initial page load by ~1.5 seconds

**Option C: Server-Side Pagination (Most comprehensive)**
- Add pagination parameters to `exercise-definitions/list` API
- Fetch only 50 exercises initially, load more on scroll
- More complex, requires API and DB changes

**Recommendation:** Start with Option A (immediate fix) + Option B (better UX), consider Option C for future optimization

### Secondary Improvements (Observability)

**Change:** Add performance monitoring and better error messages.

**Implementation:**
- Add console warnings when stale plan ID is detected and cleared
- Add performance marks for key loading stages (plans fetch, exercise fetch, render)
- Log when retry logic is triggered vs. skipped
- Add user-facing message: "Your saved plan was not found. Loading your active plan..."

## Files to Modify

**High Priority (Core Fixes):**

- `src/client/query/queryClient.ts`
  - Add smart retry function that checks error messages
  - Skip retries for "not found", "not authenticated", "unauthorized" errors
  - Keep retries for network errors (TypeError, timeout, 500 errors)

- `src/client/features/project/workout/hooks.ts` (`useSyncActivePlan`)
  - Clear `activePlanId` from store if it doesn't exist in fetched plans
  - Update store immediately when stale ID detected
  - Return flag indicating if sync is in progress

- `src/client/routes/project/Home/Home.tsx`
  - Update loading condition to wait for plan sync completion
  - Prevent data fetches until valid plan ID is confirmed

- `src/client/features/project/plan-workouts/hooks.ts` (`usePlanWorkouts`)
  - Add enabled check that waits for valid plan ID before fetching

- `src/client/routes/project/ManagePlan/hooks.ts` (`useExerciseLibrary`)
  - Set `staleTime: Infinity` to cache exercise definitions aggressively
  - Only refetch on explicit user actions (plan changes, manual refresh)

**Medium Priority (Performance Optimization):**

- `src/client/utils/apiClient.ts`
  - Remove redundant retry logic in `call()` method (lines 111-136)
  - Let React Query handle all retries centrally

**Low Priority (Observability):**

- `src/client/features/project/workout/hooks.ts`
  - Add console.warn when stale plan ID is cleared
  - Add performance marks for debugging

## Testing Strategy

**Test Cases:**

1. **Stale Plan ID Scenario**
   - Store a non-existent plan ID in localStorage (`workout-storage`)
   - Refresh the app
   - Verify: No "Plan not found" errors appear
   - Verify: App loads with active plan (or no-plan state) within 2 seconds

2. **Fresh App Load Performance**
   - Clear all caches and localStorage
   - Create a test user with one active plan
   - Measure time from page load to interactive state
   - Target: < 3 seconds on fast network, < 5 seconds on slow 3G

3. **Retry Logic Validation**
   - Mock API to return "Plan not found" error
   - Verify: No retries occur (immediate failure)
   - Mock API to return network error (TypeError)
   - Verify: 3 retries occur with exponential backoff

4. **Exercise Definitions Caching**
   - Load Home page (exercises should load)
   - Navigate away and back
   - Verify: Exercise definitions served from cache (no API call)
   - Check network tab for 0 requests to exercise-definitions/list

## Implementation Plan

**Phase 1: Stop the Bleeding (Fixes critical slowness)**
1. Implement smart retry logic in `queryClient.ts`
2. Add stale plan ID validation in `useSyncActivePlan()`
3. Update Home.tsx to wait for sync completion
4. Test with stale plan ID scenario

**Phase 2: Optimize Payload (Reduces loading time)**
1. Implement aggressive caching for exercise definitions
2. Move exercise loading to lazy-load on dialog open
3. Test performance improvement on slow network

**Phase 3: Polish (Better UX)**
1. Add console warnings for debugging
2. Add performance marks
3. Add user-facing message for stale plan scenario
4. Test complete user flow

**Expected Performance Improvement:**
- Current: 15+ seconds to load with stale plan ID
- After Phase 1: 2-3 seconds to load (eliminates retry waste)
- After Phase 2: 1-2 seconds on subsequent loads (cached exercises)

## Risk Assessment

**Low Risk Changes:**
- Smart retry logic - isolated to query client configuration
- Exercise caching - can be reverted easily if issues arise

**Medium Risk Changes:**
- Plan ID sync logic - affects core app state management
- Mitigation: Add comprehensive logging to track state transitions
- Fallback: User can always manually select a plan from the plans list

**Testing Focus:**
- Verify no regressions in normal flow (fresh user with active plan)
- Test edge cases: deleted plans, no plans, multiple plans
- Test on slow networks (mobile 3G simulation)