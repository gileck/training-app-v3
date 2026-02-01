---
title: Sync Child Projects (Template Only)
description: Sync template changes to child projects. Use this after pushing template changes.
summary: Syncs safe changes to projects without uncommitted changes. Configure in `child-projects.json`.
priority: 4
---

# Sync Child Projects

This feature is for the template repository only. It syncs template changes to child projects.

## Commands

```bash
yarn sync-children    # Sync to all child projects
yarn push-sync        # Push changes and sync
```

## Configuration

Child projects are configured in `child-projects.json`.

## Safety

- Only syncs to projects without uncommitted changes
- Uses the path ownership model from template-sync
