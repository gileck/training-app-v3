#!/bin/bash
#
# Sync Agent Logs from agents-copy to dev repos
#
# Copies agent-logs folders from ~/Projects/agents-copy/[REPO] to ~/Projects/[REPO]
# Usage: ./scripts/sync-agent-logs.sh
#

set -e

AGENTS_COPY_DIR="$HOME/Projects/agents-copy"
PROJECTS_DIR="$HOME/Projects"

echo "============================================================"
echo "Syncing agent-logs from agents-copy to dev repos"
echo "============================================================"
echo ""

# Check if agents-copy directory exists
if [ ! -d "$AGENTS_COPY_DIR" ]; then
    echo "⚠️  agents-copy directory not found: $AGENTS_COPY_DIR"
    echo "Nothing to sync."
    exit 0
fi

# Counter
synced=0
skipped=0

# Iterate over all directories in agents-copy
for agent_repo_dir in "$AGENTS_COPY_DIR"/*; do
    # Skip if not a directory
    if [ ! -d "$agent_repo_dir" ]; then
        continue
    fi

    # Get repo name (basename)
    repo_name=$(basename "$agent_repo_dir")

    # Source and destination paths
    source_logs="$agent_repo_dir/agent-logs"
    dev_repo_dir="$PROJECTS_DIR/$repo_name"
    dest_logs="$dev_repo_dir/agent-logs"

    # Skip if source agent-logs doesn't exist
    if [ ! -d "$source_logs" ]; then
        continue
    fi

    # Skip if dev repo doesn't exist
    if [ ! -d "$dev_repo_dir" ]; then
        echo "⚠️  Dev repo not found: $dev_repo_dir (skipping)"
        ((skipped++))
        continue
    fi

    # Count files in source
    file_count=$(find "$source_logs" -type f -name "issue-*.md" 2>/dev/null | wc -l | tr -d ' ')

    if [ "$file_count" -eq 0 ]; then
        continue
    fi

    # Copy agent-logs folder (rsync preserves timestamps, only copies changed files)
    echo "📝 Syncing $repo_name: $file_count log file(s)"
    mkdir -p "$dest_logs"
    rsync -a --delete "$source_logs/" "$dest_logs/"

    ((synced++))
done

echo ""
echo "============================================================"
echo "Summary"
echo "============================================================"
echo "Repos synced: $synced"
if [ $skipped -gt 0 ]; then
    echo "Repos skipped: $skipped"
fi

if [ $synced -eq 0 ] && [ $skipped -eq 0 ]; then
    echo "No agent logs found to sync."
fi

echo ""
