# Bug Fix: Extremely slow loading of the app

## Root Cause Analysis

**The Bug:** The app takes an extremely long time to load initially, showing slow login modal, then slow plan loading, followed by "Plan not found" errors before finally loading the plan.

**Root Causes Identified:**

1. **208KB Exercise Definitions Payload (Primary Issue)**
   - The `exercise-definitions/list` API returns 208KB of data containing ALL exercises
   - This takes ~1.5 seconds to download on mobile network (from logs: 1486ms)
   - This API is called unconditionally on app load in multiple places
   - Location: `src/apis/exercise-definitions/handlers/listExercises.ts`
   - The handler returns the ENTIRE exercise library including all fields (name, imageUrl, primaryMuscle, secondaryMuscles, type, isBodyweight, isStatic, etc.)

2. **Race Condition with Plan Loading**
   - The Home component tries to load plan data before the active plan ID is properly resolved
   - Sequence from logs:
     - 09:09:07: Request plan-workouts/list for plan ID `69595f259c7f329fccd06bc3`
     - 09:09:11: Error "Plan not found" (4 seconds later)
     - Multiple retries all fail with same error
     - 09:09:25: Finally succeeds with different plan ID `694a4983067f2aea033f4ec0`
   - Location: `src/client/routes/project/Home/Home.tsx` - calls `useLoadPlan` before plan ID is stable

3. **Server-Side Caching Disabled**
   - Server-side cache is explicitly disabled in `src/apis/processApiCall.ts` line 63: `disableCache: true`
   - This means every API call hits the database even for read-heavy endpoints like exercise-definitions/list
   - Comment says "React Query handles client-side caching" but client cache isn't helping on first load

4. **Client Cache Not Effective for Initial Load**
   - React Query staleTime default is 30 seconds (user configurable)
   - On first app load with empty cache, all data must be fetched fresh
   - The 208KB exercise payload is fetched even though most users only need a small subset

## Scope Assessment

**Similar Patterns Found:**

1. **Large payload APIs without pagination:**
   - `exercise-definitions/list` (208KB) - MAIN CULPRIT
   - No other APIs show similar massive payloads in the logs

2. **Plan loading race conditions:**
   - `src/client/routes/project/Home/Home.tsx` - loads plan before ID is stable
   - `src/client/routes/project/TrainingPlans/components/CreatePlanWithAiDialog.tsx` - calls useExerciseLibrary unconditionally
   - `src/client/routes/project/ManagePlan/ManagePlan.tsx` - also uses useExerciseLibrary

3. **Server cache disabled everywhere:**
   - All API handlers inherit the `disableCache: true` setting from `processApiCall.ts`

## Fix Approach

### Primary Fixes (Root Cause)

**Fix 1: Enable Server-Side Caching for Read-Heavy Endpoints**

The server-side cache infrastructure exists but is disabled. Enable it for specific read-heavy endpoints:

- **File:** `src/apis/exercise-definitions/server.ts`
  - Add cache configuration with 1-hour TTL for exercise-definitions/list
  - Exercise definitions rarely change, perfect candidate for caching
  
- **File:** `src/apis/training-plans/server.ts`
  - Add cache configuration with 5-minute TTL for training-plans/get
  
- **File:** `src/apis/plan-workouts/server.ts`
  - Add cache configuration with 5-minute TTL for plan-workouts/list

- **File:** `src/apis/processApiCall.ts`
  - Modify to check if handler specifies cache config
  - Only disable cache if handler explicitly opts out
  - Change from blanket `disableCache: true` to respecting handler-level cache settings

**Fix 2: Optimize Exercise Definitions Payload**

Reduce the 208KB payload by implementing field selection:

- **File:** `src/apis/exercise-definitions/types.ts`
  - Add optional `fields` parameter to ListExercisesRequest
  - Define field presets: 'minimal' (id, name), 'standard' (+ muscles, type), 'full' (all fields)

