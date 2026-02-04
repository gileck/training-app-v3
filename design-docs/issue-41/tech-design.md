# Bug Fix: Extremely slow loading of the app

## Root Cause Analysis

**The Bug:** The app loads extremely slowly, showing "Plan not found" errors and taking 15+ seconds before displaying content.

**Root Cause:** After thorough code investigation, the issue is NOT primarily caused by exercise definitions loading or stale plan IDs. The actual root causes are:

### 1. Unnecessary Exercise Library Loading on Home Page

**The Critical Discovery:**
The Home page (`src/client/routes/project/Home/Home.tsx`) does NOT call `useExerciseLibrary()` at all. Looking at the code:

- Lines 28-46: Imports show no `useExerciseLibrary` import
- Lines 61-93: Component logic shows exercise definitions come from `listPlanExercises` API (line 88-90 in `src/apis/plan-exercises/handlers/listPlanExercises.ts`)
- Line 364 in `src/client/features/project/plan-data/hooks.ts`: Exercise definitions are embedded in plan data via `exerciseDef` field

**How Exercise Definitions Actually Work:**
1. When `useLoadPlan()` is called (line 64 of Home.tsx), it fetches plan exercises via `listPlanExercises` API
2. The API handler (`src/apis/plan-exercises/handlers/listPlanExercises.ts` lines 32-34) fetches exercise definitions ONLY for exercises in that plan
3. These definitions are returned embedded in the response (lines 40-72)
4. The plan data store (`src/client/features/project/plan-data/store.ts`) stores these definitions with each exercise
5. Home page displays exercises with embedded definitions - no separate exercise library fetch needed

**Where Exercise Library IS Used:**
- `src/client/routes/project/ManagePlan/ManagePlan.tsx` (line 62): When user opens the "Manage Plan" page to ADD exercises
- `src/client/routes/project/TrainingPlans/components/CreatePlanWithAiDialog.tsx` (line 76): When user creates a plan with AI

**The Performance Lie:**
The logs show `exercise-definitions/list` taking 1486ms with 208KB payload. However, this endpoint is NOT called on Home page load. The logs are misleading - they likely show:
1. Background pre-fetching by React Query
2. Or user navigating to Manage Plan page after load

**Conclusion:**
Exercise definitions are NOT the bottleneck on Home page initial load. The 208KB fetch is a red herring.

### 2. React Query Retry Logic Wastes 8+ Seconds on Permanent Errors

**The Real Problem:**
React Query configuration (`src/client/query/queryClient.ts` lines 14-17) retries ALL errors 3 times with exponential backoff:

```typescript
retry: 3,
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
```

**Why This Causes Slowness:**
When the app loads with a stale plan ID in localStorage:
1. `useSyncActivePlan()` fetches all plans (succeeds)
2. SIMULTANEOUSLY, `useLoadPlan()` and `usePlanWorkouts()` use the stale `activePlanId` from store (lines 64, 90 of Home.tsx)
3. These API calls return "Plan not found" errors
4. React Query retries each failed call 3 times:
   - Attempt 1: immediate
   - Attempt 2: +1000ms
   - Attempt 3: +2000ms  
   - Attempt 4: +4000ms
   - Total: ~7 seconds per failed API call
5. With 2-3 parallel failed calls (plan data, plan workouts), total delay is 8-14 seconds

**From the Logs:**
- `plan-workouts/list` takes 3952ms before failing (3 retries)
- Multiple retry attempts at 09:09:11 → 09:09:12 → 09:09:14 → 09:09:15 → 09:09:19 → 09:09:20

**Why "Plan not found" Should NOT Be Retried:**
"Plan not found" is a permanent 404-type error indicating:
- User deleted the plan
- Plan ID is invalid
- Plan belongs to different user

No amount of retrying will fix this. It should fail immediately.

### 3. Race Condition: Stale Plan ID Used Before Sync Completes

**The Sequence:**
Looking at `src/client/routes/project/Home/Home.tsx`:

