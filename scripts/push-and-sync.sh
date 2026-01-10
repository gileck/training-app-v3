#!/bin/bash
#
# Push changes to remote and optionally sync child projects.
#
# Usage:
#   yarn push-sync              # Commit, push, and ask to sync children
#   yarn push-sync "message"    # Commit with message, push, and ask to sync children
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Stage and commit changes
git add .

if [ -n "$1" ]; then
    git commit -am "$1"
else
    git commit -am "commit"
fi

# Push to remote
echo "📤 Pushing to remote..."
git push

# Check if child-projects.json exists
if [ ! -f "$PROJECT_DIR/child-projects.json" ]; then
    exit 0
fi

# Ask user if they want to sync child projects
echo ""
read -p "🔄 Sync child projects? (y/N): " response
case "$response" in
    [yY]|[yY][eE][sS])
        echo ""
        yarn sync-children
        ;;
    *)
        echo "Skipping child sync."
        ;;
esac
