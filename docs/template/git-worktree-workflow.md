---
title: Git Worktree Workflow
description: Isolated development with clean commit history. Use this for feature/fix development.
summary: Create worktree for development, squash merge to main for single clean commit. Always run `yarn checks` before merging.
priority: 4
---

# Git Worktree Workflow

Best practices for using git worktrees to implement features and fixes with clean commit history.

## Why Worktrees?

- **Isolated environment**: Work on fixes without affecting your main working directory
- **Parallel work**: Keep main worktree clean while experimenting
- **Easy abort**: If something goes wrong, just delete the worktree

## Workflow

### Step 1: Create Worktree

```bash
# From main project directory
MAIN_PROJECT_PATH=$(pwd)
git worktree add -b fix/my-fix ../my-project-fix HEAD

# Go to worktree and symlink node_modules (faster than reinstalling)
cd ../my-project-fix
ln -s "${MAIN_PROJECT_PATH}/node_modules" node_modules
```

**Why symlink node_modules?**
- **Faster**: No need to reinstall dependencies (saves minutes)
- **Saves disk space**: Doesn't duplicate node_modules (saves GBs)
- **Same dependencies**: Uses exact same packages as main workspace

**Naming convention:**
- `fix/descriptive-name` - for bug fixes
- `feat/descriptive-name` - for features
- Worktree folder: `../project-name-fix` or `../project-name-feature`

### Step 2: Implement Changes

Work in the worktree as normal:

```bash
# Make changes, commit as needed (commits can be messy/WIP)
git add .
git commit -m "WIP: initial changes"

# More changes...
git add .
git commit -m "WIP: more fixes"

# Run checks before finishing
yarn checks
```

**Tips:**
- Commit frequently (these commits will be squashed)
- Don't worry about perfect commit messages yet
- Run `yarn checks` before considering work complete

### Step 3: Squash Merge to Main

Back in the **main worktree**, squash merge all changes into one clean commit:

```bash
# Return to main worktree
cd /path/to/main/project

# Squash merge (combines all commits into staged changes)
git merge --squash fix/my-fix

# Create ONE commit with detailed message
git commit -m "$(cat <<'EOF'
fix: descriptive title of the change

Detailed explanation of what was changed and why.
Can be multiple lines.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# Push to remote
git push origin main
```

**Why `--squash`?**
- Combines all worktree commits into ONE clean commit
- You write the final polished commit message
- Clean linear history on main

### Step 4: Cleanup

```bash
# Remove the worktree
git worktree remove ../my-project-fix

# Delete the local branch
git branch -d fix/my-fix

# If you pushed the branch, delete remote too
git push origin --delete fix/my-fix
```

## Quick Reference

```bash
# === CREATE ===
MAIN_PROJECT_PATH=$(pwd)
git worktree add -b fix/my-fix ../project-fix HEAD
cd ../project-fix && ln -s "${MAIN_PROJECT_PATH}/node_modules" node_modules

# === WORK ===
# ... make changes, commit freely ...
yarn checks

# === MERGE (from main worktree) ===
cd "${MAIN_PROJECT_PATH}"
git merge --squash fix/my-fix
git commit -m "fix: detailed message"
git push origin main

# === CLEANUP ===
git worktree remove ../project-fix
git branch -d fix/my-fix
```

## Common Scenarios

### Abort/Discard Changes

If you want to throw away all work in the worktree:

```bash
git worktree remove --force ../project-fix
git branch -D fix/my-fix
```

### Check Existing Worktrees

```bash
git worktree list
```

### Worktree Has Uncommitted Changes

You must commit or discard changes before removing:

```bash
cd ../project-fix
git stash  # or git checkout .
cd ../main-project
git worktree remove ../project-fix
```

## Anti-Patterns to Avoid

| Don't Do This | Do This Instead |
|---------------|-----------------|
| Push feature branch, then merge with merge commit | Squash merge locally, push main |
| Create PR for tiny fixes | Squash merge directly to main |
| Checkout feature branch in main worktree | Keep branches in their worktrees |
| Leave old worktrees around | Clean up after merging |

## When to Use PRs Instead

Use the full PR flow when:
- Changes need code review
- Large features with multiple phases
- Working with a team
- You want CI checks before merging

For small fixes and solo work, the squash-merge workflow is faster.
