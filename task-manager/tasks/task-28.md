---
number: 28
title: "sync-template: Warn When Overwriting Local Project Changes"
priority: Medium
size: M
complexity: Medium
status: TODO
dateAdded: 2026-01-31
---

# Task 28: sync-template: Warn When Overwriting Local Project Changes

**Summary:** Add git history check to detect and warn when template sync will overwrite files the project modified locally since last sync.

## Details

Currently, the folder ownership model always copies template files (unless in projectOverrides). This is correct behavior, but users may accidentally lose local changes they made without realizing.

This enhancement adds a warning when overwriting files that the project modified since `lastSyncDate`, giving users a chance to either:
1. Approve the overwrite
2. Add the file to `projectOverrides` to keep their version

## Implementation Notes

Flow:
1. Template still wins by default (current behavior)
2. For each file that differs between template and project:
   - Check git history: `git log --since=lastSyncDate -- <file>`
   - If project modified the file since last sync → show warning
3. Warning message: "⚠️ You modified X locally, it will be overwritten"
4. User can:
   - Approve to continue with overwrite
   - Add to projectOverrides to keep their version
   - Cancel sync

Key implementation points:
- Use `lastSyncDate` from `.template-sync.json` config
- Run git log for each differing file (batch if many files)
- Show interactive prompt with approve button
- Optionally offer to auto-add to projectOverrides

## Files to Modify

- `scripts/template/sync-template/analysis/folder-sync-analysis.ts` - Add git history check
- `scripts/template/sync-template/sync-template-tool.ts` - Add warning UI/prompts
- `scripts/template/sync-template/types/index.ts` - Add new types for warnings

## Notes

This improves UX without breaking the ownership model. Template still wins by default, but users get a safety net against accidental data loss.
