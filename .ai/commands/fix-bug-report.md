# Fix Bug Report

You are implementing a fix for a bug that has already been investigated. The investigation includes root cause analysis and proposed fix.

## Getting Report Data

### Option 1: List Investigated Reports

If the user hasn't provided a specific report ID, list investigated reports that need fixing:

```bash
# List all investigated reports
node scripts/template/list-reports.mjs --investigated

# Filter by investigation status
node scripts/template/list-reports.mjs --inv-status root_cause_found
node scripts/template/list-reports.mjs --inv-status complex_fix

# Combine filters
node scripts/template/list-reports.mjs --status new --inv-status root_cause_found
node scripts/template/list-reports.mjs --confidence high --complexity low --limit 20
```

The output includes:
- Report ID (use this to fetch full details)
- Investigation status, confidence, and headline
- Proposed fix complexity
- Files to be changed

### Option 2: Fetch Specific Report

If the user provides a **report ID**, fetch the full report with investigation details:

```bash
node scripts/template/get-report.mjs <report-id>
```

This outputs the complete report including the investigation results and proposed fix.

## Typical Workflow

1. **List investigated reports** - Run `node scripts/template/list-reports.mjs --investigated`
2. **Select a report** - Pick one with `root_cause_found` status and a proposed fix
3. **Fetch full details** - Run `node scripts/template/get-report.mjs <report-id>`
4. **Review investigation** - Understand the root cause and proposed fix
5. **Implement fix** - Make the code changes following the proposed fix
6. **Test** - Verify the fix works
7. **Update status** - Mark report as resolved (optional, done automatically if you create a commit)

## Input

The user will provide either:
1. **Nothing** → List investigated reports and ask which one to fix
2. **A report ID** → Fetch full details including investigation
3. **A full report** → Implement fix directly (user copied the report data)

## Investigation Data

The investigation includes:

### Status
- `root_cause_found` → Root cause identified with actionable fix
- `complex_fix` → Root cause found but requires architectural discussion
- `needs_info` → Need more details before fixing
- `inconclusive` → Couldn't determine cause
- `not_a_bug` → Feature request or expected behavior

### Proposed Fix
- **Description**: High-level fix explanation
- **Files**: List of files to change with change descriptions
- **Complexity**: `low`, `medium`, or `high`

### Additional Context
- **Root Cause**: Detailed explanation of what's causing the bug
- **Analysis Notes**: Additional findings from investigation
- **Files Examined**: Files the investigation agent looked at
- **Confidence**: `low`, `medium`, or `high`

## Implementation Steps

### 1. Review the Investigation

Carefully read:
- The investigation **headline** and **summary**
- The **root cause** explanation
- The **proposed fix** description
- The list of **files to change**

### 2. Understand the Bug

Read the original bug report:
- User description
- Error message and stack trace
- Session logs showing what happened
- Screenshot (if available)

### 3. Verify the Analysis

Before implementing:
- Read the files mentioned in the investigation
- Confirm the root cause makes sense
- Check if the proposed fix is appropriate
- Look for edge cases or side effects

### 4. Implement the Fix

Follow the proposed fix but use your judgment:
- Make necessary code changes
- Add tests if appropriate
- Follow existing code patterns
- Consider edge cases not mentioned in the proposal

### 5. Test the Fix

- Run the app and verify the bug is fixed
- Check that no new issues were introduced
- Run tests if available
- Test edge cases

### 6. Update Report Status (Optional)

If you want to mark the report as resolved, you can use the update script:

```bash
# Mark report as resolved
node scripts/update-report-status.mjs <report-id> resolved
```

Or just create a commit - the system may auto-update the status.

## Example Investigation Output

```
Investigation Status: root_cause_found
Headline: AudioPlayer component not clearing previous chapter audio on chapter switch
Confidence: high

Root Cause:
The AudioPlayer component stores the audio blob URL in state but doesn't revoke the
previous blob URL when switching chapters. This causes the old audio to remain in
memory and play alongside the new chapter's audio.

Proposed Fix:
Description: Add cleanup to revoke blob URL before loading new chapter audio
Files:
  - src/client/features/audio-player/AudioPlayer.tsx
    Changes: Add URL.revokeObjectURL() call in useEffect cleanup and before
    loading new audio
Complexity: low

Files Examined:
  - src/client/routes/Reader/Reader.tsx
  - src/client/features/audio-player/AudioPlayer.tsx
  - src/client/features/audio-player/store.ts
```

## Implementation Approach

Based on the investigation status:

### `root_cause_found`
- Root cause is clear
- Proposed fix is actionable
- **Action**: Implement the proposed fix directly

### `complex_fix`
- Root cause is known but fix requires discussion
- May affect multiple systems
- **Action**: Implement carefully, consider discussing with user first

### `needs_info`
- Investigation needs more details
- **Action**: Ask user for more information or try to reproduce the bug

### `inconclusive`
- Root cause unclear
- **Action**: Debug further before implementing a fix

### `not_a_bug`
- Not actually a bug
- **Action**: Explain to user, maybe implement feature request if reasonable

## Output Format

After implementing the fix, provide:

### Summary
Brief description of what was fixed

### Changes Made
List of files changed and what was done in each

### Testing
How you verified the fix works

### Notes
Any additional considerations or follow-up needed

---

## Report to Fix

{paste the investigated bug report here, or I'll fetch it for you}
