---
title: Build CLAUDE.md
description: Auto-generate CLAUDE.md from docs. Run this after creating or updating docs.
summary: "Run `yarn build:claude` to regenerate CLAUDE.md from all docs with frontmatter. **IMPORTANT: Run this after adding new docs or updating title/summary/description in existing docs.**"
priority: 1
---

# Build CLAUDE.md

CLAUDE.md is auto-generated from docs that have frontmatter.

## When to Run

Run `yarn build:claude` after:
- Creating a new doc in `docs/template/` or `docs/project/`
- Updating `title`, `description`, `summary`, `guidelines`, `priority`, or `key_points` in any frontmatter

## Frontmatter Format

```yaml
---
title: Section Title
description: When to use this doc (optional)
summary: Key information for Claude
guidelines:    # optional, prescriptive rules rendered as bullets in CLAUDE.md
  - "MUST do X"
  - "Never do Y"
priority: 1-5  # 1=critical, 5=reference
key_points:    # optional
  - Point 1
  - Point 2
related_docs:  # optional, relative paths
  - other-doc.md
related_rules: # optional, project guideline names (resolves to docs/template/project-guidelines/)
  - guideline-name
---
```

### `guidelines` vs `summary`

- **`guidelines`** = prescriptive rules ("you MUST do X", "NEVER do Y") — rendered as bullet points under `**Guidelines:**` in CLAUDE.md
- **`summary`** = informational ("here's how X works") — rendered as one-line text under `**Summary:**` in CLAUDE.md

When `guidelines` is present, it replaces `summary` and `key_points` in the CLAUDE.md output. The docs link label changes to `**Full docs:**`.

A doc needs `title` + either `summary` or non-empty `guidelines` to be included.

## Files Scanned

- `docs/template/*.md` and `docs/project/*.md` (recursive)

Only files with `title` + (`summary` or `guidelines`) in frontmatter are included.
