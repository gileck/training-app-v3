# @training-app/sdk

Programmatic access to the training app. An agent or script can do anything a logged-in user can do: manage plans, exercises, workouts, weekly progress, activity logs.

- **Typed**: every domain method has request/response types. Server is the source of truth — types track that shape.
- **Validated**: inputs are checked before each request, so mistakes fail locally with a clear message instead of producing cryptic server errors.
- **Safe-by-default**: per-request timeouts, network vs API vs response errors split across distinct classes.

---

## Contents

- [Auth model](#auth-model)
- [Install](#install)
- [Quick start](#quick-start)
- [Client options](#client-options)
- [Domain API reference](#domain-api-reference)
- [Escape hatch: `client.call()`](#escape-hatch-clientcall)
- [Error handling](#error-handling)
- [Examples](#examples)
- [Extending the SDK](#extending-the-sdk)

---

## Auth model

Two headers on every request:

- `Authorization: Bearer <ADMIN_API_TOKEN>` — shared secret configured in the server's Vercel env.
- `X-On-Behalf-Of: <userId>` — MongoDB `_id` of the user the call should act as.

If the bearer token matches, the server treats the request as that user. Admin-only APIs (`admin/*`) still require the on-behalf-of user to equal `ADMIN_USER_ID`.

> ⚠️ `ADMIN_API_TOKEN` grants access to every user. Treat a leak as a rotate-and-redeploy incident.

## Install

Build locally (no publish pipeline yet):

```bash
cd packages/training-app-sdk
yarn build   # outputs dist/
```

Then from another project:

```bash
npm install /path/to/training-app-v3/packages/training-app-sdk
```

## Quick start

```ts
import { createClient, TrainingAppApiError } from '@training-app/sdk';

const client = createClient({
  baseUrl: process.env.TRAINING_APP_URL!,       // e.g. https://training.vercel.app
  adminToken: process.env.TRAINING_APP_TOKEN!,  // ADMIN_API_TOKEN
  userId: process.env.TRAINING_APP_USER_ID!,    // MongoDB _id
});

const { plans } = await client.plans.list();
console.log(plans);
```

## Client options

| Option | Required | Default | What |
|---|---|---|---|
| `baseUrl` | yes | — | Deployed base URL. Trailing slash is optional. |
| `adminToken` | yes | — | `ADMIN_API_TOKEN` from the server's env. |
| `userId` | yes | — | MongoDB `_id` of the user to act as. |
| `timeoutMs` | no | `30_000` | Per-request timeout. `0` disables. Exceeds → `TrainingAppNetworkError` with `isTimeout: true`. |
| `fetch` | no | global `fetch` | Inject a custom fetch (tests, polyfilled envs). |

## Domain API reference

Every method validates its arguments before making a request. Every response is the server's raw payload — **not** wrapped in `CacheResult`. Errors throw (see [Error handling](#error-handling)); you don't have to check `.error` yourself unless you want to distinguish domain-level soft failures.

### `client.plans`

| Method | Description |
|---|---|
| `list()` | List every plan for the calling user. |
| `get(planId)` | Fetch a single plan. |
| `create({ name, durationWeeks, _id? })` | Create a new plan. `durationWeeks` must be > 0. |
| `update({ planId, name?, durationWeeks? })` | Update fields on a plan. |
| `delete(planId)` | Permanently delete a plan and everything under it. |
| `setActive(planId)` | Mark this plan as the user's active plan. |
| `duplicate(planId)` | Copy a plan (exercises + workouts included). |

### `client.exerciseDefinitions`

| Method | Description |
|---|---|
| `list({ includeCustom? })` | List the catalog. Includes user custom exercises by default. |
| `get(exerciseId)` | Fetch one exercise definition. |
| `create({ name, primaryMuscle, … })` | Create a custom exercise for the user. |
| `update({ exerciseId, … })` | Update a custom exercise. Built-ins are read-only. |
| `delete(exerciseId)` | Delete a custom exercise. Built-ins are read-only. |
| `muscleGroups()` | List canonical muscle group names. |

### `client.planExercises`

| Method | Description |
|---|---|
| `list(planId)` | List plan exercises with resolved definitions. |
| `add({ planId, exerciseDefId, sets, reps, … })` | Add one exercise to a plan. |
| `bulkAdd({ planId, exercises })` | Add many in one call. Partial success reported in `results[i]`. |
| `update({ planExerciseId, … })` | Update an exercise on a plan. |
| `delete(planExerciseId)` | Remove an exercise from a plan. |
| `reorder({ planId, exerciseIds })` | Reorder. `exerciseIds` must cover every plan exercise. |

### `client.planWorkouts`

| Method | Description |
|---|---|
| `list(planId)` | List workouts in a plan. |
| `create({ planId, name, items })` | Create a workout. `items[].planExerciseId` must exist on the plan. |
| `update({ planId, workoutId, … })` | Update a workout. |
| `delete(planId, workoutId)` | Delete a workout. Plan exercises are unaffected. |
| `reorder(planId, workoutIds)` | Reorder workouts within a plan. |

### `client.weeklyProgress`

| Method | Description |
|---|---|
| `getWeek({ planId, weekNumber })` | Per-exercise completion for a week. |
| `updateSets({ planId, planExerciseId, weekNumber, action, targetSets? })` | `action ∈ { 'add', 'remove', 'complete-all' }`. `targetSets` required for `'complete-all'`. |
| `getExerciseNotes(planId, planExerciseId, weekNumber)` | Read the free-form note for that (exercise, week) pair. |
| `updateExerciseNote({ …, note })` | Upsert the note. Empty string clears it. |

### `client.activityLogs`

| Method | Description |
|---|---|
| `get({ planId?, from?, to? })` | Fetch log entries, optionally narrowed. |
| `summary({ planId?, from?, to? })` | Aggregated totals + per-exercise breakdown. |
| `exerciseHistory(planExerciseId)` | History for one exercise. |
| `add({ planId, planExerciseId, … })` | Record an activity event. |
| `edit({ activityId, … })` | Edit an entry. |
| `delete(activityId)` | Delete one entry. |
| `bulkDelete(activityIds)` | Delete many. |
| `duplicate(activityId)` | Duplicate an entry. |

## Escape hatch: `client.call()`

Any API without a typed wrapper is reachable via `client.call<T>(apiName, params)`. Look up names in `src/apis/**/index.ts` in the main repo.

```ts
// auth/me — sanity check you're authenticated as the expected user
const me = await client.call<{ user?: { id: string; username: string } }>('auth/me');

// plan-data/get — fetch the full denormalized plan tree
const tree = await client.call('plan-data/get', { planId });
```

`call` still throws the same error classes. It does **not** run input validation.

## Error handling

Every failure throws a subclass of `TrainingAppError`. Branch on `instanceof`:

| Class | When | Key fields | Retry? |
|---|---|---|---|
| `TrainingAppValidationError` | You passed bad input (wrong type, missing id). Thrown *before* the network call. | `field`, `reason` | No — fix the call site. |
| `TrainingAppApiError` | Server returned `{ error, errorCode }`. Your call reached the server and was refused. | `apiName`, `errorCode` | Depends on `errorCode`. |
| `TrainingAppNetworkError` | Transport failure (DNS, reset, TLS) or request aborted by our timeout. | `apiName`, `isTimeout`, `cause` | Usually yes, with backoff. |
| `TrainingAppResponseError` | Server replied with something other than the expected JSON envelope. Likely version skew. | `apiName`, `status` | No — investigate. |

```ts
import {
  TrainingAppApiError,
  TrainingAppNetworkError,
  TrainingAppResponseError,
  TrainingAppValidationError,
} from '@training-app/sdk';

try {
  await client.plans.get(planId);
} catch (e) {
  if (e instanceof TrainingAppValidationError) {
    console.error(`bad arg ${e.field}: ${e.reason}`);
  } else if (e instanceof TrainingAppApiError) {
    if (e.errorCode === 'PLAN_NOT_FOUND') console.warn('plan was deleted?');
    else if (e.errorCode === 'FORBIDDEN') console.error('wrong userId for this call');
    else throw e;
  } else if (e instanceof TrainingAppNetworkError) {
    if (e.isTimeout) console.warn('timed out — will retry');
    else console.error('network error:', e.cause);
  } else if (e instanceof TrainingAppResponseError) {
    console.error('server returned unexpected shape:', e.status);
  } else {
    throw e;
  }
}
```

### Known `errorCode` values

Not exhaustive — the server can add new ones. The SDK types `errorCode` as a string union with a `(string & {})` fallback so autocomplete works without closing the set.

- `UNKNOWN_API` — the `apiName` wasn't registered. Typo on your side.
- `FORBIDDEN` — the `X-On-Behalf-Of` user isn't allowed for this API (e.g. `admin/*` without being the admin).
- `UNAUTHORIZED` / `INVALID_TOKEN` — bearer token missing or wrong, or `X-On-Behalf-Of` missing.
- `VALIDATION` — server rejected the params.
- `PLAN_NOT_FOUND` — the planId doesn't exist or isn't owned by the user.
- `SERVER_ERROR` — uncaught server exception. Retry; if it persists, check server logs.
- `DRAFT_MISMATCH` / `AI_INVALID_OUTPUT` / `AI_UNCLEAR_INPUT` — AI-plan-generation specific.

## Examples

### Add an exercise to the user's active plan

```ts
const { plans } = await client.plans.list();
const active = plans!.find(p => p.active);
if (!active) throw new Error('user has no active plan');

const { exercises } = await client.exerciseDefinitions.list();
const deadlift = exercises!.find(e => e.name === 'Deadlift');
if (!deadlift) throw new Error('Deadlift not in library');

const { exercise } = await client.planExercises.add({
  planId: active._id,
  exerciseDefId: deadlift._id,
  sets: 3,
  reps: 5,
  weight: 100,
});
console.log('added', exercise?._id);
```

### Mark all remaining sets complete for week 2

```ts
const { exercises } = await client.weeklyProgress.getWeek({ planId, weekNumber: 2 });
await Promise.all(
  (exercises ?? [])
    .filter(e => !e.isDone)
    .map(e =>
      client.weeklyProgress.updateSets({
        planId,
        planExerciseId: e.planExerciseId,
        weekNumber: 2,
        action: 'complete-all',
        targetSets: e.targetSets,
      }),
    ),
);
```

### Retry on timeout with exponential backoff

```ts
import { TrainingAppNetworkError } from '@training-app/sdk';

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!(e instanceof TrainingAppNetworkError)) throw e;
      await new Promise(r => setTimeout(r, 200 * 2 ** i));
    }
  }
  throw lastErr;
}

const { plans } = await withRetry(() => client.plans.list());
```

## Extending the SDK

To add a domain that isn't wrapped yet:

1. Look up API names in `src/apis/<domain>/index.ts` (main repo).
2. Copy relevant request/response interfaces into `src/types.ts`. Keep them loose at first — unknown fields on the server are harmless.
3. Add `src/<domain>.ts` following the `plans.ts` pattern:
   - One function `<domain>Domain(opts: ClientOptions)` returning an object of methods.
   - Each method runs `assert*` validators, then calls `callApi<ResponseType>(opts, 'api/name', input)`.
   - Add a one-line JSDoc for each method.
4. Register in `src/index.ts` under `createClient`.
5. `yarn build`.
