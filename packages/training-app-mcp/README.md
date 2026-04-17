# @training-app/mcp

MCP server that exposes the training-app SDK as tools for Claude Code (and any other MCP-compatible client).

Each SDK method is wrapped as a tool the LLM can call directly — no code-writing required. The server reads `TRAINING_APP_URL`, `TRAINING_APP_TOKEN`, and `TRAINING_APP_USER_ID` from env and forwards calls to the training app via the bearer-token auth path.

## Tools

36 typed tools covering the full SDK surface, plus an escape hatch:

| Domain | Tools |
|---|---|
| `plans` | `list_plans`, `get_plan`, `create_plan`, `update_plan`, `delete_plan`, `set_active_plan`, `duplicate_plan` |
| `exercise_definitions` | `list_exercise_definitions`, `get_exercise_definition`, `create_exercise_definition`, `update_exercise_definition`, `delete_exercise_definition`, `list_muscle_groups` |
| `plan_exercises` | `list_plan_exercises`, `add_plan_exercise`, `bulk_add_plan_exercises`, `update_plan_exercise`, `delete_plan_exercise`, `reorder_plan_exercises` |
| `plan_workouts` | `list_plan_workouts`, `create_plan_workout`, `update_plan_workout`, `delete_plan_workout`, `reorder_plan_workouts` |
| `weekly_progress` | `get_week_progress`, `update_sets`, `get_exercise_notes`, `update_exercise_note` |
| `activity_logs` | `get_activity`, `get_activity_summary`, `get_exercise_history`, `add_activity`, `edit_activity`, `delete_activity`, `bulk_delete_activity`, `duplicate_activity` |
| escape hatch | `call_api` — call any `/api/process/*` endpoint by name |

## Build

```bash
cd packages/training-app-sdk && yarn build   # build the SDK first
cd ../training-app-mcp && npm install && npm run build
```

## Use with Claude Code

The repo's `.mcp.json` already registers this server under `training-app`. Claude Code reads `.mcp.json` on session start and launches the server.

Required env vars (in the shell that starts Claude Code, or set in `.mcp.json` directly):

```bash
export TRAINING_APP_URL=https://training.vercel.app
export ADMIN_API_TOKEN=<from Vercel env>
export LOCAL_USER_ID=<your Mongo user _id>
```

Verify it loaded:

```
/mcp         # Claude Code slash command — lists connected MCP servers
```

You should see `training-app` with 36 tools.

Then just ask — *"list my training plans"*, *"add a 3×5 deadlift to my active plan"*, *"mark week 2 complete"* — Claude Code picks the right tool(s).

## Use with other MCP clients

Standard stdio transport. Any MCP client works:

```bash
TRAINING_APP_URL=... TRAINING_APP_TOKEN=... TRAINING_APP_USER_ID=... \
  node packages/training-app-mcp/dist/server.js
```

Inspect tools with the MCP inspector:

```bash
npx @modelcontextprotocol/inspector \
  node packages/training-app-mcp/dist/server.js
```

## Error handling

Errors from the SDK are serialized as structured text in the tool response's `content`, with `isError: true`. The LLM sees:

- `ValidationError` — bad tool arguments. Don't retry.
- `ApiError` — server rejected. Includes `errorCode` (e.g. `FORBIDDEN`, `PLAN_NOT_FOUND`).
- `NetworkError` — transport failure. Retry may help.
- `ResponseError` — malformed response (version skew).

## Adding a new tool

1. Add a new typed method in the SDK (`packages/training-app-sdk/src/...`) and rebuild.
2. Add an entry to the `TOOLS` array in `src/tools.ts` with name, description, JSON schema, and a handler that forwards to the SDK method.
3. `npm run build`.
4. Restart Claude Code (or `/mcp reconnect training-app`).
