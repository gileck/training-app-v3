---
description: Start implementing a task in a separate git worktree for isolated work
---

# Start Task in Worktree Command

Create a separate git worktree and implement a task from `task-manager/tasks.md` in isolation using the squash-merge workflow. This allows working on multiple tasks simultaneously with clean commit history.

## Usage

Invoke this command with a task number:
- `/start-task-worktree 3` - Start task 3 in a new worktree
- `/start-task-worktree --task 5` - Start task 5 in a new worktree

## Worktree Workflow Overview

This workflow wraps `/start-task` with git worktree isolation and squash merge:

1. **Setup**: Create worktree with branch, symlink dependencies
2. **Implement**: Follow `/start-task` steps 2-8 (in worktree, WIP commits OK)
3. **Merge**: Return to main, squash merge into ONE clean commit
4. **Cleanup**: Push to main, remove worktree and branch

**Key differences from /start-task:**
- ✅ Isolated workspace (separate worktree directory)
- ✅ Messy WIP commits allowed (will be squashed)
- ✅ Direct to main (no PR needed)
- ✅ ONE clean commit on main branch

## When to Use Worktree Workflow

**Use worktree workflow when:**
- Working on multiple tasks simultaneously
- Need isolated environment without affecting main workspace
- Want to experiment freely (easy to abort)
- Task is small/medium and doesn't need code review
- Solo work or trusted automated implementation

**Use regular `/start-task` (with PR) when:**
- Changes need code review
- Large features requiring team collaboration
- Want CI checks before merging
- Working with a team on shared codebase

---

## ⚠️ CRITICAL WORKFLOW REQUIREMENT ⚠️

**YOU MUST REQUEST USER REVIEW AND APPROVAL (STEP 8) BEFORE RETURNING TO MAIN**

This is NOT optional. This step is MANDATORY for all tasks, regardless of size.

**The workflow is:**
1. Implement the task in worktree
2. Run `yarn checks` to validate
3. **STOP and request user review (Step 8)** ← YOU ARE HERE
4. Wait for explicit user approval
5. ONLY THEN return to main and squash merge (Step 10+)

**Even though you're working in a worktree and will squash merge later, you MUST still get user approval before proceeding. The worktree workflow does NOT exempt you from Step 8.**

---

## Process Overview

> **Note:** This command uses `/start-task` for the core implementation workflow (steps 2-8).
> It adds worktree isolation before and squash-merge cleanup after.

---

## Step 1: Create Worktree and Mark In Progress
- **Objective**: Set up isolated workspace for the task and mark it as being worked on
- **Actions**:
  - **FIRST**: Mark task as in progress: `yarn task mark-in-progress --task N`
  - Run: `yarn task worktree --task N` (where N is the task number)
  - This automatically:
    - Creates worktree at `../worktree-task-N/`
    - Creates new branch: `task/N-task-name`
    - Provides setup instructions
  - Note the worktree path and branch name

**Expected Output:**
```
🔧 Creating worktree for Task N: Task Title

📂 Worktree path: /Users/you/Projects/worktree-task-N
🌿 Branch: task/N-task-name

✅ Worktree created!
```

---

## Step 2: Navigate to Worktree and Symlink Dependencies
- **Objective**: Set up worktree environment
- **Actions**:
  - Save main project path: `MAIN_PROJECT_PATH=$(pwd)`
  - Change to worktree: `cd ../worktree-task-N`
  - Symlink node_modules (DO NOT run yarn install): `ln -s "${MAIN_PROJECT_PATH}/node_modules" node_modules`
  - Verify symlink created: `ls -la node_modules`

**CRITICAL - Always symlink, never install:**
- ✅ **Faster**: No dependency installation (saves minutes)
- ✅ **Saves disk space**: Doesn't duplicate node_modules (saves GBs)
- ✅ **Same dependencies**: Uses exact same packages as main workspace
- ❌ **Never run `yarn install` in worktree** - Always use symlink

---

## Step 3-9: Follow /start-task Implementation Steps

**Now follow the core implementation workflow from `/start-task` command.**

Read and execute steps 2-8 from `.ai/commands/start-task.md`:
- Step 2: Understand Requirements
- Step 3: Review Related Documentation
- Step 4: Explore Relevant Code
- Step 5: Create Implementation Plan (if complex)
- Step 6: Implement the Task
- Step 7: Run Validation Checks
- **Step 8: Request User Review and Approval (⚠️ MANDATORY - DO NOT SKIP ⚠️)**

**Key differences when working in worktree:**
- ✅ You're in `../worktree-task-N/` directory, not main workspace
- ✅ WIP commits are encouraged: `git commit -m "WIP: changes"` (will be squashed later)
- ✅ Commit as often as you want - perfect commit messages not needed
- ✅ All commits will be combined into ONE clean commit in Step 12