- **File:** `src/apis/exercise-definitions/handlers/listExercises.ts`
  - Implement field filtering based on request parameter
  - Default to 'standard' fields (excludes imageUrl which is often large)

- **File:** `src/apis/exercise-definitions/client.ts`
  - Update client to request minimal fields where appropriate

**Fix 3: Fix Plan Loading Race Condition**

Ensure plan data loads only after active plan ID is resolved:

- **File:** `src/client/routes/project/Home/Home.tsx`
  - Add guard: only call `useLoadPlan` when `activePlanId` is truthy and `plansLoading` is false
  - Change from: `useLoadPlan(activePlanId, currentWeek)`
  - Change to: `useLoadPlan(activePlanId && !plansLoading ? activePlanId : null, currentWeek)`

- **File:** `src/client/features/project/plan-data/hooks.ts` (useLoadPlan)
  - Add early return if planId is null
  - Strengthen the condition: `if (!planId || planId === 'null') return { isLoading: false };`

**Fix 4: Lazy Load Exercise Library**

Don't load the full exercise library until needed:

- **File:** `src/client/routes/project/ManagePlan/hooks.ts`
  - useExerciseLibrary should default to `enabled: false`
  - Only enable when user opens "Add Exercise" dialog

- **File:** `src/client/routes/project/TrainingPlans/components/CreatePlanWithAiDialog.tsx`
  - Change `useExerciseLibrary()` to `useExerciseLibrary({ enabled: false })`
  - Enable only when user is in the exercise resolver step

### Secondary Improvements (Observability)

**Improvement 1: Add Performance Logging**

- **File:** `src/client/utils/apiClient.ts`
  - Add warning log when response size exceeds 50KB
  - Log: "Large API response detected: {apiName} returned {size}KB in {duration}ms"

**Improvement 2: Better Error Messages**

- **File:** `src/apis/training-plans/handlers/getPlan.ts`
  - Change error message from "Plan not found" to "Plan not found: {planId} (user: {userId})"
  - Helps debugging which plan ID is being requested

## Files to Modify

**Server-Side Caching (Priority 1):**

- `src/apis/exercise-definitions/server.ts`
  - Add handler config: `{ process: listExercises, cacheConfig: { ttl: 3600 } }` (1 hour)
  
- `src/apis/training-plans/server.ts`
  - Add handler config: `{ process: getPlan, cacheConfig: { ttl: 300 } }` (5 minutes)
  
- `src/apis/plan-workouts/server.ts`
  - Add handler config: `{ process: listPlanWorkouts, cacheConfig: { ttl: 300 } }` (5 minutes)

- `src/apis/processApiCall.ts`
  - Modify cache logic to respect handler-level cache configs
  - Change from: `{ disableCache: true }` to: `{ disableCache: !apiHandler.cacheConfig }`
  - Pass TTL from handler config: `{ disableCache: !apiHandler.cacheConfig, ttl: apiHandler.cacheConfig?.ttl }`

**Exercise Definitions Optimization (Priority 2):**

- `src/apis/exercise-definitions/types.ts`
  - Add to ListExercisesRequest: `fields?: 'minimal' | 'standard' | 'full'`
  
- `src/apis/exercise-definitions/handlers/listExercises.ts`
  - Add field filtering logic after fetching exercises
  - Implement field selection based on request.fields parameter

- `src/apis/exercise-definitions/client.ts`
  - No changes needed (callers can optionally pass fields parameter)

**Race Condition Fix (Priority 3):**

- `src/client/routes/project/Home/Home.tsx`
  - Line 64: Change `useLoadPlan(activePlanId, currentWeek)` 
  - To: `useLoadPlan(!plansLoading && activePlanId ? activePlanId : null, currentWeek)`

- `src/client/features/project/plan-data/hooks.ts`
  - Line 42-46: Add null check at the start of useLoadPlan
  - Add: `if (!planId) return { isLoading: false };` before other logic

**Lazy Loading (Priority 4):**

