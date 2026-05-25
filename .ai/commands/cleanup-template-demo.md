---
description: Remove the example/demo features (AI Chat, Todos, demo Home, etc.) cloned from app-template-ai so the child project starts clean
---

# Clean Up Template Demo Features

When a project is created from `app-template-ai`, it inherits a set of **example features** under `src/client/routes/project/`, `src/apis/project/`, and `src/server/database/collections/project/` (AI Chat, Todos, demo Home page, Admin Dashboard, Debug page). These exist to demonstrate the template's patterns; they are not meant to ship in a real product.

This command walks the user through removing those demo features and updating the wiring so `yarn checks` still passes.

## When to Use

- Immediately after cloning a new project from `app-template-ai`, before adding real features.
- Also valid later: if a demo feature is still hanging around and you want to remove it.

**Do NOT run on the template repo itself** — the demo features are documentation for the template. The command should detect when it's running in the template repo (look for `template/sync-template/` or compare `package.json` `name` against the template) and refuse with a clear message.

## What Counts as a "Demo Feature"

Each demo feature is a self-contained module that spans three directories. The full catalog (as shipped by `app-template-ai`):

| Feature | Route(s) | Files |
|---|---|---|
| **AI Chat** | `/ai-chat` | `src/client/routes/project/AIChat/`, `src/apis/project/chat/` |
| **Todos** | `/todos`, `/todos/:todoId` | `src/client/routes/project/Todos/`, `src/client/routes/project/SingleTodo/`, `src/apis/project/todos/`, `src/server/database/collections/project/todos/` |
| **Demo Home** | `/` | `src/client/routes/project/Home/` |
| **Admin Dashboard** | `/admin/dashboard` | `src/client/routes/project/Dashboard/` |

The Debug page (`/admin/debug`) is intentionally **not** in this catalog — it's a permanent admin tool every child project keeps. Skip it; never offer it as a removal target.

Detect which of these still exist in the working tree. If the catalog has grown in the template since this command was written, ALSO scan `src/client/routes/project/` for any directory that's currently imported by `src/client/routes/index.project.ts` and report it as an unknown candidate — do not auto-remove it; just surface it so the user can decide.

Treat empty placeholder directories (0 files) as "nothing to clean" and skip them silently.

## Process

### Step 1: Pre-flight

- **Objective**: Confirm this is a child project and that the tree is clean.
- **Actions**:
  - Verify `package.json` `name` ≠ `app-template-ai`. If it matches, refuse and tell the user this command is for child projects.
  - Run `git status --porcelain`. If there are uncommitted changes, ask the user to commit or stash first — this command deletes files and edits wiring, and a dirty tree makes rollback messy.
  - Run `yarn checks` once to confirm the baseline is green. If it's already broken, surface the failures and stop — don't add cleanup on top of a broken tree.

### Step 2: Discover

- **Objective**: Find which demo features are still present.
- **Actions**:
  - For each entry in the catalog above, check whether its directories exist and have files.
  - Show the user a table: feature name, route(s), file count across all its dirs.
  - For each entry in `src/client/routes/project/` NOT in the catalog, show it under "unknown (template may have added new demos)" — report only.

### Step 3: Pick

- **Objective**: Let the user choose which features to remove.
- **Actions**:
  - Use `AskUserQuestion` with `multiSelect: true`. One option per detected feature, labeled with name + route. Include a "Cancel" path so the user can bail.
  - **Special handling for Demo Home**: if the user selects it, ask a follow-up — "Removing the demo Home leaves `/` unrouted. Replace it with: (a) a redirect to another route, (b) an empty placeholder page, (c) leave `/` unrouted and I'll wire my own later?" Apply the user's choice in Step 4.

### Step 4: Remove each selected feature

For each selected feature, run this sub-flow:

1. **List the exact files** that will be deleted (use `git ls-files` or `find` to enumerate). Print the full list.
2. **Update wiring files** (these are project-owned; never delete them, only edit):
   - `src/client/routes/index.project.ts` — remove the feature's `import` lines and its entries in the `projectRoutes` map.
   - `src/apis/apis.project.ts` — remove the feature's `import` lines and its argument to `mergeApiHandlers(...)`.
   - `src/server/database/collections/index.project.ts` — remove the matching `export * as <name> from './project/<name>'` line.
3. **Delete the directories** under `src/client/routes/project/`, `src/apis/project/`, `src/server/database/collections/project/` for that feature.
4. **Grep for orphaned references**: `grep -rn '<feature-name-or-route>' src/ docs/` excluding the already-deleted paths. If any results, list them and ask the user how to handle each before continuing. Don't auto-edit.
5. **Demo Home special case** (only if Home was the feature just removed):
   - If user picked "redirect": prompt for the target path, then add a redirect route to `projectRoutes` (e.g., `'/': { component: RedirectTo('/something'), public: true }`). Match how the project does redirects — look in `src/client/routes/template/` for examples before inventing.
   - If user picked "placeholder": create a minimal `src/client/routes/project/Home/index.tsx` that renders one line of welcome text and wire it back into `projectRoutes`.
   - If user picked "leave unrouted": warn that visiting `/` will hit `NotFound` until they wire their own route.

### Step 5: Verify

- **Objective**: Confirm the project still builds.
- **Actions**:
  - Run `yarn checks`.
  - If it passes: report success with the list of features removed, files deleted (count), wiring entries removed.
  - If it fails:
    - Surface the failing errors with file:line.
    - If errors point at imports of deleted modules from files OUTSIDE the feature's own directories, list those files and ask the user how to proceed — do not guess at deletions. Common offenders: a custom route or component that imported from a demo feature.
    - Do NOT attempt to fix by deleting more files. The user picks what to do.

### Step 6: Commit

- **Objective**: Capture the cleanup as one reviewable commit.
- **Actions**:
  - Stage the deletions and wiring edits.
  - Commit with a message like:
    ```
    chore: remove app-template-ai demo features (X, Y, Z)

    Cleared inherited demo modules and updated project-owned wiring
    (index.project.ts, apis.project.ts, collections/index.project.ts).
    ```
  - Do NOT push. The user reviews and pushes themselves.

## Safety Rules

- **NEVER** touch anything under `src/client/routes/template/`, `src/client/features/template/`, `src/apis/template/`, `src/server/template/`, `src/server/database/collections/template/`, or any `*.template.ts` file. Those are template-owned and sync from upstream.
- **NEVER** delete the wiring files (`index.project.ts`, `apis.project.ts`, `collections/index.project.ts`). Edit them in place; an empty `projectRoutes`/`projectApiHandlers` is fine.
- **NEVER** remove a feature the user did not select.
- **NEVER** silently skip a failing `yarn checks` — stop and surface the error.
- **NEVER** push or open a PR. The command's output is a clean local commit; the user takes it from there.

## Output

A single end-of-run summary:

```
Removed N demo feature(s): <list>
Deleted X files. Edited 3 wiring files.
Orphaned references found: <count> (listed above; user to resolve)
yarn checks: PASS / FAIL
Committed as <sha>: chore: remove app-template-ai demo features (...)
```

If anything was skipped or unresolved, list it under a "Follow-ups" heading.