### ⚠️⚠️⚠️ CRITICAL CHECKPOINT ⚠️⚠️⚠️

**YOU MUST COMPLETE Step 8 (Request User Review and Approval) BEFORE CONTINUING TO STEP 10**

After validation checks pass (Step 7), you MUST:
1. STOP and request user review
2. Present implementation summary to user
3. Wait for explicit user approval
4. ONLY THEN continue to Step 10 below

**If you have NOT received user approval yet, DO NOT proceed to Step 10.**

---

## Step 10: Final Commit in Worktree
- **Objective**: Ensure all changes are committed
- **Actions**:
  - Stage any remaining changes: `git add .`
  - Commit: `git commit -m "WIP: final changes"`
  - Verify worktree is clean: `git status`

---

## Step 11: Return to Main Worktree
- **Objective**: Prepare for squash merge
- **Actions**:
  - Navigate back to main project: `cd /path/to/main/project`
  - Ensure main worktree is on main branch: `git checkout main`
  - Pull latest changes: `git pull origin main`

---

## Step 12: Squash Merge Branch
- **Objective**: Combine all worktree commits into ONE clean commit
- **Actions**:
  - Squash merge the worktree branch: `git merge --squash task/N-branch-name`
  - This stages all changes from worktree as one batch
  - All worktree commits are combined (no individual commit history)

**What `--squash` does:**
- Combines ALL commits from worktree into staged changes
- Lets you write ONE clean commit message
- No merge commit created
- Clean linear history on main

---

## Step 13: Create Clean Commit
- **Objective**: Write polished commit message for main branch
- **Actions**:
  - Create commit with detailed message:

```bash
git commit -m "$(cat <<'EOF'
fix: descriptive title of what was changed (task #N)

Detailed explanation of what was changed and why.
Can be multiple lines explaining the implementation.

Implements Task #N from task-manager/tasks.md

Key changes:
- File 1: what was changed
- File 2: what was changed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

**Commit message guidelines:**
- First line: conventional commit format (`fix:`, `feat:`, `refactor:`)
- Include task number reference
- Explain what and why, not how
- List key changes
- Add Co-Authored-By tag

---

## Step 14: Mark Task as Done (AUTOMATIC)
- **Objective**: Update task status in task-manager/tasks.md immediately after implementation
- **Actions**:
  - Run: `yarn task mark-done --task N` (where N is the task number)
  - This updates the task header with ✅ DONE marker and completion date
  - Stage the change: `git add task-manager/tasks.md`
  - Commit with message: `git commit -m "docs: mark task #N as done"`
  - This creates a **separate commit** following the implementation commit

**CRITICAL:** This step MUST happen before pushing so both commits go to main together.

**Why a separate commit?**
- Keeps implementation and documentation changes separated
- Makes git history cleaner and easier to review
- Follows the principle of atomic commits

---

## Step 15: Push to Main
- **Objective**: Deploy changes to main branch (includes both commits)
- **Actions**:
  - Push to main: `git push origin main`
    - This pushes **both commits**: implementation commit + task status commit
  - Verify push succeeded

---

## Step 16: Clean Up Worktree (MANDATORY)
- **Objective**: Remove worktree and branch immediately after push
- **CRITICAL**: Always clean up the worktree after changes are pushed to main. Never leave worktrees around.
- **Actions**:
  - Remove worktree: `git worktree remove ../worktree-task-N`
  - If needed (uncommitted changes): `git worktree remove ../worktree-task-N --force`
  - Delete local branch: `git branch -D task/N-branch-name`
    - Note: Use `-D` (force) because squash merges don't register as "merged" to git
  - Verify cleanup: `git worktree list` (should only show main worktree)

---

## Step 17: Summarize
- **Objective**: Report completion to user
- **Actions**:
  - Summarize what was implemented
  - Highlight key changes and files modified
  - Show the clean commit message that was created
  - Confirm validation checks passed
  - Confirm task marked as done
  - Confirm worktree cleaned up

---

## Quick Checklist

- [ ] Task marked as in progress with `yarn task mark-in-progress --task N`
- [ ] Worktree created with `yarn task worktree --task N`
- [ ] Navigated to worktree and symlinked node_modules (NOT yarn install)
- [ ] **Followed /start-task steps 2-7** (understand, document, explore, plan, implement, validate)
- [ ] **⚠️ CRITICAL: Step 8 - User review requested and approval received (MANDATORY - DO NOT SKIP)**
- [ ] Final WIP commit made in worktree
- [ ] Returned to main worktree on main branch
- [ ] Squash merged branch: `git merge --squash task/N-branch`
- [ ] Created ONE clean commit with detailed message (implementation commit)
- [ ] Task marked as done with `yarn task mark-done --task N` (separate commit)
- [ ] Both commits pushed to main: `git push origin main`
- [ ] Removed worktree and branch (MANDATORY)
- [ ] User notified with summary

---

## Squash Merge Workflow Quick Reference

```bash
# === SETUP ===
yarn task mark-in-progress --task N
yarn task worktree --task N

