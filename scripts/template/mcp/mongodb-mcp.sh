#!/usr/bin/env bash
# Launches the official MongoDB MCP server (mongodb-js/mongodb-mcp-server) bound
# to this project's MONGO_URI from .env.local and dbName from src/app.config.js.
# Read-only by default so agents can inspect data without risk of writes.
# Atlas Admin tools disabled.
#
# Wired into .mcp.json and .cursor/mcp.json; not meant to be invoked manually.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

if [ -f "$REPO_ROOT/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_ROOT/.env.local"
  set +a
fi

if [ -z "${MONGO_URI:-}" ]; then
  echo "mongodb-mcp: MONGO_URI not set (looked in $REPO_ROOT/.env.local and process env)" >&2
  exit 1
fi

# Splice appConfig.dbName from src/app.config.js into the URI path so the MCP
# server defaults to this project's database. Source of truth stays in the
# config file (same one src/server/database/connection.ts reads).
MDB_MCP_CONNECTION_STRING=$(MONGO_URI="$MONGO_URI" REPO_ROOT="$REPO_ROOT" node --input-type=module -e '
const cfg = await import(process.env.REPO_ROOT + "/src/app.config.js");
const dbName = cfg.appConfig.dbName;
if (!dbName) { console.error("mongodb-mcp: appConfig.dbName missing"); process.exit(1); }
const m = process.env.MONGO_URI.match(/^(mongodb(\+srv)?:\/\/[^/?]+)(\/[^?]*)?(\?.*)?$/);
if (!m) { console.error("mongodb-mcp: could not parse MONGO_URI"); process.exit(1); }
process.stdout.write(m[1] + "/" + dbName + (m[4] || ""));
' 2>/dev/null)

if [ -z "$MDB_MCP_CONNECTION_STRING" ]; then
  echo "mongodb-mcp: failed to build connection string from MONGO_URI + app.config.js" >&2
  exit 1
fi

export MDB_MCP_CONNECTION_STRING

exec npx -y mongodb-mcp-server --readOnly --disabledTools atlas
