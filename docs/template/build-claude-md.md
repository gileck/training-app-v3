---
title: Build CLAUDE.md
description: Auto-generate CLAUDE.md from docs and skills. Run this after creating or updating docs.
summary: "Run `yarn build:claude` to regenerate CLAUDE.md from all docs and skills with frontmatter. **IMPORTANT: Run this after adding new docs or updating title/summary/description in existing docs.**"
priority: 1
---

# Build CLAUDE.md

CLAUDE.md is auto-generated from docs and skills that have frontmatter.

## When to Run

Run `yarn build:claude` after:
- Creating a new doc in `docs/template/` or `docs/project/`
- Adding `title`/`summary` frontmatter to a skill in `.ai/skills/`
- Updating `title`, `description`, `summary`, `priority`, or `key_points` in any frontmatter

## Frontmatter Format

```yaml
---
title: Section Title
description: When to use this doc (optional)
summary: Key information for Claude
priority: 1-5  # 1=critical, 5=reference
key_points:    # optional
  - Point 1
  - Point 2
related_docs:  # optional, relative paths
  - other-doc.md
related_rules: # optional, skill folder names
  - skill-name
---
```

## Files Scanned

- `docs/template/*.md` and `docs/project/*.md` (recursive)
- `.ai/skills/template/*/SKILL.md` and `.ai/skills/project/*/SKILL.md`

Only files with `title` + `summary` in frontmatter are included.
