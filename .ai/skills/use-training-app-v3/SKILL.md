---
name: use-training-app-v3
description: Interact with the training app — manage plans, exercises, workouts, progress, activity logs. Prefer MCP tools (training-app server, `mcp__training-app__*`). Fall back to `@training-app/sdk` when writing standalone scripts.
title: Use Training App v3
summary: Claude Code integration for training-app-v3. Primary: MCP tools served by `training-app` (auto-loaded via .mcp.json) — 36 typed tools covering plans/exercises/workouts/progress/activity. Secondary: `@training-app/sdk` npm package for standalone Node scripts. Both wrap the server's bearer-token + X-On-Behalf-Of auth path.
priority: 3
key_points:
  - In Claude Code sessions, use MCP tools (mcp__training-app__*) — no code required
  - For standalone scripts, import from @training-app/sdk
  - All calls act as the env-configured user (LOCAL_USER_ID / TRAINING_APP_USER_ID)
  - MCP tool errors include structured ValidationError/ApiError/NetworkError/ResponseError
  - Admin APIs require the configured user to equal ADMIN_USER_ID
  - Never log or echo the admin token
---
# Use Training App v3

Two ways to do anything a logged-in user can do — reads, writes, deletes — depending on who's driving:

1. **Claude Code agent** → use the `training-app` MCP tools (auto-loaded from `.mcp.json`).
2. **Standalone Node script** → import from `@training-app/sdk`.

Both paths end up at the same server and obey the same auth model.

## Using the MCP tools (preferred in Claude Code)

The repo registers the `training-app` MCP server in `.mcp.json`. Claude Code launches it on session start. Every SDK method is exposed as a tool named `mcp__training-app__<tool>` (exact prefix depends on your Claude Code version — check `/mcp`).

Key tools (full list: run `/mcp`):

| Domain | Tools |
|---|---|
| plans | `list_plans`, `get_plan`, `create_plan`, `update_plan`, `delete_plan`, `set_active_plan`, `duplicate_plan` |
| exercise definitions | `list_exercise_definitions`, `get_exercise_definition`, `create_exercise_definition`, `update_exercise_definition`, `delete_exercise_definition`, `list_muscle_groups` |
| plan exercises | `list_plan_exercises`, `add_plan_exercise`, `bulk_add_plan_exercises`, `update_plan_exercise`, `delete_plan_exercise`, `reorder_plan_exercises` |
| plan workouts | `list_plan_workouts`, `create_plan_workout`, `update_plan_workout`, `delete_plan_workout`, `reorder_plan_workouts` |
| weekly progress | `get_week_progress`, `update_sets`, `get_exercise_notes`, `update_exercise_note` |
| activity logs | `get_activity`, `get_activity_summary`, `get_exercise_history`, `add_activity`, `edit_activity`, `delete_activity`, `bulk_delete_activity`, `duplicate_activity` |
| escape hatch | `call_api` — any `/api/process/*` endpoint by name |

**Example prompt flow**:
> *"add a 3×5 deadlift to my active plan"*
>
> Claude picks `list_plans` → finds the active one → `list_exercise_definitions` → finds Deadlift → `add_plan_exercise`. No code written.

**Tool errors** are structured text with `isError: true`:
- `ValidationError` — bad args. Re-read the tool's inputSchema; don't retry with the same args.
- `ApiError` — server rejected. Branch on `errorCode` (`PLAN_NOT_FOUND`, `FORBIDDEN`, `VALIDATION`, `SERVER_ERROR`, …).
- `NetworkError` — transport issue. Retry may help; `(timeout)` suffix means the request was aborted.
- `ResponseError` — server response didn't match the envelope. Don't retry; investigate.

If `/mcp` shows `training-app` as disconnected: check that `packages/training-app-mcp/dist/server.js` exists (`cd packages/training-app-mcp && npm install && npm run build`) and that `ADMIN_API_TOKEN`, `LOCAL_USER_ID`, `TRAINING_APP_URL` are set in the shell that started Claude Code.

## Using the SDK (standalone scripts)

When you're *writing* an agent (not when an agent runs inside Claude Code), import the SDK directly:

```ts
import { createClient } from '@training-app/sdk';

const client = createClient({
  baseUrl: process.env.TRAINING_APP_URL!,
  adminToken: process.env.TRAINING_APP_TOKEN!,
  userId: process.env.TRAINING_APP_USER_ID!,
});

const { plans } = await client.plans.list();
```

Domains available: `plans`, `exerciseDefinitions`, `planExercises`, `planWorkouts`, `weeklyProgress`, `activityLogs`, plus `call<T>(apiName, params)`.

## When to use

- The user asks you to inspect or modify their training data: plans, exercises, workouts, progress, reports.
- The user references `@training-app/sdk`, `/use-training-app-v3`, `ADMIN_API_TOKEN`, or `X-On-Behalf-Of`.

## Setup

Three env vars on the caller:

