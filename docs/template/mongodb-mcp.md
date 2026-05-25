---
title: MongoDB MCP Server
description: How agents read this project's MongoDB through the official mongodb-mcp-server. Use this when you need to inspect collections, run queries, or check schema state from inside an agent session.
summary: "Agents have read-only MongoDB access via the official mongodb-js/mongodb-mcp-server, wired in `.mcp.json` (Claude Code) and `.cursor/mcp.json` (Cursor). Launched per session by `scripts/template/mcp/mongodb-mcp.sh`, which sources `MONGO_URI` from `.env.local`, splices `appConfig.dbName` from `src/app.config.js` into the URI path, and runs the server with `--readOnly --disabledTools atlas`. Every tool call requires an explicit `database` arg — use `appConfig.dbName` (read it from `src/app.config.js`). Writes are intentionally blocked."
priority: 3
related_docs:
  - mongodb-usage.md
  - project-guidelines/mongodb-usage.md
---

# MongoDB MCP Server

Agents working on this project (and any child project synced from the template) get read-only MongoDB access through the official [mongodb-js/mongodb-mcp-server](https://github.com/mongodb-js/mongodb-mcp-server).

## How it's wired

| File | Role |
|---|---|
| `.mcp.json` | Claude Code project-scope MCP config |
| `.cursor/mcp.json` | Cursor MCP config (same server entry) |
| `scripts/template/mcp/mongodb-mcp.sh` | Launcher — sources `.env.local`, splices `appConfig.dbName` from `src/app.config.js` into the URI, execs `npx -y mongodb-mcp-server --readOnly --disabledTools atlas` |

All three are template-owned and sync to child projects. Each child supplies its own `MONGO_URI` in its own `.env.local` and its own `appConfig.dbName` in its own `src/app.config.js` — no per-project edits to the MCP wrapper.

## Database name on tool calls

The mongodb-mcp-server requires `database` as an explicit argument on every data tool (`find`, `count`, `list-collections`, `aggregate`, …). It does **not** infer the database from the connection URI even when one is specified.

**Always pass the project's database name**, which lives in `src/app.config.js` as `appConfig.dbName`. In this repo it's `app_template_db`; in a child project it will be whatever that child set. If you're unsure, open `src/app.config.js` first.

## Defaults and why

- **`--readOnly`**: agents on the same cluster can't trash each other's data. Writes go through the application or a deliberately-run script, not through an agent's MCP call.
- **`--disabledTools atlas`**: this project doesn't use Atlas Admin API. Fewer tools = smaller prompt-injection blast radius.
- **stdio transport**: per-session local subprocess. Nothing to keep running, nothing to expose on the network.
- **`MONGO_URI` from `.env.local`**: the same variable the Next.js app reads, so MCP always points at the same database the app sees.

## Using it as an agent

Once configured, the `mongodb` server appears in Claude Code's available MCP servers. Typical reads:

- List collections / inspect documents to verify a schema-evolution change before writing a migration.
- Confirm a workflow item's actual stored state when debugging a status-transition bug.
- Sanity-check a query before writing the server-side code that runs it.

When you need writes (seed data, migrations, fixing a stuck record), run a script with `MONGO_URI` instead — do not loosen the `--readOnly` default. If a class of agent task truly needs writes, add a second MCP entry (e.g. `mongodb-write`) with explicit naming so it's never invoked by mistake.

## Troubleshooting

- **`MONGO_URI not set`**: check `.env.local` exists at the repo root and defines `MONGO_URI`.
- **MCP server can't connect**: verify the URI works from the app first (`yarn dev` and look for DB errors). MCP doesn't introduce new network constraints — if the app can connect, the server can.
- **Slow cold start**: `npx -y` resolves the package on first launch. Run `npx -y mongodb-mcp-server --version` once to warm the cache, or install it as a dev dependency.
