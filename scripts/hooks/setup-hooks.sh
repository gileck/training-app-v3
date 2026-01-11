#!/bin/bash
#
# Setup git hooks for this repository
# Run this once after cloning to enable post-push hook
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Make post-push hook executable
chmod +x "$SCRIPT_DIR/post-push"

# Configure git alias for push with post-push hook
# This creates a local alias that runs the real push, then our hook
git config --local alias.pushh "!git push \"\$@\" && $SCRIPT_DIR/post-push #"

echo "✅ Git hooks configured!"
echo ""
echo "Use 'git pushh' instead of 'git push' to trigger post-push hook."
echo "Or continue using 'yarn push-sync' for commit + push + sync."