| Var | What |
|---|---|
| `TRAINING_APP_URL` | Deployed base URL, e.g. `https://training.vercel.app` |
| `TRAINING_APP_TOKEN` | `ADMIN_API_TOKEN` from the app's Vercel env |
| `TRAINING_APP_USER_ID` | MongoDB `_id` of the user to act as |

Install the SDK (local path until published):

```bash
npm install /absolute/path/to/training-app-v3/packages/training-app-sdk
```

## Basic usage

```ts
import { createClient } from '@training-app/sdk';

const client = createClient({
  baseUrl: process.env.TRAINING_APP_URL!,
  adminToken: process.env.TRAINING_APP_TOKEN!,
  userId: process.env.TRAINING_APP_USER_ID!,
  timeoutMs: 15_000, // optional; default 30_000
});

const { plans } = await client.plans.list();
```

## API surface

Domains with typed wrappers (full reference in the package README):

- `client.plans` — `list`, `get`, `create`, `update`, `delete`, `setActive`, `duplicate`
- `client.exerciseDefinitions` — `list`, `get`, `create`, `update`, `delete`, `muscleGroups`
- `client.planExercises` — `list`, `add`, `bulkAdd`, `update`, `delete`, `reorder`
- `client.planWorkouts` — `list`, `create`, `update`, `delete`, `reorder`
- `client.weeklyProgress` — `getWeek`, `updateSets`, `getExerciseNotes`, `updateExerciseNote`
- `client.activityLogs` — `get`, `summary`, `exerciseHistory`, `add`, `edit`, `delete`, `bulkDelete`, `duplicate`

Everything else goes through `client.call<T>(apiName, params)`. Look up names in the app's `src/apis/**/index.ts`:

- `plan-data/*` — denormalized plan tree
- `workout-warmup/*` — warmup generation
- `chat/*`
- `auth/me` — sanity check: confirms you're authenticated as the right user

## SDK error handling

Every failure throws a subclass of `TrainingAppError`. **Always branch on `instanceof`** — don't rely on string matching.

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
    // Bad input. Fix the call site. Do not retry.
    // e.field (e.g. "planId"), e.reason ("must be a non-empty string")
  } else if (e instanceof TrainingAppApiError) {
    // Server rejected. Branch on e.errorCode:
    //   'PLAN_NOT_FOUND'  -> item gone; tell user
    //   'FORBIDDEN'       -> wrong userId or admin-only API
    //   'UNAUTHORIZED'    -> token/userId wrong
    //   'VALIDATION'      -> server param validation (distinct from local)
    //   'SERVER_ERROR'    -> uncaught server error; retry then escalate
  } else if (e instanceof TrainingAppNetworkError) {
    // Transport failure. Retry with backoff. e.isTimeout=true → timeout.
  } else if (e instanceof TrainingAppResponseError) {
    // Non-envelope response. Usually version skew. Don't retry; investigate.
  } else {
    throw e;
  }
}
```

## Worked example — add an exercise to the active plan

```ts
const { plans } = await client.plans.list();
const active = plans?.find(p => p.active);
if (!active) throw new Error('user has no active plan');

const { exercises } = await client.exerciseDefinitions.list();
const deadlift = exercises?.find(e => e.name === 'Deadlift');
if (!deadlift) throw new Error('Deadlift not in library');

await client.planExercises.add({
  planId: active._id,
  exerciseDefId: deadlift._id,
  sets: 3,
  reps: 5,
});
```

## Pitfalls

- **All responses are HTTP 200.** Server encodes errors in the body; the SDK throws — you don't have to check `.error` yourself unless you want to treat a specific soft failure as a non-throw.
- **No optimistic semantics server-side.** The app's UI client does optimistic updates; server responses are authoritative.
- **Offline queue doesn't apply.** You're a server-to-server caller; mutations return real responses, not `{}`.
- **`userId` is the MongoDB `_id`, not `username`.** Wrong id → calls silently act on the wrong account.
- **Never log the admin token.** Don't echo `process.env.TRAINING_APP_TOKEN` in outputs, error messages, or commits.
- **Bearer header wins over cookies.** If both are sent, the bearer path is taken.
- **Validation errors are local.** `TrainingAppValidationError` means your code passed something wrong (e.g. `planId: ""`). `TrainingAppApiError` with `errorCode: 'VALIDATION'` means the server rejected the call. Don't conflate them.
- **`weeklyProgress.updateSets` with `complete-all` requires `targetSets`.** Omitting it throws `TrainingAppValidationError` locally before the request.
- **`planExercises.bulkAdd` can partially succeed.** Inspect `results[i].error` per item — a `results` array with some errors does NOT cause the call to throw.

## Adding a new typed domain

See the package README's "Extending the SDK" section. TL;DR:

1. Look up API names in `src/apis/project/<domain>/index.ts`.
2. Add types to `packages/training-app-sdk/src/types.ts`.
3. Add `packages/training-app-sdk/src/<domain>.ts` following `plans.ts` (one function returning `{ method: (input) => callApi(opts, 'api/name', input) }`, with `assert*` validators first).
4. Register it in `src/index.ts`.
5. `yarn build`.
