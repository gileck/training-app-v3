---
name: use-training-app-v3
description: Manage the user's training app — training plans, exercises, workouts, weekly progress, activity logs. Invoke whenever the user asks about their training plan, workouts, sets, reps, exercises, or progress. Use the mcp__training-app__* tools when available; when writing standalone scripts, use @training-app/sdk. DO NOT write curl/fetch code.
title: Use Training App v3
summary: Programmatic access to training-app-v3 via the `training-app` MCP server (37 tools) or the `@training-app/sdk` Node package. Both wrap the server's bearer-token + X-On-Behalf-Of auth; pass an optional `userId` to act as any user. Use `list_users` to resolve a username to an id.
priority: 3
allowed-tools: mcp__training-app__*
key_points:
  - In any MCP-aware agent (Claude Code, NanoClaw container), use mcp__training-app__* tools — no code required
  - For standalone Node scripts, `import { createClient } from '@training-app/sdk'`
  - All calls default to the env-configured user; pass `userId` to target someone else
  - Resolve username → id with `list_users` before calling other tools
  - Never invent a userId; only use one the human typed or one you looked up
  - Never log or echo the admin token
---
# Use Training App v3

Two ways to do anything a logged-in user can do in the training app — reads, writes, deletes:

1. **MCP-aware agent (Claude Code, NanoClaw, Claude Agent SDK)** → use the `training-app` MCP tools.
2. **Standalone Node script** → `import { createClient } from '@training-app/sdk'`.

Both paths end up at the same server and obey the same auth model. Auth is handled automatically at the transport layer — you never see, need, or pass credentials.

## Tools (MCP)

