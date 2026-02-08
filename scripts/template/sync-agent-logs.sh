#!/bin/bash
#
# Sync Agent Logs from agents-copy to current repo
#
# Copies agent-logs folder from ~/Projects/agents-copy/[REPO] to ~/Projects/[REPO]
# Usage: ./scripts/template/sync-agent-logs.sh
#

set -e

AGENTS_COPY_DIR="$HOME/Projects/agents-copy"

# Get current repo name from git or directory name
CURRENT_DIR="$(pwd)"
REPO_NAME=$(basename "$CURRENT_DIR")

# Dev repo is at ~/Projects/<repo-name> (not the agents-copy path)
DEV_REPO_DIR="$HOME/Projects/$REPO_NAME"

echo "============================================================"
echo "Syncing agent-logs for: $REPO_NAME"
echo "============================================================"
echo ""

# Source and destination paths
SOURCE_LOGS="$AGENTS_COPY_DIR/$REPO_NAME/agent-logs"
DEST_LOGS="$DEV_REPO_DIR/agent-logs"

# Check if dev repo exists
if [ ! -d "$DEV_REPO_DIR" ]; then
    echo "⚠️  Dev repo not found at: $DEV_REPO_DIR"
    echo "Nothing to sync."
    exit 0
fi

# Check if source agent-logs exists
if [ ! -d "$SOURCE_LOGS" ]; then
    echo "⚠️  No agent-logs found at: $SOURCE_LOGS"
    echo "Nothing to sync."
    exit 0
fi

# Count files in source
file_count=$(find "$SOURCE_LOGS" -type f -name "issue-*.md" 2>/dev/null | wc -l | tr -d ' ')

if [ "$file_count" -eq 0 ]; then
    echo "No log files found in $SOURCE_LOGS"
    exit 0
fi

# Copy agent-logs folder (rsync preserves timestamps, only copies changed files)
echo "📝 Syncing $file_count log file(s) from agents-copy..."
mkdir -p "$DEST_LOGS"
rsync -a --delete "$SOURCE_LOGS/" "$DEST_LOGS/"

echo ""
echo "✅ Done! Synced $file_count log file(s) to $DEST_LOGS"
echo ""
