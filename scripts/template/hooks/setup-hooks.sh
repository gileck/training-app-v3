#!/bin/bash
#
# Setup git hooks for this repository
# Run this once after cloning to enable post-push hook and yarn.lock protection
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Make hooks and scripts executable
chmod +x "$SCRIPT_DIR/post-push"
chmod +x "$SCRIPT_DIR/pre-commit"
chmod +x "$PROJECT_DIR/scripts/template/check-template-files.sh" 2>/dev/null || true

# Install pre-commit hook
cp "$SCRIPT_DIR/pre-commit" "$PROJECT_DIR/.git/hooks/pre-commit"
chmod +x "$PROJECT_DIR/.git/hooks/pre-commit"

# Configure git alias for push with post-push hook
# This creates a local alias that runs the real push, then our hook
git config --local alias.pushh "!git push \"\$@\" && $SCRIPT_DIR/post-push #"

# Mark yarn.lock as skip-worktree to ignore local changes
# This prevents wixpress registry URLs from showing up in git status
# while keeping the committed version with public npm URLs for Vercel
git update-index --skip-worktree yarn.lock 2>/dev/null || true

echo "✅ Git hooks configured!"
echo "✅ Pre-commit hook installed:"
echo "   - Auto-regenerates CLAUDE.md when docs/skills change"
echo "   - Blocks modifications to template-owned files (child projects)"
echo "   - Runs yarn checks before commit"
echo "✅ yarn.lock marked as skip-worktree (local changes ignored)"
echo ""
echo "Use 'git pushh' instead of 'git push' to trigger post-push hook."
echo "Or continue using 'yarn push-sync' for commit + push + sync."
