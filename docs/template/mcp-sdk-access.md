---
title: MCP / SDK Programmatic Access
description: Give agents and scripts typed, authenticated access to every app endpoint via a bearer-token + X-On-Behalf-Of pattern.
summary: "Bake programmatic access into any child project: `ADMIN_API_TOKEN` + `X-On-Behalf-Of` lets a Node SDK or MCP server act as any user. Run `yarn init:mcp` to scaffold `packages/<name>-sdk/` and `packages/<name>-mcp/`."
priority: 4
related_docs:
  - admin.md
  - authentication.md
---

# MCP / SDK Programmatic Access

Template-provided pattern for letting agents and standalone scripts hit any `/api/process/*` endpoint as any user. The server half is baked in; the client half (SDK + MCP) is scaffolded on demand via `yarn init:mcp`.

This doc is both a walkthrough (§[Step-by-step](#step-by-step-create-a-new-mcp--skill)) and a reference (everything after it). If this is your first time, read top to bottom.

## What you're building

Three artifacts, living under `packages/<name>-*/` in your project:

| Artifact | Purpose | Who consumes it |
| --- | --- | --- |
| `@<name>/sdk` | Typed Node client. `createClient({...}).orders.list()` | Standalone scripts, server-side code, tests, the MCP server |
| `@<name>/mcp` | stdio MCP server exposing SDK methods as LLM tools | Claude Code, Claude Agent SDK, NanoClaw/other containers |
| `skills/use-<name>/SKILL.md` | Agent-facing instructions: when/how to call the tools | MCP-aware agents that auto-load skills |

All three share the same auth model and the same generator — you never copy files between them by hand.

## Auth model

Two parts cooperate:

1. **Server**: `getUserContext.ts` recognises `Authorization: Bearer <ADMIN_API_TOKEN>` + `X-On-Behalf-Of: <userId>`. When both are present and the token matches (constant-time compare), the request is treated as coming from `<userId>`. `authDebug.tokenAuth = true` is stamped on the context.
2. **Admin gate**: `processApiCall.ts` accepts `admin/*` calls when either `isAdmin` is true OR `authDebug.tokenAuth === true`. Anyone holding the token can therefore call `admin/users/list` to resolve usernames to ids — this is the canonical way for agents to translate "list plans for sarah" into a concrete user id.

**Security caveat:** `ADMIN_API_TOKEN` is god-mode. It can act on behalf of *any* user and reach *all* `admin/*` endpoints. Rotate on every suspected leak; never commit it; never log or echo it in agent output.

## Server-side (already in template)

No action required in a child project — these ship with the template:

| File | Role |
| --- | --- |
| `src/apis/getUserContext.ts` | Bearer + on-behalf-of auth path |
| `src/apis/processApiCall.ts` | Admin gate with `tokenAuth` bypass |
| `src/apis/template/auth/types.ts` | `AuthDebugInfo.tokenAuth?: boolean` |
| `src/apis/template/admin-users/` | `admin/users/list` endpoint |
| `src/server/database/collections/template/users/users.ts` | `listAllUsers()` |

---

## Step-by-step: create a new MCP + skill

Follow in order. Each step is ~1 minute unless noted.

### 0. Prereqs

- A working child project (already synced from the template).
- Node ≥ 18 and `yarn` on PATH.
- MongoDB reachable from the dev server (you already need this for the app).
- At least one user in the users collection — `LOCAL_USER_ID` from `.env.local` works.

### 1. Generate a token

```bash
openssl rand -hex 32
```

Copy the output.

### 2. Install the token for local dev

```bash
echo "ADMIN_API_TOKEN=<paste-the-hex>" >> .env.local
```

Restart `yarn dev` if it's running, so the new env var is picked up.

### 3. Scaffold the packages

```bash
yarn init:mcp              # uses your app name from src/app.config.js
# or
yarn init:mcp my-cool-app  # explicit name; becomes the package prefix
```

You now have:

```
packages/
  <name>-sdk/
    package.json              # @<name>/sdk
    src/
      index.ts                # createClient() factory
      http.ts                 # callApi() + ClientOptions
      errors.ts               # <Pascal>Error hierarchy
      validation.ts           # assertNonEmptyString, etc.
      admin.ts                # client.admin.users.list()
      ping.ts                 # starter domain — delete once you add real ones
  <name>-mcp/
    package.json              # @<name>/mcp
    src/
      server.ts               # JSON-RPC over stdio
      tools.ts                # TOOLS[] — starter: ping, list_users, call_api
    skills/use-<name>/
      SKILL.md                # agent guidance (MCP + SDK paths)
```

The generator also updated `.gitignore` (`packages/**/node_modules`, `packages/**/dist`) and `tsconfig.json` (`exclude: packages/**`).

### 4. Install deps and build both packages

```bash
cd packages/<name>-sdk && yarn install && yarn build
cd ../<name>-mcp && yarn install && yarn build
cd ../..
```

### 5. Smoke-test the MCP server manually

From the project root:

```bash
ADMIN_API_TOKEN=<same-hex> \
  <UPPER>_URL=http://localhost:3000 \
  <UPPER>_TOKEN=<same-hex> \
  <UPPER>_USER_ID=<a-real-user-id-from-your-db> \
  node packages/<name>-mcp/dist/server.js <<<'{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Replace `<UPPER>` with the SCREAMING_SNAKE version of your name (e.g. `my-cool-app` → `MY_COOL_APP`). You should see a JSON response with the three starter tools. If you get `missing required env var`, you forgot one of the three.

To actually call a tool:

```bash
ADMIN_API_TOKEN=... <UPPER>_URL=... <UPPER>_TOKEN=... <UPPER>_USER_ID=... \
  node packages/<name>-mcp/dist/server.js <<<'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ping"}}'
```

`ping` hits `auth/me` on the server. A successful response confirms auth is wired up end-to-end.

### 6. Register the MCP with a client

Pick one of the three — see §[Registering with MCP clients](#registering-with-mcp-clients) for the full matrix. For a first pass, use Claude Code project-level:

```jsonc
// .mcp.json at project root
{
  "mcpServers": {
    "<name>": {
      "command": "node",
      "args": ["packages/<name>-mcp/dist/server.js"],
      "env": {
        "<UPPER>_URL": "http://localhost:3000",
        "<UPPER>_TOKEN": "${ADMIN_API_TOKEN}",
        "<UPPER>_USER_ID": "${LOCAL_USER_ID}"
      }
    }
  }
}
```

Restart Claude Code. `mcp__<name>__ping` should now be callable.

### 7. Add a real typed domain

The starter `ping` + `list_users` + `call_api` prove the pattern works. Now wrap a real domain — see §[Adding a typed domain](#adding-a-typed-domain).

### 8. Write the skill

The scaffold dropped a starter `SKILL.md`, but it's generic. Tailor it to your domain — see §[Writing the skill](#writing-the-skill).

### 9. Deploy

```bash
# Install the token in every env
yarn vercel-cli env:push ADMIN_API_TOKEN

# For container consumers (NanoClaw, Agent SDK in a VM), bundle:
cd packages/<name>-mcp
npx esbuild src/server.ts --bundle --platform=node --format=esm --target=node20 \
  --outfile=dist/server.bundle.mjs
```

See §[Bundling for container consumers](#bundling-for-container-consumers) for the full flow.

---

## Adding a typed domain

Each domain is a small function in `packages/<name>-sdk/src/` that returns methods wrapping `callApi`:

```ts
// packages/<name>-sdk/src/orders.ts
import { callApi, ClientOptions } from './http';
import { assertNonEmptyString } from './validation';

export interface Order { id: string; total: number }

export function ordersDomain(opts: ClientOptions) {
  return {
    list: () => callApi<{ orders: Order[] }>(opts, 'orders/list'),
    get: (id: string) => {
      assertNonEmptyString(id, 'id');
      return callApi<Order>(opts, 'orders/get', { id });
    },
  };
}
```

Register it in `src/index.ts`:

```ts
import { ordersDomain } from './orders';
// ... inside createClient ...
return {
  ping: pingDomain(opts),
  admin: adminDomain(opts),
  orders: ordersDomain(opts),   // <-- new
  asUser: (userId: string) => { /* unchanged */ },
  call: (apiName, params) => callApi(opts, apiName, params),
};
```

And update the `__PASCAL__Client` interface in the same file to include `orders: ReturnType<typeof ordersDomain>`.

Add the matching MCP tool in `packages/<name>-mcp/src/tools.ts`:

```ts
{
  name: 'list_orders',
  description: 'List orders for the (on-behalf-of) user.',
  inputSchema: { type: 'object', properties: {}, required: [] },
  handler: (c) => c.orders.list(),
},
{
  name: 'get_order',
  description: 'Fetch a single order by id.',
  inputSchema: {
    type: 'object',
    properties: { id: str('Order _id') },
    required: ['id'],
  },
  handler: (c, a) => c.orders.get(a.id as string),
},
```

Rebuild both packages (`yarn build`) and restart the MCP client.

**Naming convention for tool names:** `snake_case`, verb-first: `list_orders`, `get_order`, `create_order`, `update_order`, `delete_order`. Agents rely on this convention to guess tool names when they aren't sure.

**Do NOT add `userId` to individual tool schemas.** The dispatcher in `server.ts` auto-adds it as an optional top-level arg on every tool. Adding it per-tool double-declares it and confuses the LLM.

---

## Writing the skill

The scaffold drops `packages/<name>-mcp/skills/use-<name>/SKILL.md` with a generic template. The better you tailor it, the more reliably agents will use your tools.

### Frontmatter

Keep both formats in the frontmatter — one skill doc, two consumers:

```yaml
---
name: use-<name>                              # skill id (lowercase, hyphenated)
description: One sentence, imperative, ...    # Claude Code uses this to decide when to load
title: Use <Name>                             # Display title
summary: One paragraph — what this gives you  # Shown in skill index
priority: 3                                    # 1=critical, 5=reference
allowed-tools: mcp__<name>__*                  # Agent SDK containers use this to gate access
key_points:
  - Short, imperative bullets
  - "Never invent a userId; only use one the human typed or you looked up"
---
```

`description` is what Claude Code reads to decide whether to auto-load the skill. Write it as a trigger — "manage the user's orders", "control the music player" — not as a description ("This skill provides...").

`allowed-tools` is how Agent SDK containers scope tool access; keep the `mcp__<name>__*` wildcard unless you want to restrict.

### Body sections that actually help agents

- **Auth model** (1 paragraph): "pass `userId` to act as someone else, omit to use the default".
- **Tool catalog** (grouped by domain): name + 1-line purpose. Agents scan this to find candidates.
- **Acting on behalf of a specific user**: the flow for "human types a username" — `list_users` → find id → use id. Explicit examples.
- **Error taxonomy**: four error kinds, what each means, whether retry helps. Prevents agents from looping on validation errors.
- **Worked examples**: 2–3 real user requests mapped to tool call sequences.

### Things NOT to include

- Source code (the tools are self-describing via JSON schema).
- API internals (handler implementation, DB schema).
- The admin token. Ever.

### Sync the skill to consumers

If you're embedding the MCP in a container that has its own skills directory:

```bash
cp -R packages/<name>-mcp/skills/use-<name> path/to/container/skills/
```

Or automate with a tiny `packages/<name>-mcp/scripts/sync-skill.sh` that `rsync`s on rebuild.

---

## Registering with MCP clients

All three clients launch the same binary (`node packages/<name>-mcp/dist/server.js`) with the same three env vars. What differs is where you put the config.

### Claude Code — project scope

`./.mcp.json` at your repo root. Committed to git so the whole team picks it up:

```jsonc
{
  "mcpServers": {
    "<name>": {
      "command": "node",
      "args": ["packages/<name>-mcp/dist/server.js"],
      "env": {
        "<UPPER>_URL": "http://localhost:3000",
        "<UPPER>_TOKEN": "${ADMIN_API_TOKEN}",
        "<UPPER>_USER_ID": "${LOCAL_USER_ID}"
      }
    }
  }
}
```

`${VAR}` expansion reads from your shell env / `.env.local`.

### Claude Code — user scope

`~/.claude/mcp.json`. Useful when pointing Claude Code at a deployed app from outside the repo:

```jsonc
{
  "mcpServers": {
    "<name>-prod": {
      "command": "node",
      "args": ["/abs/path/to/packages/<name>-mcp/dist/server.js"],
      "env": {
        "<UPPER>_URL": "https://<name>.example.com",
        "<UPPER>_TOKEN": "${<NAME>_PROD_TOKEN}",
        "<UPPER>_USER_ID": "<your-user-id>"
      }
    }
  }
}
```

### Claude Agent SDK

In your agent runner:

```ts
import { query } from '@anthropic-ai/claude-agent-sdk';

const response = query({
  prompt: 'List my orders',
  options: {
    mcpServers: {
      '<name>': {
        command: 'node',
        args: ['packages/<name>-mcp/dist/server.js'],
        env: {
          '<UPPER>_URL': process.env.APP_URL!,
          '<UPPER>_TOKEN': process.env.ADMIN_API_TOKEN!,
          '<UPPER>_USER_ID': userId,
        },
      },
    },
    allowedTools: ['mcp__<name>__*'],
  },
});
```

### Container consumers (NanoClaw, serverless agents)

Containers usually can't run `yarn install`. Ship the bundled single-file server — see §[Bundling for container consumers](#bundling-for-container-consumers). Mount or copy `dist/server.bundle.mjs` into the container and point the consumer at it.

---

## Bundling for container consumers

```bash
cd packages/<name>-mcp
npx esbuild src/server.ts --bundle --platform=node --format=esm --target=node20 \
  --outfile=dist/server.bundle.mjs
```

The bundle inlines `@<name>/sdk` and `@modelcontextprotocol/sdk` — the container only needs Node ≥ 20 and the three env vars.

Hook it into `package.json` for convenience:

```jsonc
"scripts": {
  "bundle": "esbuild src/server.ts --bundle --platform=node --format=esm --target=node20 --outfile=dist/server.bundle.mjs"
}
```

Then: `yarn bundle` whenever you change SDK or tools.

---

## Use from a Node script (no MCP)

The SDK works standalone:

```ts
import { createClient } from '@<name>/sdk';

const client = createClient({
  baseUrl: 'https://<name>.example.com',
  adminToken: process.env.<UPPER>_TOKEN!,
  userId: '65f0abc...',
});

const me = await client.ping.me();          // default user
const users = await client.admin.users.list();
const other = client.asUser('65f1def...');  // scoped copy
await other.call('auth/me');                 // escape hatch for untyped endpoints
```

`asUser` returns a new client with a different `X-On-Behalf-Of`; the original is unchanged. Use this for scripts that iterate over users.

---

## Keeping scaffolds on template sync

`packages/` is **project-owned** — `sync-template` leaves it alone. You can fork the generated code freely:
- Add domains, rename error classes, delete `ping.ts` once you have real domains.
- Keep multiple MCPs side-by-side (`packages/foo-mcp/`, `packages/foo-admin-mcp/`).
- Write your own MCP packages from scratch without using the generator at all — sync-template won't overwrite them.

Template-side improvements to the *scaffold* itself (new starter files, tightened error classes) land in `scripts/template/init-mcp-templates/` and propagate on the next template sync; existing `packages/` contents are untouched. Re-running `yarn init:mcp` is **idempotent** — it only writes files that don't exist yet, so it's safe to re-run to pick up new starter files without clobbering customizations.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `401 Unauthorized` from MCP tool | `ADMIN_API_TOKEN` on server ≠ `<UPPER>_TOKEN` in MCP env. Verify with `vercel env ls`. |
| `403 Forbidden` on `admin/*` | Token correct but `tokenAuth` was not set — check that the bearer path in `getUserContext.ts` runs before the dev shortcut. |
| `missing_on_behalf_of` tokenError | MCP client isn't sending `<UPPER>_USER_ID`. Check the `env` block in `.mcp.json`. |
| `admin_token_not_configured` tokenError | `ADMIN_API_TOKEN` missing on the server. `.env.local` (dev) / Vercel env (prod). |
| MCP starts but returns empty tool list | `tools.ts` `TOOLS` array is empty — add at least `ping`. |
| Tool returns `NetworkError (timeout)` | `<UPPER>_URL` points at a slow or unreachable host. Default timeout 30s; override with `<UPPER>_TIMEOUT_MS`. |
| Tool returns `ResponseError` about envelope | Client talking to a non-`processApiCall` endpoint (raw Next.js route, HTML error page). Check `apiName` and that the server is running that version. |
| `Cannot find module '@<name>/sdk'` at MCP start | You built the MCP without installing SDK deps first. Run `yarn install && yarn build` in the SDK package, then rebuild the MCP. |
| Tool count jumps after re-running `init:mcp` | Re-running the generator with new starter files in the template. Safe — it skips existing files; you're only seeing the template's additions. |
