# Sync Child Projects

This command syncs template changes to all child projects (projects cloned from this template).

## Purpose

Use this command to:
- Push template updates to all child projects at once
- See which projects were synced successfully
- Identify projects that were skipped (uncommitted changes) or had errors

## Prerequisites

Ensure `child-projects.json` exists in the project root with the list of child project paths:

```json
{
  "projects": [
    "../project-1",
    "../project-2"
  ]
}
```

## Process

### Step 1: Run the Sync Command

Execute the sync-children script:

```bash
yarn sync-children
```

This will:
1. Read the list of child projects from `child-projects.json`
2. For each project, check if it has uncommitted changes
3. Skip projects with uncommitted changes
4. Run `yarn sync-template --auto-safe-only` on clean projects
5. Print a summary of results

### Step 2: Capture and Summarize Results

After the command completes, provide a clear summary to the user including:

1. **Synced Projects**: List projects that were successfully synced
2. **Skipped Projects**: List projects that were skipped and why (e.g., uncommitted changes)
3. **Errors**: List any projects that encountered errors during sync
4. **Recommendations**: Suggest next steps for skipped/failed projects

## Output Format

Present the summary in a clear, readable format:

```
## Sync Children Summary

### Successfully Synced
- **project-1**: Changes synced and committed
- **project-2**: Already up to date

### Skipped
- **project-3**: Has uncommitted changes
  - Action: Commit or stash changes, then run sync again

### Errors
- **project-4**: Not a git repository
  - Action: Check if path is correct in child-projects.json

### Next Steps
1. For skipped projects: commit their changes first, then re-run sync
2. For errors: verify the project paths in child-projects.json
```

## Notes

- Only safe changes (no conflicts) are synced automatically
- Projects with uncommitted changes are always skipped to prevent data loss
- Each synced project gets a commit with the template changes
- Use `yarn sync-children --dry-run` to preview without applying changes