Every tool accepts an optional top-level `userId` argument (see [Acting on behalf of a specific user](#acting-on-behalf-of-a-specific-user)).

### Plans
- `list_plans` — every plan the user owns
- `get_plan({ planId })`
- `create_plan({ name, durationWeeks })`
- `update_plan({ planId, name?, durationWeeks? })`
- `delete_plan({ planId })` — ⚠ cascades
- `set_active_plan({ planId })`
- `duplicate_plan({ planId })`

### Exercise definitions (library)
- `list_exercise_definitions({ includeCustom? })`
- `get_exercise_definition({ exerciseId })`
- `create_exercise_definition({ name, primaryMuscle, … })`
- `update_exercise_definition({ exerciseId, … })` / `delete_exercise_definition({ exerciseId })` — custom only
- `list_muscle_groups`

### Plan exercises
- `list_plan_exercises({ planId })`
- `add_plan_exercise({ planId, exerciseDefId, sets, reps, … })`
- `bulk_add_plan_exercises({ planId, exercises[] })` — partial success possible, check `results[i].error`
- `update_plan_exercise({ planExerciseId, … })`
- `delete_plan_exercise({ planExerciseId })`
- `reorder_plan_exercises({ planId, exerciseIds[] })`

### Plan workouts (named groupings like "Push Day")
- `list_plan_workouts({ planId })`
- `create_plan_workout({ planId, name, items[] })` / `update` / `delete` / `reorder`

### Weekly progress
- `get_week_progress({ planId, weekNumber })`
- `update_sets({ planId, planExerciseId, weekNumber, action, targetSets? })` — action ∈ {add, remove, complete-all}
- `get_exercise_notes` / `update_exercise_note`

### Activity logs
- `get_activity` / `get_activity_summary` / `get_exercise_history`
- `add_activity` / `edit_activity` / `delete_activity` / `bulk_delete_activity` / `duplicate_activity`

### Users (for name → id resolution)
- `list_users` — every user with `id`, `username`, `email`, `isAdmin`

### Escape hatch
- `call_api({ apiName, params })` — any `/api/process/*` endpoint by name.

## Acting on behalf of a specific user

Every tool (except `list_users` and `call_api`) accepts an optional top-level `userId` argument.

**If the human gives a user id** (24-char hex):
- *"my user id is 65f0abc… — list my plan"* → `list_plans` with `{ userId: "65f0abc…" }`
- *"list plans for user 123def…"* → `list_plans` with `{ userId: "123def…" }`

**If the human gives a username** (e.g. "gileck", "sarah"):
1. Call `list_users` (no args) — returns `{ users: [{ id, username, email, … }] }`.
2. Find the entry whose `username` matches (case-insensitive). If more than one near-match, ask the human which.
3. Call the original tool with `{ userId: <matched id> }`.

**If the human says "my" / doesn't name anyone**: omit `userId` → the MCP server uses its configured default user.

**Never invent a userId.** Either use an id the human typed, or resolve a name via `list_users`. Don't make up values.

## Typical flows

**"What's in my plan?"**
1. `list_plans` → pick the `isActive: true` plan (or if the human gave a name, run `list_users` first and pass the matched id to `list_plans`)
2. `list_plan_exercises({ planId })`
3. Summarize: name, sets×reps, muscle group (from `exerciseDef`)

**"Add a 3×5 deadlift to my plan"**
1. `list_plans` → find active planId
2. `list_exercise_definitions` → find the Deadlift entry
3. `add_plan_exercise({ planId, exerciseDefId, sets: 3, reps: 5 })`

**"Mark week 2 bench press complete"**
1. `get_week_progress({ planId, weekNumber: 2 })` → find the bench-press row, read `targetSets`
2. `update_sets({ planId, planExerciseId, weekNumber: 2, action: 'complete-all', targetSets })`

**"List plans for sarah"**
1. `list_users` → find user with `username === 'sarah'`
2. `list_plans({ userId: <sarah's id> })`

## SDK usage (standalone scripts)

```ts
import { createClient } from '@training-app/sdk';

const client = createClient({
  baseUrl: process.env.TRAINING_APP_URL!,
  adminToken: process.env.TRAINING_APP_TOKEN!,
  userId: process.env.TRAINING_APP_USER_ID!,
  timeoutMs: 15_000, // optional; default 30_000
});

// Default user
const { plans } = await client.plans.list();

// Another user by id
const otherPlans = await client.asUser('65f0…').plans.list();

// Resolve a name to an id
const { users } = await client.admin.users.list();
const sarah = users!.find(u => u.username === 'sarah');
if (sarah) {
  const sarahPlans = await client.asUser(sarah.id).plans.list();
}
```

Domains available: `plans`, `exerciseDefinitions`, `planExercises`, `planWorkouts`, `weeklyProgress`, `activityLogs`, `admin`, plus `call<T>(apiName, params)` and `asUser(userId)`.

## Setup (for agents / scripts that use this)

Three env vars on the caller:

| Var | What |
|---|---|
| `TRAINING_APP_URL` | Deployed base URL, e.g. `https://training-app-v3.vercel.app` |
| `TRAINING_APP_TOKEN` | `ADMIN_API_TOKEN` from the app's Vercel env |
| `TRAINING_APP_USER_ID` | MongoDB `_id` of the default user |

SDK install (local path until published):
```bash
npm install /absolute/path/to/training-app-v3/packages/training-app-sdk
```

MCP server: configure in `.mcp.json` (Claude Code) or the Agent SDK's `mcpServers` option. See `packages/training-app-mcp/README.md`.

## Error handling

Tool responses include `isError: true` when things fail. The text content is structured:

- `ValidationError` — bad args. Re-read the tool's inputSchema; don't retry with identical args.
- `ApiError` — server rejected. Branch on `errorCode`:
  - `PLAN_NOT_FOUND` — item gone; tell the human.
  - `FORBIDDEN` — admin-only or wrong user. Don't retry.
  - `UNAUTHORIZED` / `INVALID_TOKEN` — token/userId wrong.
  - `VALIDATION` — server param validation.
  - `SERVER_ERROR` — transient; one retry is fine, then escalate.
- `NetworkError` — transport failure; retry may help. `(timeout)` suffix means the call exceeded the configured timeout.
- `ResponseError` — malformed response; don't retry, report to the human.

SDK equivalent: throws `TrainingAppValidationError` / `TrainingAppApiError` / `TrainingAppNetworkError` / `TrainingAppResponseError`. Always branch on `instanceof`.

## Pitfalls

- **All timestamps are ISO-8601 strings.** Convert human time ("this week") with today's date; don't guess timezones.
- **`weekNumber` is 1-based.**
- **`update_sets` with `action: 'complete-all'`** silently misbehaves without `targetSets`. Always pass it — read from `get_week_progress` first.
- **`bulk_add_plan_exercises`** can partially succeed. A partially-failing call is NOT surfaced as `isError: true`. Inspect `failedCount` and `results[i].error`.
- **No optimistic semantics server-side.** The response is authoritative.
- **Write actions are irreversible.** For `delete_plan`, `bulk_delete_activity`, etc., confirm with the human if intent is ambiguous.
- **userId is a MongoDB `_id`, not a username.** Always resolve names via `list_users`.

## If the tools aren't available

If `mcp__training-app__*` tools aren't present, the MCP server isn't connected. Tell the human: "the training-app MCP isn't available — check that `TRAINING_APP_URL`, `TRAINING_APP_TOKEN`, and `TRAINING_APP_USER_ID` are set and the MCP server is registered in your agent's config." Fall back to `@training-app/sdk` only if you can run Node code.
