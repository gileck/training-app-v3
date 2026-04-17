# Skill files

Canonical skill documents that describe how agents should use the training-app MCP server.

**`use-training-app-v3/SKILL.md`** is the source of truth. Copy it verbatim into any consumer.

## Consumers

- **This repo** — `.ai/skills/use-training-app-v3/SKILL.md` is a symlink to this canonical.
- **NanoClaw** — `container/skills/use-training-app-v3/SKILL.md` is a flat copy, synced via `scripts/sync-skill.sh`.
- **Any other project using `@training-app/mcp`** — copy into its agent's skills directory.

## Sync the skill into a consumer

```bash
# from training-app-v3 repo
packages/training-app-mcp/scripts/sync-skill.sh /path/to/consumer/skills-root
# e.g.
packages/training-app-mcp/scripts/sync-skill.sh ~/Projects/nanoclaw/container/skills
```

The script overwrites `<skills-root>/use-training-app-v3/SKILL.md` from this canonical. Run it whenever `SKILL.md` changes.

---

# End-to-end dev → prod flow

When you change anything that the bot depends on (server API, SDK, MCP tool, or the skill itself), you need to move the change through several places before it lands in a running WhatsApp/Telegram/etc. bot. Follow the steps below **in order** — each depends on the previous.

The flow covers four "surfaces":

| Surface | Where it lives | How changes land |
|---|---|---|
| **Server API** | `src/apis/**` in this repo | `git push` → Vercel auto-deploys |
| **SDK** | `packages/training-app-sdk/` | rebuilt locally, consumed by MCP |
| **MCP server** | `packages/training-app-mcp/` | bundled to a single file, copied into consumers |
| **Skill** | `packages/training-app-mcp/skills/use-training-app-v3/SKILL.md` | copied into consumers via `sync-skill.sh` |

## 1. Server change (new API, gate change, etc.)

```bash
# edit src/apis/**
yarn checks                           # typecheck + lint + knip — must pass
git add -A && git commit -m "..."
git push                              # Vercel auto-deploys to prod
```

Wait for Vercel to finish (typically 1–3 min). Confirm with `npx tsx scripts/template/vercel-cli.ts list` — the newest entry should be `✓ Ready`.

**Why first:** the SDK / MCP will call this API. If the server isn't deployed, callers get `UNKNOWN_API` or `FORBIDDEN` even though the local code looks right.

## 2. SDK change

```bash
cd packages/training-app-sdk
../../node_modules/.bin/tsc -p tsconfig.json     # build dist/
```

The MCP depends on the SDK via `file:../training-app-sdk`. After rebuilding the SDK, **force a reinstall in the MCP** so its `node_modules/@training-app/sdk` is fresh (npm's file-dep cache can hold an old copy):

```bash
cd packages/training-app-mcp
rm -rf node_modules/@training-app/sdk
npm install --no-audit --no-fund
```

## 3. MCP change (new tool, schema, dispatcher)

```bash
cd packages/training-app-mcp
../../node_modules/.bin/tsc -p tsconfig.json --noEmit    # sanity typecheck
npx -y esbuild@latest src/server.ts \
  --bundle --platform=node --format=esm --target=node20 \
  --outfile=dist/server.bundle.mjs
```

The bundle (`dist/server.bundle.mjs`) is the single file consumers ship. It inlines the MCP SDK and the training-app SDK — no install required at the consumer.

**Local verification (optional but recommended):**
```bash
set -a; source ../../.env; source ../../.env.local; set +a
export TRAINING_APP_URL=https://training-app-v3.vercel.app
export TRAINING_APP_TOKEN="$ADMIN_API_TOKEN"
export TRAINING_APP_USER_ID="$LOCAL_USER_ID"
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_plans","arguments":{}}}' \
| node dist/server.bundle.mjs
```
Expect a JSON-RPC response with `result.content[].text` containing plan data, and `isError` absent/false.

## 4. Copy the bundle + skill into consumers

For each consumer (e.g. NanoClaw):

```bash
# Bundle
cp packages/training-app-mcp/dist/server.bundle.mjs \
   /path/to/consumer/<wherever>/training-app-mcp.bundle.mjs

# Skill
packages/training-app-mcp/scripts/sync-skill.sh \
   /path/to/consumer/<skills-root>
```

NanoClaw specifically:
```bash
cp packages/training-app-mcp/dist/server.bundle.mjs \
   ~/Projects/nanoclaw/container/training-app-mcp.bundle.mjs

packages/training-app-mcp/scripts/sync-skill.sh \
   ~/Projects/nanoclaw/container/skills
```

## 5. Rebuild / reload the consumer

**NanoClaw** (stdio MCP baked into the agent container image):

```bash
cd ~/Projects/nanoclaw
# On a Wix / corporate network, pass the private registry:
NPM_REGISTRY=https://npm.dev.wixpress.com/ ./container/build.sh
# otherwise just:
./container/build.sh
```

No service restart is needed — NanoClaw spawns a fresh container from `nanoclaw-agent:latest` for each inbound message, so the next message picks up the new image.

A service restart (`launchctl kickstart -k "gui/$(id -u)/com.nanoclaw"`) is only needed when the orchestrator source (`nanoclaw/src/`) itself changed — e.g. the `container-runner.ts` env passthrough list or similar. The compiled orchestrator runs from `nanoclaw/dist/index.js`, so after editing orchestrator source you must also `cd ~/Projects/nanoclaw && npm run build` before the restart.

**Claude Code** (the `.mcp.json` server config in the host repo):

Usually no rebuild — Claude Code re-launches the server when you restart the session. If you changed the bundle path or env vars in `.mcp.json`, run `/mcp reconnect training-app` or restart Claude Code.

## 6. Verify the bot picked up the change

In WhatsApp (or wherever the consumer runs):

> *"list users"*          → should return the list (added in step 1).
> *"list plans for gileck"* → bot calls `list_users`, finds gileck, then `list_plans` with that id.

If the bot says a tool doesn't exist, the consumer is still on the old bundle — step 4 or 5 was missed. If the tool exists but returns `FORBIDDEN` / `UNKNOWN_API`, the server deploy (step 1) didn't land — re-check Vercel and the prod deployment log.

## Common slip-ups

- **Forgot to rebuild the SDK before bundling.** The MCP bundle pulls from `packages/training-app-mcp/node_modules/@training-app/sdk/dist/…`. If you edited the SDK but didn't `tsc` it, the stale dist is what ends up in the bundle. Always rebuild SDK → reinstall in MCP → bundle (step 2 → step 3).
- **Copied the bundle but didn't rebuild the container.** The consumer image is cached; the bundle outside the image is ignored until the image is rebuilt (step 5).
- **Pushed the server change but didn't wait for Vercel.** Prod still serves the old API for 1–3 min after push. If you test immediately you'll see stale errors.
- **Env vars not set on the consumer.** The MCP server exits silently if `TRAINING_APP_URL`, `TRAINING_APP_TOKEN`, or `TRAINING_APP_USER_ID` is missing — the tool just appears as "disconnected" from the agent's view. In NanoClaw, check `~/Projects/nanoclaw/.env`.
