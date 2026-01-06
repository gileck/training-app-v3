# Template Diff Summary

This command generates and summarizes all differences between the template repository and your current project, regardless of commit history.

## Purpose

Use this command to:
- See a complete overview of how your project differs from the template
- Review template updates you may have missed
- Understand which files have diverged from the template
- Identify template improvements you might want to manually apply

## Process

### Step 1: Generate the Diff Summary

Run the diff-summary command to compare your project with the latest template:

```bash
yarn sync-template --diff-summary
```

This will:
1. Clone the latest template
2. Compare ALL files between template and project
3. Generate `template-diff-summary.md` with full diffs

### Step 2: Read and Summarize the Diff

After the command completes, read the generated diff summary file and provide a summary to the user.

Read the file `template-diff-summary.md` in the project root.

### Step 3: Present Summary to User

Provide a clear summary that includes:

1. **Overview Statistics**:
   - Total files that differ
   - Number of new files (in template but not in project)
   - Number of modified files (different from template)
   - Number of ignored files

2. **Key Differences by Category**:
   - List the most important/interesting differences
   - Group by type: infrastructure, features, configuration, etc.
   - Highlight any security-related or critical updates

3. **Recommendations**:
   - Which files should be reviewed for potential updates
   - Which differences are expected (project customizations)
   - Any concerning divergences that should be addressed

## Output Format

Present the summary in a clear, readable format:

```
## Template Diff Summary

### Overview
- **X files** differ from template
- **Y new files** in template (not in your project)
- **Z modified files** (changed from template)
- **W ignored files** (in ignore list)

### Notable Differences

#### Infrastructure Changes
- `file1.ts` - [description of what's different]
- `file2.ts` - [description of what's different]

#### Feature Updates
- `feature/file.tsx` - [description]

#### Configuration
- `config.ts` - [description]

### Recommendations
1. Consider reviewing: [files]
2. Expected customizations: [files]
3. Potential concerns: [files]
```

## Notes

- This shows ALL differences, not just changes since last sync
- Ignored files are still shown (but marked as ignored)
- Use `yarn sync-template` to apply template updates interactively
- The diff summary file is added to `.gitignore` and won't be committed