- `src/client/routes/project/ManagePlan/hooks.ts`
  - Line 79: Change signature to `useExerciseLibrary(options?: { enabled?: boolean })`
  - Make enabled default to false in certain contexts (document the behavior)

- `src/client/routes/project/TrainingPlans/components/CreatePlanWithAiDialog.tsx`
  - Line 76: Change from `useExerciseLibrary()` to `useExerciseLibrary({ enabled: step === 'preview' })`
  - Only load when user reaches preview/resolver step

**Logging & Observability (Priority 5):**

- `src/client/utils/apiClient.ts`
  - In the `call` method after line 121, add size check and warning
  - Add: `if (JSON.stringify(data).length > 50000) console.warn(...)`

- `src/apis/training-plans/handlers/getPlan.ts`
  - Line 21: Change error message to include context
  - From: `return { error: 'Plan not found' };`
  - To: `return { error: \`Plan not found: ${request.planId} (user: ${context.userId})\` };`

## Testing Strategy

**Test Scenario 1: Server Cache Effectiveness**
1. Clear all caches
2. Load app and time the exercise-definitions/list call
3. Refresh page and verify second load uses server cache (should be <50ms)
4. Verify response has `isFromCache: true` indicator

**Test Scenario 2: Race Condition Fix**
1. Clear localStorage and all caches
2. Log in with fresh account
3. Navigate to Home route
4. Verify NO "Plan not found" errors in console/logs
5. Verify plan loads on first attempt without retries

**Test Scenario 3: Lazy Loading**
1. Navigate to ManagePlan route
2. Verify exercise library is NOT loaded initially
3. Click "Add Exercise" button
4. Verify exercise library loads only at that point

**Test Scenario 4: Field Filtering**
1. Call exercise-definitions/list with `fields: 'minimal'`
2. Verify response size is significantly smaller (<20KB)
3. Verify only id and name fields are present

**Test Scenario 5: Overall Performance**
1. Clear all caches
2. Measure time from login to Home route fully loaded
3. Target: <2 seconds on 4G connection (down from current ~8-10 seconds)

## Risk Assessment

**Low Risk Changes:**
- Server-side caching for read-only endpoints (can be disabled if issues arise)
- Logging improvements
- Race condition guards (defensive checks)

**Medium Risk Changes:**
- Field filtering for exercise definitions (ensure backward compatibility)
- Lazy loading exercise library (ensure all use cases still work)

**Mitigation:**
- Feature flag for server-side cache (can disable via config if issues)
- Gradual rollout: enable caching for one endpoint at a time
- Keep field filtering optional (default to 'full' if not specified)
- Monitor error rates after deployment

## Implementation Priority

**Phase 1 (High Impact, Low Risk):**
1. Enable server-side caching for exercise-definitions/list
2. Fix race condition in Home.tsx

**Phase 2 (Medium Impact, Low Risk):**
3. Enable server-side caching for training-plans/get and plan-workouts/list
4. Add performance logging

**Phase 3 (High Impact, Medium Risk):**
5. Implement field filtering for exercise definitions
6. Implement lazy loading for exercise library

## Expected Performance Improvement

**Current State:**
- Initial load: ~8-10 seconds (based on logs showing multiple API calls spanning 18+ seconds)
- Exercise library: 208KB, 1486ms download time
- Multiple "Plan not found" retries adding 3-4 seconds

**After Fixes:**
- Initial load: ~2-3 seconds
  - Server cache: exercise library loads in <50ms after first request
  - Race condition fixed: no retries, plan loads in first attempt
  - Lazy loading: exercise library not loaded until needed
- Subsequent loads: <1 second (everything from cache)

**Breakdown:**
- Server cache: Saves ~1400ms on exercise library load
- Race condition fix: Saves ~4000ms of failed retries
- Lazy loading: Saves ~1500ms on routes that don't need exercise library
- Total improvement: ~6-7 seconds on first load, 10x improvement on subsequent loads