1. Line 53: `activePlanId` read from localStorage via Zustand store (`src/client/features/project/workout/store.ts` lines 11-12, persisted via lines 46-51)
2. Line 61: `useSyncActivePlan()` starts fetching all plans from server
3. Lines 64-65: `useLoadPlan(activePlanId)` fires IMMEDIATELY with stale ID (doesn't wait for sync)
4. Line 90: `usePlanWorkouts(activePlanId)` fires IMMEDIATELY with stale ID
5. Both API calls fail with "Plan not found"
6. Line 105-120: `useSyncActivePlan()` updates store with correct plan ID (but too late)

**Where the Stale ID Comes From:**
- User deletes a plan or it becomes unavailable
- `activePlanId` remains in localStorage (`workout-storage` key)
- Next app load reads stale ID from localStorage
- Store provides stale ID to all hooks immediately

**Why the Race Happens:**
Looking at `src/client/features/project/workout/hooks.ts` lines 99-131:
- `useSyncActivePlan()` uses React Query to fetch plans (async)
- Effect hook (lines 105-120) updates store AFTER fetch completes
- But Home component doesn't wait - it uses `activePlanId` immediately
- Line 299-301 of Home.tsx: Loading check waits for `plansData` but other hooks already fired

**The Fix Needed:**
Prevent data fetches until plan sync completes and validates the stored plan ID.

### 4. Missing Logging for Root Cause Investigation

**Admin's Critical Question:**
"Where is the plan id that is not found came from? Maybe from the url parameter? Do we have any idea why the app requested the plan for this plan id?"

**The Answer:**
Looking at the code:
- `src/client/features/project/workout/store.ts` lines 11-12: `activePlanId` comes from localStorage, not URL
- `src/client/routes/project/Home/Home.tsx` line 53: Home component reads it from store
- But there's NO logging to show:
  - When `activePlanId` is read from localStorage
  - Whether it's stale or valid
  - When sync detects a mismatch
  - Where the stale ID originated

**The Investigation Gap:**
Without logs showing:
1. "Read activePlanId X from localStorage"
2. "Fetched plans from server: [A, B, C]"
3. "Detected stale activePlanId X - not in server plans"
4. "Clearing stale activePlanId and setting to A"

We cannot diagnose WHEN and WHY the plan ID becomes stale.

## Scope Assessment

**Similar patterns found:**

### Files with Retry Configuration Issues:
- `src/client/query/queryClient.ts` (lines 14-17) - Global retry configuration retries all errors including permanent ones

### Files with Race Condition Issues:
- `src/client/routes/project/Home/Home.tsx` (lines 64, 90) - Uses `activePlanId` before sync validates it
- `src/client/features/project/workout/hooks.ts` (lines 99-131) - `useSyncActivePlan()` doesn't prevent usage of stale ID
- `src/client/features/project/plan-data/hooks.ts` (line 44) - `loadPlan()` doesn't check if ID is valid
- `src/client/features/project/plan-workouts/hooks.ts` (line 74) - `usePlanWorkouts()` doesn't check if ID is valid

### Files Missing Logging:
- `src/client/features/project/workout/store.ts` - No logging when activePlanId is loaded from localStorage
- `src/client/features/project/workout/hooks.ts` - No logging when stale ID is detected
- `src/client/features/project/plan-data/sync.ts` - No logging when plan fetch fails

**All locations need coordinated fixes** to resolve the performance issue.

## Fix Approach

### Primary Fix 1: Smart Retry Logic (Eliminates 8+ seconds of retry waste)

**Change:** Update React Query retry logic to immediately fail on permanent errors.

**Implementation:**
- Modify `src/client/query/queryClient.ts` to add a custom `retry` function
- Parse error responses to detect permanent errors:
  - "not found" / "Plan not found" / "Exercise not found"
  - "Not authenticated" / "not authenticated"
  - "Unauthorized" / "Forbidden"
  - "Invalid" / "Bad request"
- Return `false` (no retry) for permanent errors
- Return default retry behavior for:
  - Network errors (TypeError, fetch failures)
  - Server errors (500, 502, 503)
  - Timeout errors

**Implementation Detail:**
```typescript
retry: (failureCount, error) => {
  // Don't retry on permanent errors
  const errorMessage = error?.message?.toLowerCase() || '';
  const permanentErrors = [
    'not found',
    'not authenticated', 
    'unauthorized',
    'forbidden',
    'invalid',
    'bad request'
  ];
  
  if (permanentErrors.some(msg => errorMessage.includes(msg))) {
    return false;
  }
  
  // Retry network/server errors up to 3 times
  return failureCount < 3;
}
```

**Expected improvement:** Eliminates 7-14 seconds of wasted retry delays on permanent errors

### Primary Fix 2: Prevent Data Fetches Until Plan ID Validated

**Change:** Wait for plan sync to complete and validate `activePlanId` before allowing other hooks to fetch data.

**Implementation:**

**Step 1: Detect and Clear Stale Plan ID in `useSyncActivePlan()`**
- Modify `src/client/features/project/workout/hooks.ts` (lines 105-120)
- When plans are fetched, check if stored `activePlanId` exists in the plans list
- If not found, immediately clear it and set active plan to first available plan (or null if no plans)
- Add logging: "Detected stale activePlanId X - not in server plans"

**Step 2: Wait for Sync in Home Component**
- Modify `src/client/routes/project/Home/Home.tsx` loading check (lines 299-301)
- Current code waits for `plansData !== undefined`
- But hooks on lines 64, 90 fire BEFORE this check
- Solution: Add `enabled` checks to data-fetching hooks

**Step 3: Add Enabled Checks to Data Hooks**
- Modify `src/client/features/project/plan-data/hooks.ts` (line 38)
  - `useLoadPlan()` should check `plansData !== undefined` before loading
  - Add parameter to accept sync status
- Modify `src/client/features/project/plan-workouts/hooks.ts` (line 74)
  - Add check: `enabled: !!planId && plansData !== undefined`
  - Prevents fetch until sync completes

**Expected improvement:** Prevents API calls with stale plan IDs, eliminates cascading failures

### Primary Fix 3: Add Comprehensive Logging for Investigation

**Change:** Add logging at critical points to diagnose future issues.

**Implementation:**

**Log Points to Add:**

1. **In `src/client/features/project/workout/store.ts`** (after line 11):
   - When Zustand loads state from localStorage
   - Log: "Loaded activePlanId from localStorage: {id}" or "No activePlanId in localStorage"

2. **In `src/client/features/project/workout/hooks.ts`** (line 106):
   - When plans are fetched
   - Log: "Fetched {count} plans from server: [{ids}]"

3. **In `src/client/features/project/workout/hooks.ts`** (after line 109):
   - When stale ID detected
   - Log: "Stale activePlanId detected: {staleId} not in [{validIds}] - clearing"

4. **In `src/client/features/project/workout/hooks.ts`** (line 113-118):
   - When active plan is set
   - Log: "Setting activePlanId: {id} (from server)"

5. **In `src/client/features/project/plan-data/sync.ts`** (line 68):
   - When plan fetch fails
   - Log: "Failed to fetch plan {planId}: {error.message}"

**Log Format:**
Use console.warn for issues (stale IDs, failures) and console.log for normal flow (loaded from cache, set active plan)

**Expected improvement:** Future issues can be diagnosed in 30 seconds instead of 30 minutes

## Files to Modify

**High Priority (Core Fixes):**

- `src/client/query/queryClient.ts`
  - Replace `retry: 3` with smart retry function (lines 14-17)
  - Check error message for permanent errors ("not found", "not authenticated", etc.)
  - Return false for permanent errors, true (up to 3 times) for transient errors

- `src/client/features/project/workout/hooks.ts` (`useSyncActivePlan`)
  - After plans are fetched (line 106), check if `activePlanId` exists in plans list
  - If stored `activePlanId` not in server plans, clear it (lines 109-119)
  - Set active plan to first available or null
  - Add logging for stale ID detection
  - Return `plansData` in return object to allow callers to check sync status

- `src/client/features/project/plan-data/hooks.ts` (`useLoadPlan`)
  - Add `syncCompleted` parameter (boolean) 
  - Modify condition on line 43: `if (planId && !hasData && syncCompleted)`
  - Prevents loading until sync validates plan ID

- `src/client/features/project/plan-workouts/hooks.ts` (`usePlanWorkouts`)
  - Modify `enabled` check on line 74
  - Add condition to wait for plan sync: `enabled: !!planId && syncCompleted && (options?.enabled ?? true)`

- `src/client/routes/project/Home/Home.tsx`
  - Extract `plansData` from `useSyncActivePlan()` (line 61)
  - Pass sync status to hooks: `useLoadPlan(activePlanId, currentWeek, plansData !== undefined)`
  - Add same check for plan workouts hook

**Medium Priority (Observability):**

- `src/client/features/project/workout/store.ts`
  - Add logging when state is loaded from localStorage (after Zustand initialization)
  - Use `onRehydrateStorage` callback to log loaded `activePlanId`

- `src/client/features/project/plan-data/sync.ts`
  - Add console.warn when plan fetch fails (line 68)
  - Include plan ID and error message

**Low Priority (Not Needed for Fix):**

~~Exercise definitions caching~~ - Not relevant, as Home page doesn't load full exercise library

## Testing Strategy

**Test Cases:**

1. **Stale Plan ID Scenario**
   - Manually set a non-existent plan ID in localStorage: `{"state":{"activePlanId":"invalid-id-123"},"version":0}`
   - Refresh the app
   - Check browser console logs: Should see "Stale activePlanId detected" warning
   - Verify: No "Plan not found" errors in console
   - Verify: No retry attempts visible in Network tab
   - Verify: App loads with first available plan (or no-plan state) within 2 seconds
   - Verify: localStorage now has valid plan ID

2. **Fresh App Load Performance**
   - Clear all caches and localStorage
   - Create test user with one active plan
   - Measure time from page load to interactive state
   - Target: < 2 seconds on fast network, < 4 seconds on slow 3G
   - Verify: Only 1 request to each API (no retries)

3. **Retry Logic Validation - Permanent Error**
   - Use browser DevTools to block API response and return "Plan not found" error
   - Verify in Network tab: Only 1 request sent (no retries)
   - Verify timing: Fails immediately, not after 7 seconds

4. **Retry Logic Validation - Transient Error**
   - Use browser DevTools to block API and return 500 error
   - Verify in Network tab: 4 requests total (1 initial + 3 retries)
   - Verify timing: Retries with exponential backoff

5. **Logging Validation**
   - Open browser console
   - Refresh app
   - Verify logs appear in order:
     - "Loaded activePlanId from localStorage: X"
     - "Fetched N plans from server: [...]"
     - "Setting activePlanId: X" or "Stale activePlanId detected..."

## Implementation Plan

**Phase 1: Stop the Bleeding (Fixes critical slowness)**
1. Implement smart retry logic in `queryClient.ts`
2. Add stale plan ID validation in `useSyncActivePlan()`
3. Add `syncCompleted` checks to `useLoadPlan()` and `usePlanWorkouts()`
4. Update Home.tsx to pass sync status to hooks
5. Test with stale plan ID scenario

**Phase 2: Add Observability (Prevent future issues)**
1. Add logging to store initialization
2. Add logging to plan sync flow
3. Add logging to plan data loading
4. Test logging output format
5. Document log patterns for common issues

**Expected Performance Improvement:**
- Current: 15+ seconds to load with stale plan ID (8s retries + 7s waiting)
- After Phase 1: 1-2 seconds to load (no retries, immediate validation)
- Improvement: 85-90% faster load time

**Expected Investigation Improvement:**
- Current: Need to add debug code and redeploy to understand issues
- After Phase 2: Console logs show exact issue (stale ID, missing plan, etc.) immediately

## Risk Assessment

**Low Risk Changes:**
- Smart retry logic: Isolated to query client configuration, only affects error cases
- Logging: Read-only, no behavior changes

**Medium Risk Changes:**
- Plan ID sync logic: Affects when data fetches occur
- Mitigation: Add comprehensive logging to track state transitions
- Fallback: If sync fails, user sees loading skeleton (existing behavior)
- User can always manually select plan from plans list

**Testing Focus:**
- Verify no regressions in normal flow (fresh user with valid active plan)
- Test edge cases: deleted plans, no plans, multiple plans, stale IDs
- Test network conditions: slow 3G, offline, intermittent errors
- Test retry behavior: permanent errors vs transient errors