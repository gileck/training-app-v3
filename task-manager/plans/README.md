# Task Implementation Plans

This directory contains implementation plans for complex tasks (M/L/XL size).

## Naming Convention

```
task-N-plan.md
```

Where `N` is the task number from `tasks.md`.

## When to Create a Plan

- **XS/S tasks**: Skip planning, implement directly
- **M tasks**: Recommended for clarity
- **L/XL tasks**: Required before implementation

## Plan Template

```markdown
# Task N: [Task Title] - Implementation Plan

## Objective
Brief description of what we're implementing.

## Approach
High-level approach and key decisions.

## Sub-tasks
- [ ] Sub-task 1
- [ ] Sub-task 2
- [ ] ...

## Files to Modify
- `path/to/file.ts` - What changes

## Notes
Any additional context or decisions.
```

## Linking Plans to Tasks

After creating a plan, add this line to the task in `tasks.md`:

```markdown
**Plan:** `task-manager/plans/task-N-plan.md`
```