# === IN WORKTREE ===
MAIN_PROJECT_PATH=$(pwd)
cd ../worktree-task-N
ln -s "${MAIN_PROJECT_PATH}/node_modules" node_modules
# ... implement changes, commit freely (WIP commits OK) ...
yarn checks
git add . && git commit -m "WIP: final"

# === IN MAIN WORKTREE ===
cd "${MAIN_PROJECT_PATH}"
git checkout main
git pull origin main
git merge --squash task/N-branch-name

# Create ONE clean commit (implementation)
git commit -m "$(cat <<'EOF'
fix: description (task #N)

Details about the change.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

# Mark task as done (separate commit)
yarn task mark-done --task N
git add task-manager/tasks.md
git commit -m "docs: mark task #N as done"

# Push both commits
git push origin main

# === CLEANUP (MANDATORY - DO THIS IMMEDIATELY) ===
git worktree remove ../worktree-task-N
git branch -D task/N-branch-name  # Use -D because squash merge doesn't register as merged
git worktree list  # Verify only main worktree remains
```

---

## Common Scenarios

### Abort/Discard Changes

If you want to throw away all work in worktree:

```bash
git worktree remove --force ../worktree-task-N
git branch -D task/N-branch-name
```

### Check Existing Worktrees

```bash
git worktree list
```

### Multiple Worktrees in Parallel

```bash
# Work on task 3
MAIN_PROJECT_PATH=$(pwd)
yarn task worktree --task 3
cd ../worktree-task-3 && ln -s "${MAIN_PROJECT_PATH}/node_modules" node_modules
# ... work on task 3 ...

# Work on task 5 simultaneously
cd "${MAIN_PROJECT_PATH}"
yarn task worktree --task 5
cd ../worktree-task-5 && ln -s "${MAIN_PROJECT_PATH}/node_modules" node_modules
# ... work on task 5 ...

# Merge task 3 when ready
cd "${MAIN_PROJECT_PATH}"
git merge --squash task/3-branch
git commit -m "..."
yarn task mark-done --task 3
git add task-manager/tasks.md && git commit -m "docs: mark task #3 as done"
git push origin main
git worktree remove ../worktree-task-3

# Merge task 5 when ready
git merge --squash task/5-branch
git commit -m "..."
yarn task mark-done --task 5
git add task-manager/tasks.md && git commit -m "docs: mark task #5 as done"
git push origin main
git worktree remove ../worktree-task-5
```

---

## Benefits of Squash-Merge Worktree Workflow

1. **Clean History**: ONE commit per task on main, no messy WIP commits
2. **Freedom to Experiment**: Commit freely in worktree, will be squashed
3. **Easy Abort**: Just delete worktree, no cleanup needed
4. **Isolated Work**: Main workspace stays clean and untouched
5. **No PRs Needed**: Direct to main for solo/trusted work
6. **Parallel Work**: Multiple worktrees for multiple tasks
7. **Fast**: No PR review cycle for simple tasks

---

## When NOT to Use Worktree

- **Large features**: Use `/start-task` with PR for code review
- **Team work**: Use PR workflow for collaboration
- **Quick fixes** (XS): Regular workflow is faster, no isolation needed
- **Limited disk space**: Worktrees duplicate the codebase
- **Need CI checks**: Use PR workflow with GitHub Actions

---

## Anti-Patterns to Avoid

| Don't Do This | Do This Instead |
|---------------|-----------------|
| Push feature branch, then merge with PR | Squash merge locally, push to main |
| Create PR for tiny solo fixes | Squash merge directly to main |
| Checkout feature branch in main worktree | Keep branches in their worktrees |
| Leave old worktrees around | Clean up after squash merging |
| Skip `yarn checks` before merge | Always validate before squash merge |
| Forget to squash merge | Use `git merge --squash`, not `git merge` |

---

## Worktree vs Regular Task Workflow

| Aspect | `/start-task-worktree` | `/start-task` |
|--------|------------------------|---------------|
| **Workspace** | Separate worktree | Main workspace |
| **Commits** | Messy WIP commits OK | Clean commits |
| **Merge method** | Squash merge to main | PR with squash/merge |
| **Code review** | No (direct to main) | Yes (PR review) |
| **Best for** | Solo work, experiments | Team work, large features |
| **History** | ONE clean commit | PR with review history |
| **Speed** | Fast (no PR review) | Slower (PR review cycle) |
| **Isolation** | Full isolation | Same workspace |
| **Parallel work** | Multiple worktrees | Branch switching |
