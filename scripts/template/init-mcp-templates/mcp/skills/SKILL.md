---
name: use-__NAME__
description: Manage __NAME__ programmatically — call APIs, resolve users, act on behalf of any user. Invoke whenever the human asks to read or modify __NAME__ data. Use the mcp__NAME__* tools when available; for standalone Node scripts, use @__NAME__/sdk. DO NOT write curl/fetch code.
title: Use __NAME__
summary: Programmatic access to __NAME__ via the `__NAME__` MCP server or the `@__NAME__/sdk` Node package. Both wrap bearer-token + X-On-Behalf-Of auth; pass an optional `userId` to act as any user. Use `list_users` to resolve a username to an id.
priority: 3
allowed-tools: mcp____NAME_____*
key_points:
  - In any MCP-aware agent (Claude Code, Claude Agent SDK, NanoClaw container), use mcp____NAME_____* tools — no code required
  - For standalone Node scripts, `import { createClient } from '@__NAME__/sdk'`
  - All calls default to the env-configured user; pass `userId` to target someone else
  - Resolve username → id with `list_users` before calling other tools
  - Never invent a userId; only use one the human typed or one you looked up
  - Never log or echo the admin token
---
# Use __NAME__

Two ways to do anything a logged-in user can do in __NAME__:

1. **MCP-aware agent** (Claude Code, Claude Agent SDK, NanoClaw) → use the `__NAME__` MCP tools.
2. **Standalone Node script** → `import { createClient } from '@__NAME__/sdk'`.

Both paths end up at the same server and share the same auth model. Auth is handled at the transport layer — you never see, need, or pass credentials.

## Auth model

- **Token**: the server's `ADMIN_API_TOKEN` env var. Injected by the MCP server / provided to `createClient`. Treat a leak as rotate-and-redeploy.
- **On-behalf-of**: every call carries an `X-On-Behalf-Of: <userId>` header. The server treats the request as if that user made it.
- **Default user**: set via `__UPPER___USER_ID` (MCP) / `userId` option (SDK).
- **Per-call override**: pass `userId` on any tool (MCP) or use `client.asUser(userId)` (SDK).

## Acting on behalf of a specific user

**If the human gives a user id** (24-char hex) → pass it as `userId`:
> "list plans for user 65f0abc…" → call the tool with `{ userId: "65f0abc…" }`.

**If the human gives a username** ("gileck", "sarah"):
1. Call `list_users` — returns `[{ id, username, … }]` for every user.
2. Find the id matching the typed username.
3. Call the real tool with that id as `userId`.

Never invent a userId. Only use one the human gave you or one `list_users` returned.

## Error taxonomy (SDK)

- `__PASCAL__ValidationError` — bad arguments. Fix the call site; retry won't help.
- `__PASCAL__ApiError` — server rejected the call. Read `err.errorCode`.
- `__PASCAL__NetworkError` — transport failed (DNS, abort/timeout). Retry may help.
- `__PASCAL__ResponseError` — server response didn't match the envelope. Version skew.

MCP tools surface the same taxonomy as structured error text.

## Tools (MCP)

- `ping` — sanity check; confirms reachability + auth.
- `list_users` — `[{ id, username, email, isAdmin }]` for every user.
- `call_api({ apiName, params })` — escape hatch; call any `/api/process/*`.

_Replace this section with domain-specific tools as you add them to `src/tools.ts`._

## Setup

Set these env vars on the MCP client side (e.g. `.mcp.json`):
- `__UPPER___URL` — base URL of the deployed app
- `__UPPER___TOKEN` — ADMIN_API_TOKEN
- `__UPPER___USER_ID` — default user id
